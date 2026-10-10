"""Keep transaction control outside repository implementations."""

from __future__ import annotations

import ast
from dataclasses import dataclass
from pathlib import PurePosixPath

from code_contracts.diagnostics import Diagnostic

RULE_NAME = "repositories-do-not-control-transactions"
_TRANSACTION_METHODS = frozenset({"begin", "begin_nested", "commit", "rollback"})


@dataclass(frozen=True, slots=True)
class RepositoriesDoNotControlTransactionsOptions:
    """Configuration for repository discovery and transaction-owner exemptions."""

    repository_suffixes: tuple[str, ...] = ("Repository",)
    transaction_owner_suffixes: tuple[str, ...] = (
        "TransactionManager",
        "UnitOfWork",
    )
    exempt_classes: frozenset[str] = frozenset()


def _diagnostic(path: str, node: ast.AST, operation: str) -> Diagnostic:
    line = getattr(node, "lineno", 1)
    column = getattr(node, "col_offset", 0) + 1
    end_line = getattr(node, "end_lineno", line)
    end_column = getattr(node, "end_col_offset", column - 1) + 1
    return Diagnostic(
        rule=RULE_NAME,
        code="transaction-control",
        message=(
            f"Repositories must not call Session.{operation}(); the application "
            "service or unit of work owns the transaction boundary."
        ),
        path=path,
        line=line,
        column=column,
        end_line=end_line,
        end_column=end_column,
    )


def _module_name(path: str) -> str:
    normalized = PurePosixPath(path.replace("\\", "/"))
    parts = list(normalized.parts)
    if parts and parts[-1].endswith(".py"):
        parts[-1] = parts[-1][:-3]
    if parts and parts[-1] == "__init__":
        parts.pop()
    return ".".join(part for part in parts if part not in {".", ""})


def _qualified_class(path: str, class_name: str) -> str:
    module = _module_name(path)
    return f"{module}.{class_name}" if module else class_name


def _base_name(node: ast.expr) -> str | None:
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        return node.attr
    if isinstance(node, ast.Subscript):
        return _base_name(node.value)
    return None


class _SessionSymbols:
    def __init__(self, module: ast.Module) -> None:
        self.session_types: set[str] = set()
        self.sqlalchemy_namespaces: set[str] = set()
        for statement in module.body:
            if isinstance(statement, ast.Import):
                for alias in statement.names:
                    if alias.name == "sqlalchemy" or alias.name.startswith("sqlalchemy."):
                        self.sqlalchemy_namespaces.add(
                            alias.asname or alias.name.split(".", 1)[0]
                        )
                    elif alias.name == "sqlmodel":
                        self.sqlalchemy_namespaces.add(alias.asname or "sqlmodel")
            elif isinstance(statement, ast.ImportFrom) and statement.module is not None:
                if statement.module in {
                    "sqlalchemy.orm",
                    "sqlalchemy.ext.asyncio",
                    "sqlmodel",
                }:
                    for alias in statement.names:
                        if alias.name in {"Session", "AsyncSession"}:
                            self.session_types.add(alias.asname or alias.name)

        for statement in module.body:
            if isinstance(statement, (ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)):
                self.session_types.discard(statement.name)
                self.sqlalchemy_namespaces.discard(statement.name)
            elif isinstance(statement, ast.Assign):
                for target in statement.targets:
                    if isinstance(target, ast.Name):
                        self.session_types.discard(target.id)
                        self.sqlalchemy_namespaces.discard(target.id)
            elif isinstance(statement, ast.AnnAssign) and isinstance(
                statement.target, ast.Name
            ):
                self.session_types.discard(statement.target.id)
                self.sqlalchemy_namespaces.discard(statement.target.id)

    def is_session_annotation(self, node: ast.AST | None) -> bool:
        if node is None:
            return False
        if isinstance(node, ast.Constant) and isinstance(node.value, str):
            try:
                return self.is_session_annotation(ast.parse(node.value, mode="eval").body)
            except SyntaxError:
                return False
        if isinstance(node, ast.Name):
            return node.id in self.session_types
        if isinstance(node, ast.Attribute):
            if node.attr not in {"Session", "AsyncSession"}:
                return False
            root = node
            while isinstance(root, ast.Attribute):
                root = root.value
            return isinstance(root, ast.Name) and root.id in self.sqlalchemy_namespaces
        if isinstance(node, ast.Subscript):
            return self.is_session_annotation(node.value) or self.is_session_annotation(
                node.slice
            )
        if isinstance(node, ast.BinOp) and isinstance(node.op, ast.BitOr):
            return self.is_session_annotation(node.left) or self.is_session_annotation(
                node.right
            )
        return any(self.is_session_annotation(child) for child in ast.iter_child_nodes(node))


def _repository_classes(
    definitions: dict[str, ast.ClassDef],
    options: RepositoriesDoNotControlTransactionsOptions,
) -> set[str]:
    repositories = {
        name for name in definitions if name.endswith(options.repository_suffixes)
    }
    changed = True
    while changed:
        changed = False
        for name, definition in definitions.items():
            if name in repositories:
                continue
            if any(
                (base := _base_name(candidate)) is not None
                and (
                    base in repositories
                    or base.endswith(options.repository_suffixes)
                )
                for candidate in definition.bases
            ):
                repositories.add(name)
                changed = True
    return repositories


def _is_transaction_owner(
    definition: ast.ClassDef,
    options: RepositoriesDoNotControlTransactionsOptions,
) -> bool:
    if definition.name.endswith(options.transaction_owner_suffixes):
        return True
    return any(
        (name := _base_name(base)) is not None
        and name.endswith(options.transaction_owner_suffixes)
        for base in definition.bases
    )


def _class_session_attributes(
    definition: ast.ClassDef, symbols: _SessionSymbols
) -> set[str]:
    attributes: set[str] = set()
    for statement in definition.body:
        if (
            isinstance(statement, ast.AnnAssign)
            and isinstance(statement.target, ast.Name)
            and symbols.is_session_annotation(statement.annotation)
        ):
            attributes.add(statement.target.id)
        if not isinstance(statement, (ast.FunctionDef, ast.AsyncFunctionDef)):
            continue
        session_parameters = {
            argument.arg
            for argument in [
                *statement.args.posonlyargs,
                *statement.args.args,
                *statement.args.kwonlyargs,
            ]
            if symbols.is_session_annotation(argument.annotation)
        }
        for node in ast.walk(statement):
            if not isinstance(node, (ast.Assign, ast.AnnAssign)):
                continue
            value = node.value
            targets = node.targets if isinstance(node, ast.Assign) else [node.target]
            if isinstance(value, ast.Name) and value.id in session_parameters:
                for target in targets:
                    if (
                        isinstance(target, ast.Attribute)
                        and isinstance(target.value, ast.Name)
                        and target.value.id in {"self", "cls"}
                    ):
                        attributes.add(target.attr)
            if isinstance(node, ast.AnnAssign) and symbols.is_session_annotation(
                node.annotation
            ):
                for target in targets:
                    if (
                        isinstance(target, ast.Attribute)
                        and isinstance(target.value, ast.Name)
                        and target.value.id in {"self", "cls"}
                    ):
                        attributes.add(target.attr)
    return attributes


class _TransactionVisitor(ast.NodeVisitor):
    def __init__(
        self,
        *,
        path: str,
        session_names: set[str],
        session_attributes: set[str],
    ) -> None:
        self.path = path
        self.session_names = session_names
        self.session_attributes = session_attributes
        self.diagnostics: list[Diagnostic] = []

    def visit_Call(self, node: ast.Call) -> None:
        function = node.func
        if (
            isinstance(function, ast.Attribute)
            and function.attr in _TRANSACTION_METHODS
            and self._is_session(function.value)
        ):
            self.diagnostics.append(
                _diagnostic(self.path, function, function.attr)
            )
        self.generic_visit(node)

    def visit_Assign(self, node: ast.Assign) -> None:
        is_session = self._is_session(node.value)
        for target in node.targets:
            if isinstance(target, ast.Name):
                if is_session:
                    self.session_names.add(target.id)
                else:
                    self.session_names.discard(target.id)
        self.generic_visit(node)

    def visit_AnnAssign(self, node: ast.AnnAssign) -> None:
        if isinstance(node.target, ast.Name):
            if node.value is not None and self._is_session(node.value):
                self.session_names.add(node.target.id)
            else:
                self.session_names.discard(node.target.id)
        self.generic_visit(node)

    def visit_FunctionDef(self, node: ast.FunctionDef) -> None:
        return

    visit_AsyncFunctionDef = visit_FunctionDef

    def visit_ClassDef(self, node: ast.ClassDef) -> None:
        return

    def _is_session(self, node: ast.expr) -> bool:
        if isinstance(node, ast.Name):
            return node.id in self.session_names
        return (
            isinstance(node, ast.Attribute)
            and isinstance(node.value, ast.Name)
            and node.value.id in {"self", "cls"}
            and node.attr in self.session_attributes
        )


def check_repositories_do_not_control_transactions(
    source: str,
    *,
    path: str = "<memory>",
    options: RepositoriesDoNotControlTransactionsOptions | None = None,
) -> list[Diagnostic]:
    """Return transaction operations performed by repository classes."""

    configured = options or RepositoriesDoNotControlTransactionsOptions()
    module = ast.parse(source, filename=path)
    symbols = _SessionSymbols(module)
    definitions = {
        statement.name: statement
        for statement in module.body
        if isinstance(statement, ast.ClassDef)
    }
    repositories = _repository_classes(definitions, configured)
    diagnostics: list[Diagnostic] = []

    for name in repositories:
        definition = definitions[name]
        if _is_transaction_owner(definition, configured):
            continue
        identities = {name, _qualified_class(path, name)}
        if identities & configured.exempt_classes:
            continue
        session_attributes = _class_session_attributes(definition, symbols)
        for method in definition.body:
            if not isinstance(method, (ast.FunctionDef, ast.AsyncFunctionDef)):
                continue
            session_names = {
                argument.arg
                for argument in [
                    *method.args.posonlyargs,
                    *method.args.args,
                    *method.args.kwonlyargs,
                ]
                if symbols.is_session_annotation(argument.annotation)
            }
            visitor = _TransactionVisitor(
                path=path,
                session_names=session_names,
                session_attributes=session_attributes,
            )
            for statement in method.body:
                visitor.visit(statement)
            diagnostics.extend(visitor.diagnostics)

    return sorted(diagnostics, key=lambda item: (item.line, item.column))
