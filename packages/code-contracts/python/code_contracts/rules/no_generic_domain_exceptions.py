"""Require domain-specific exceptions in service and repository implementations."""

from __future__ import annotations

import ast
from dataclasses import dataclass
from pathlib import PurePosixPath

from code_contracts.diagnostics import Diagnostic

RULE_NAME = "no-generic-domain-exceptions"
_GENERIC_EXCEPTIONS = frozenset({"Exception", "RuntimeError", "ValueError"})
_PYDANTIC_VALIDATORS = frozenset(
    {"field_validator", "model_validator", "root_validator", "validator"}
)


@dataclass(frozen=True, slots=True)
class NoGenericDomainExceptionsOptions:
    """Configuration for domain boundaries and explicit parsing exemptions."""

    domain_suffixes: tuple[str, ...] = ("Service", "Repository")
    exempt_methods: frozenset[str] = frozenset()
    exempt_path_parts: frozenset[str] = frozenset(
        {"cli", "config", "configuration"}
    )


def _diagnostic(path: str, node: ast.AST, exception_name: str) -> Diagnostic:
    line = getattr(node, "lineno", 1)
    column = getattr(node, "col_offset", 0) + 1
    end_line = getattr(node, "end_lineno", line)
    end_column = getattr(node, "end_col_offset", column - 1) + 1
    return Diagnostic(
        rule=RULE_NAME,
        code="generic-domain-exception",
        message=(
            f"Raise a domain-specific exception instead of {exception_name} "
            "inside service and repository implementations."
        ),
        path=path,
        line=line,
        column=column,
        end_line=end_line,
        end_column=end_column,
    )


def _bound_names(target: ast.AST) -> set[str]:
    if isinstance(target, ast.Name):
        return {target.id}
    if isinstance(target, (ast.Tuple, ast.List)):
        return {
            name
            for element in target.elts
            for name in _bound_names(element)
        }
    return set()


class _Symbols:
    def __init__(self, module: ast.Module) -> None:
        self.builtins_namespaces: set[str] = set()
        self.exception_aliases: dict[str, str] = {
            name: name for name in _GENERIC_EXCEPTIONS
        }
        self.pydantic_namespaces: set[str] = set()
        self.validator_aliases: set[str] = set()
        self.imported_names: dict[str, str] = {}
        self.class_definitions: dict[str, ast.ClassDef] = {}
        self.module_shadowed: set[str] = set()
        pending_aliases: list[tuple[str, ast.expr]] = []

        for statement in module.body:
            if isinstance(statement, ast.Import):
                for alias in statement.names:
                    binding = alias.asname or alias.name.split(".", 1)[0]
                    if alias.name == "builtins":
                        self.builtins_namespaces.add(binding)
                    elif alias.name == "pydantic":
                        self.pydantic_namespaces.add(binding)
                    else:
                        self.module_shadowed.add(binding)
            elif isinstance(statement, ast.ImportFrom):
                for alias in statement.names:
                    binding = alias.asname or alias.name
                    self.imported_names[binding] = alias.name
                    if statement.module == "builtins" and alias.name in _GENERIC_EXCEPTIONS:
                        self.exception_aliases[binding] = alias.name
                    elif statement.module == "pydantic" and alias.name in _PYDANTIC_VALIDATORS:
                        self.validator_aliases.add(binding)
                    else:
                        self.module_shadowed.add(binding)
            elif isinstance(statement, ast.ClassDef):
                self.class_definitions[statement.name] = statement
                if statement.name in _GENERIC_EXCEPTIONS:
                    self.module_shadowed.add(statement.name)
            elif isinstance(statement, (ast.FunctionDef, ast.AsyncFunctionDef)):
                if statement.name in _GENERIC_EXCEPTIONS:
                    self.module_shadowed.add(statement.name)
            elif isinstance(statement, ast.Assign):
                for target in statement.targets:
                    for name in _bound_names(target):
                        pending_aliases.append((name, statement.value))
            elif isinstance(statement, ast.AnnAssign):
                if statement.value is not None:
                    for name in _bound_names(statement.target):
                        pending_aliases.append((name, statement.value))

        unresolved = pending_aliases
        while unresolved:
            next_unresolved: list[tuple[str, ast.expr]] = []
            progressed = False
            for name, value in unresolved:
                resolved = self.resolve_exception(value, shadowed=frozenset())
                if resolved is None:
                    next_unresolved.append((name, value))
                    continue
                self.exception_aliases[name] = resolved
                progressed = True
            if not progressed:
                self.module_shadowed.update(name for name, _ in next_unresolved)
                break
            unresolved = next_unresolved

    def resolve_exception(
        self, node: ast.expr, *, shadowed: frozenset[str]
    ) -> str | None:
        if isinstance(node, ast.Name):
            if node.id in shadowed or node.id in self.module_shadowed:
                return None
            return self.exception_aliases.get(node.id)
        if (
            isinstance(node, ast.Attribute)
            and isinstance(node.value, ast.Name)
            and node.value.id in self.builtins_namespaces
            and node.attr in _GENERIC_EXCEPTIONS
        ):
            return node.attr
        return None

    def is_validator(self, method: ast.FunctionDef | ast.AsyncFunctionDef) -> bool:
        for decorator in method.decorator_list:
            target = decorator.func if isinstance(decorator, ast.Call) else decorator
            if isinstance(target, ast.Name) and target.id in self.validator_aliases:
                return True
            if (
                isinstance(target, ast.Attribute)
                and isinstance(target.value, ast.Name)
                and target.value.id in self.pydantic_namespaces
                and target.attr in _PYDANTIC_VALIDATORS
            ):
                return True
        return False


def _domain_classes(
    symbols: _Symbols, options: NoGenericDomainExceptionsOptions
) -> set[str]:
    classes = {
        name
        for name in symbols.class_definitions
        if name.endswith(options.domain_suffixes)
    }
    changed = True
    while changed:
        changed = False
        for name, definition in symbols.class_definitions.items():
            if name in classes:
                continue
            if any(
                isinstance(base, ast.Name)
                and (
                    base.id in classes
                    or base.id.endswith(options.domain_suffixes)
                    or symbols.imported_names.get(base.id, "").endswith(
                        options.domain_suffixes
                    )
                )
                for base in definition.bases
            ):
                classes.add(name)
                changed = True
    return classes


def _function_shadowed_names(
    method: ast.FunctionDef | ast.AsyncFunctionDef,
    aliases: frozenset[str],
) -> frozenset[str]:
    names = {
        argument.arg
        for argument in [
            *method.args.posonlyargs,
            *method.args.args,
            *method.args.kwonlyargs,
        ]
    }
    if method.args.vararg is not None:
        names.add(method.args.vararg.arg)
    if method.args.kwarg is not None:
        names.add(method.args.kwarg.arg)

    class BindingVisitor(ast.NodeVisitor):
        def visit_Name(self, node: ast.Name) -> None:
            if isinstance(node.ctx, (ast.Store, ast.Del)):
                names.add(node.id)

        def visit_FunctionDef(self, node: ast.FunctionDef) -> None:
            if node is method:
                for statement in node.body:
                    self.visit(statement)
            else:
                names.add(node.name)

        visit_AsyncFunctionDef = visit_FunctionDef

        def visit_ClassDef(self, node: ast.ClassDef) -> None:
            names.add(node.name)

        def visit_ExceptHandler(self, node: ast.ExceptHandler) -> None:
            if node.name is not None:
                names.add(node.name)
            if node.type is not None:
                self.visit(node.type)
            for statement in node.body:
                self.visit(statement)

    BindingVisitor().visit(method)
    return frozenset(names & aliases)


class _RaiseVisitor(ast.NodeVisitor):
    def __init__(
        self,
        *,
        symbols: _Symbols,
        shadowed: frozenset[str],
        path: str,
    ) -> None:
        self.symbols = symbols
        self.shadowed = shadowed
        self.path = path
        self.aliases = dict(symbols.exception_aliases)
        self.diagnostics: list[Diagnostic] = []

    def visit_Raise(self, node: ast.Raise) -> None:
        if node.exc is None:
            return
        expression = node.exc.func if isinstance(node.exc, ast.Call) else node.exc
        exception_name = self._resolve(expression)
        if exception_name is not None:
            self.diagnostics.append(_diagnostic(self.path, expression, exception_name))
        self.generic_visit(node)

    def visit_Assign(self, node: ast.Assign) -> None:
        exception_name = self._resolve(node.value)
        if exception_name is not None:
            for target in node.targets:
                for name in _bound_names(target):
                    self.aliases[name] = exception_name
        self.generic_visit(node)

    def visit_AnnAssign(self, node: ast.AnnAssign) -> None:
        if node.value is not None:
            exception_name = self._resolve(node.value)
            if exception_name is not None:
                for name in _bound_names(node.target):
                    self.aliases[name] = exception_name
        self.generic_visit(node)

    def visit_ClassDef(self, node: ast.ClassDef) -> None:
        return

    def visit_Lambda(self, node: ast.Lambda) -> None:
        return

    def _resolve(self, node: ast.expr) -> str | None:
        if isinstance(node, ast.Name):
            if node.id in self.shadowed or node.id in self.symbols.module_shadowed:
                return None
            return self.aliases.get(node.id)
        return self.symbols.resolve_exception(node, shadowed=self.shadowed)


def _path_is_exempt(path: str, options: NoGenericDomainExceptionsOptions) -> bool:
    normalized = PurePosixPath(path.replace("\\", "/"))
    return any(part in options.exempt_path_parts for part in normalized.parts)


def check_no_generic_domain_exceptions(
    source: str,
    *,
    path: str = "<memory>",
    options: NoGenericDomainExceptionsOptions | None = None,
) -> list[Diagnostic]:
    """Return generic exceptions raised by domain service/repository code."""

    configured = options or NoGenericDomainExceptionsOptions()
    if _path_is_exempt(path, configured):
        return []

    module = ast.parse(source, filename=path)
    symbols = _Symbols(module)
    domain_classes = _domain_classes(symbols, configured)
    diagnostics: list[Diagnostic] = []

    for statement in module.body:
        if not isinstance(statement, ast.ClassDef) or statement.name not in domain_classes:
            continue
        for method in statement.body:
            if not isinstance(method, (ast.FunctionDef, ast.AsyncFunctionDef)):
                continue
            if f"{statement.name}.{method.name}" in configured.exempt_methods:
                continue
            if symbols.is_validator(method):
                continue
            visitor = _RaiseVisitor(
                symbols=symbols,
                shadowed=_function_shadowed_names(
                    method, frozenset(symbols.exception_aliases)
                ),
                path=path,
            )
            for body_statement in method.body:
                visitor.visit(body_statement)
            diagnostics.extend(visitor.diagnostics)

    return sorted(diagnostics, key=lambda item: (item.line, item.column))
