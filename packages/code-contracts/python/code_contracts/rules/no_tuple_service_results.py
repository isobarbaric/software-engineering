"""Require named Pydantic models for multi-value service results."""

from __future__ import annotations

import ast
from dataclasses import dataclass
from typing import Iterable, Literal

from code_contracts.diagnostics import Diagnostic

RULE_NAME = "no-tuple-service-results"


@dataclass(frozen=True, slots=True)
class NoTupleServiceResultsOptions:
    """Configuration for service discovery and narrow protocol exemptions."""

    service_suffixes: tuple[str, ...] = ("Service",)
    exempt_methods: frozenset[str] = frozenset()


@dataclass(frozen=True, slots=True)
class _Value:
    kind: Literal["tuple", "non-pydantic-result", "other"]
    node: ast.AST
    result_name: str | None = None


class _Symbols:
    def __init__(self, module: ast.Module) -> None:
        self.tuple_names = {"tuple"}
        self.typing_namespaces: set[str] = set()
        self.pydantic_base_names: set[str] = set()
        self.pydantic_namespaces: set[str] = set()
        self.named_tuple_names: set[str] = set()
        self.typed_dict_names: set[str] = set()
        self.class_definitions: dict[str, ast.ClassDef] = {}
        self.functional_non_pydantic_results: set[str] = set()

        for statement in module.body:
            if isinstance(statement, ast.Import):
                self._record_import(statement)
            elif isinstance(statement, ast.ImportFrom):
                self._record_import_from(statement)
            elif isinstance(statement, ast.ClassDef):
                self.class_definitions[statement.name] = statement
            elif isinstance(statement, (ast.Assign, ast.AnnAssign)):
                self._record_functional_result(statement)

        self.pydantic_classes = self._resolve_pydantic_classes()
        self.non_pydantic_results = self._resolve_non_pydantic_results()

    def _record_import(self, statement: ast.Import) -> None:
        for alias in statement.names:
            binding = alias.asname or alias.name.split(".", 1)[0]
            if alias.name == "typing":
                self.typing_namespaces.add(binding)
            elif alias.name == "pydantic":
                self.pydantic_namespaces.add(binding)

    def _record_import_from(self, statement: ast.ImportFrom) -> None:
        if statement.module == "typing":
            for alias in statement.names:
                binding = alias.asname or alias.name
                if alias.name == "Tuple":
                    self.tuple_names.add(binding)
                elif alias.name == "NamedTuple":
                    self.named_tuple_names.add(binding)
                elif alias.name == "TypedDict":
                    self.typed_dict_names.add(binding)
        elif statement.module == "pydantic":
            for alias in statement.names:
                if alias.name == "BaseModel":
                    self.pydantic_base_names.add(alias.asname or alias.name)

    def _record_functional_result(self, statement: ast.Assign | ast.AnnAssign) -> None:
        value = statement.value
        if value is None or not isinstance(value, ast.Call):
            return

        target_names: list[str] = []
        if isinstance(statement, ast.Assign):
            target_names = [
                target.id
                for target in statement.targets
                if isinstance(target, ast.Name)
            ]
        elif isinstance(statement.target, ast.Name):
            target_names = [statement.target.id]

        if not target_names or not self._is_non_pydantic_factory(value.func):
            return

        self.functional_non_pydantic_results.update(
            name for name in target_names if name.endswith("Result")
        )

    def _is_non_pydantic_factory(self, node: ast.expr) -> bool:
        if isinstance(node, ast.Name):
            return node.id in self.named_tuple_names | self.typed_dict_names
        if isinstance(node, ast.Attribute) and isinstance(node.value, ast.Name):
            return node.value.id in self.typing_namespaces and node.attr in {
                "NamedTuple",
                "TypedDict",
            }
        return False

    def _resolve_pydantic_classes(self) -> set[str]:
        pydantic_classes: set[str] = set()
        changed = True
        while changed:
            changed = False
            for name, definition in self.class_definitions.items():
                if name in pydantic_classes:
                    continue
                if any(
                    self._is_pydantic_base(base, pydantic_classes)
                    for base in definition.bases
                ):
                    pydantic_classes.add(name)
                    changed = True
        return pydantic_classes

    def _is_pydantic_base(self, node: ast.expr, known: set[str]) -> bool:
        if isinstance(node, ast.Name):
            return node.id in self.pydantic_base_names or node.id in known
        return (
            isinstance(node, ast.Attribute)
            and isinstance(node.value, ast.Name)
            and node.value.id in self.pydantic_namespaces
            and node.attr == "BaseModel"
        )

    def _resolve_non_pydantic_results(self) -> set[str]:
        return self.functional_non_pydantic_results | {
            name
            for name in self.class_definitions
            if name.endswith("Result") and name not in self.pydantic_classes
        }

    def is_tuple_annotation(self, node: ast.AST) -> bool:
        if isinstance(node, ast.Name):
            return node.id in self.tuple_names
        return (
            isinstance(node, ast.Attribute)
            and isinstance(node.value, ast.Name)
            and node.value.id in self.typing_namespaces
            and node.attr == "Tuple"
        )

    def is_tuple_constructor(self, node: ast.expr) -> bool:
        return isinstance(node, ast.Name) and node.id == "tuple"


def _first_tuple_annotation(node: ast.AST | None, symbols: _Symbols) -> ast.AST | None:
    if node is None:
        return None
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        try:
            parsed = ast.parse(node.value, mode="eval").body
        except SyntaxError:
            return None
        return _first_tuple_annotation(parsed, symbols)
    if symbols.is_tuple_annotation(node):
        return node
    for child in ast.iter_child_nodes(node):
        found = _first_tuple_annotation(child, symbols)
        if found is not None:
            return found
    return None


def _first_non_pydantic_result(
    node: ast.AST | None, symbols: _Symbols
) -> tuple[str, ast.AST] | None:
    if node is None:
        return None
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        try:
            parsed = ast.parse(node.value, mode="eval").body
        except SyntaxError:
            return None
        return _first_non_pydantic_result(parsed, symbols)
    if isinstance(node, ast.Name) and node.id in symbols.non_pydantic_results:
        return node.id, node
    for child in ast.iter_child_nodes(node):
        found = _first_non_pydantic_result(child, symbols)
        if found is not None:
            return found
    return None


def _value(
    expression: ast.expr | None, env: dict[str, _Value], symbols: _Symbols
) -> _Value:
    if expression is None:
        return _Value("other", ast.Constant(value=None))
    if isinstance(expression, ast.Tuple):
        return _Value("tuple", expression)
    if isinstance(expression, ast.Name):
        return env.get(expression.id, _Value("other", expression))
    if isinstance(expression, ast.Call):
        if symbols.is_tuple_constructor(expression.func):
            return _Value("tuple", expression)
        if isinstance(expression.func, ast.Name):
            name = expression.func.id
            if name in symbols.non_pydantic_results:
                return _Value("non-pydantic-result", expression, name)
    return _Value("other", expression)


def _assigned_names(target: ast.expr) -> Iterable[str]:
    if isinstance(target, ast.Name):
        yield target.id
    elif isinstance(target, (ast.Tuple, ast.List)):
        for element in target.elts:
            yield from _assigned_names(element)


def _diagnostic(*, path: str, code: str, message: str, node: ast.AST) -> Diagnostic:
    line = getattr(node, "lineno", 1)
    column = getattr(node, "col_offset", 0) + 1
    end_line = getattr(node, "end_lineno", line)
    end_column = getattr(node, "end_col_offset", column - 1) + 1
    return Diagnostic(
        rule=RULE_NAME,
        code=code,
        message=message,
        path=path,
        line=line,
        column=column,
        end_line=end_line,
        end_column=end_column,
    )


def _check_return_value(
    expression: ast.expr | None,
    *,
    env: dict[str, _Value],
    symbols: _Symbols,
    path: str,
) -> list[Diagnostic]:
    value = _value(expression, env, symbols)
    if value.kind == "tuple":
        return [
            _diagnostic(
                path=path,
                code="tuple-return-value",
                message=(
                    "Public service methods must return a named Pydantic result "
                    "model instead of a tuple value."
                ),
                node=value.node,
            )
        ]
    if value.kind == "non-pydantic-result":
        return [
            _diagnostic(
                path=path,
                code="non-pydantic-result",
                message=(
                    f"{value.result_name} must inherit from pydantic.BaseModel; "
                    "dataclasses and other structural result envelopes are not "
                    "service contracts."
                ),
                node=value.node,
            )
        ]
    return []


def _check_statements(
    statements: list[ast.stmt],
    *,
    env: dict[str, _Value],
    symbols: _Symbols,
    path: str,
) -> tuple[list[Diagnostic], dict[str, _Value]]:
    diagnostics: list[Diagnostic] = []
    current = dict(env)

    for statement in statements:
        if isinstance(statement, ast.Return):
            diagnostics.extend(
                _check_return_value(
                    statement.value, env=current, symbols=symbols, path=path
                )
            )
        elif isinstance(statement, ast.Assign):
            value = _value(statement.value, current, symbols)
            for target in statement.targets:
                for name in _assigned_names(target):
                    current[name] = value
        elif isinstance(statement, ast.AnnAssign):
            value = _value(statement.value, current, symbols)
            for name in _assigned_names(statement.target):
                current[name] = value
        elif isinstance(statement, ast.If):
            body_diagnostics, body_env = _check_statements(
                statement.body, env=current, symbols=symbols, path=path
            )
            else_diagnostics, else_env = _check_statements(
                statement.orelse, env=current, symbols=symbols, path=path
            )
            diagnostics.extend(body_diagnostics)
            diagnostics.extend(else_diagnostics)
            current = {
                name: body_env[name]
                for name in body_env.keys() & else_env.keys()
                if body_env[name].kind == else_env[name].kind
                and body_env[name].result_name == else_env[name].result_name
            }
        elif isinstance(statement, (ast.With, ast.AsyncWith)):
            nested, current = _check_statements(
                statement.body, env=current, symbols=symbols, path=path
            )
            diagnostics.extend(nested)
        elif isinstance(statement, (ast.For, ast.AsyncFor, ast.While)):
            nested, _ = _check_statements(
                statement.body, env=current, symbols=symbols, path=path
            )
            alternate, _ = _check_statements(
                statement.orelse, env=current, symbols=symbols, path=path
            )
            diagnostics.extend(nested)
            diagnostics.extend(alternate)
        elif isinstance(statement, ast.Try):
            for branch in [statement.body, statement.orelse, statement.finalbody]:
                nested, _ = _check_statements(
                    branch, env=current, symbols=symbols, path=path
                )
                diagnostics.extend(nested)
            for handler in statement.handlers:
                nested, _ = _check_statements(
                    handler.body, env=current, symbols=symbols, path=path
                )
                diagnostics.extend(nested)
        elif isinstance(statement, ast.Match):
            for case in statement.cases:
                nested, _ = _check_statements(
                    case.body, env=current, symbols=symbols, path=path
                )
                diagnostics.extend(nested)

    return diagnostics, current


def _service_classes(
    module: ast.Module, options: NoTupleServiceResultsOptions
) -> set[str]:
    definitions = {
        statement.name: statement
        for statement in module.body
        if isinstance(statement, ast.ClassDef)
    }
    services = {name for name in definitions if name.endswith(options.service_suffixes)}
    changed = True
    while changed:
        changed = False
        for name, definition in definitions.items():
            if name in services:
                continue
            if any(
                isinstance(base, ast.Name)
                and (base.id in services or base.id.endswith(options.service_suffixes))
                for base in definition.bases
            ):
                services.add(name)
                changed = True
    return services


def check_no_tuple_service_results(
    source: str,
    *,
    path: str = "<memory>",
    options: NoTupleServiceResultsOptions | None = None,
) -> list[Diagnostic]:
    """Return violations of the public service-result contract."""

    configured = options or NoTupleServiceResultsOptions()
    module = ast.parse(source, filename=path)
    symbols = _Symbols(module)
    services = _service_classes(module, configured)
    diagnostics: list[Diagnostic] = []

    for statement in module.body:
        if not isinstance(statement, ast.ClassDef) or statement.name not in services:
            continue
        for method in statement.body:
            if not isinstance(method, (ast.FunctionDef, ast.AsyncFunctionDef)):
                continue
            if method.name.startswith("_"):
                continue
            identity = f"{statement.name}.{method.name}"
            if identity in configured.exempt_methods:
                continue

            tuple_annotation = _first_tuple_annotation(method.returns, symbols)
            if tuple_annotation is not None:
                diagnostics.append(
                    _diagnostic(
                        path=path,
                        code="tuple-return-annotation",
                        message=(
                            "Public service methods must annotate multi-value "
                            "results with a named Pydantic model, not tuple."
                        ),
                        node=tuple_annotation,
                    )
                )

            non_pydantic_result = _first_non_pydantic_result(method.returns, symbols)
            if non_pydantic_result is not None:
                result_name, node = non_pydantic_result
                diagnostics.append(
                    _diagnostic(
                        path=path,
                        code="non-pydantic-result",
                        message=(
                            f"{result_name} must inherit from pydantic.BaseModel; "
                            "dataclasses and other structural result envelopes are "
                            "not service contracts."
                        ),
                        node=node,
                    )
                )

            value_diagnostics, _ = _check_statements(
                method.body, env={}, symbols=symbols, path=path
            )
            diagnostics.extend(value_diagnostics)

    return sorted(
        diagnostics, key=lambda diagnostic: (diagnostic.line, diagnostic.column)
    )
