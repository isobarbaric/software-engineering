"""Require symbolic model attributes in SQLAlchemy column-selection APIs."""

from __future__ import annotations

import ast
from dataclasses import dataclass

from code_contracts.diagnostics import Diagnostic

RULE_NAME = "sqlalchemy-query-columns-use-model-attributes"
_DEFAULT_QUERY_FUNCTIONS = frozenset(
    {
        "contains_eager",
        "defer",
        "joinedload",
        "load_only",
        "select",
        "selectinload",
        "subqueryload",
        "undefer",
    }
)
_DEFAULT_QUERY_METHODS = frozenset({"group_by", "order_by"})
_QUERY_CONSTRUCTORS = frozenset({"select"})


@dataclass(frozen=True, slots=True)
class SqlalchemyQueryColumnsUseModelAttributesOptions:
    """Configured SQLAlchemy APIs whose positional arguments are columns."""

    query_functions: frozenset[str] = _DEFAULT_QUERY_FUNCTIONS
    query_methods: frozenset[str] = _DEFAULT_QUERY_METHODS


def _diagnostic(
    path: str, node: ast.Constant, model_name: str | None
) -> Diagnostic:
    line = node.lineno
    column = node.col_offset + 1
    owner = model_name or "Model"
    return Diagnostic(
        rule=RULE_NAME,
        code="string-column-reference",
        message=(
            f"Use a symbolic {owner}.{node.value} attribute instead of the string "
            f"column reference {node.value!r}."
        ),
        path=path,
        line=line,
        column=column,
        end_line=node.end_lineno or line,
        end_column=(node.end_col_offset or node.col_offset) + 1,
    )


class _Symbols:
    def __init__(
        self,
        module: ast.Module,
        options: SqlalchemyQueryColumnsUseModelAttributesOptions,
    ) -> None:
        self.options = options
        self.function_bindings: dict[str, str] = {}
        self.sqlalchemy_namespaces: set[str] = set()
        self.orm_namespaces: set[str] = set()
        self.session_types: set[str] = set()
        self.query_types: set[str] = set()
        shadowed: set[str] = set()

        for statement in module.body:
            if isinstance(statement, ast.Import):
                for alias in statement.names:
                    binding = alias.asname or alias.name.split(".", 1)[0]
                    if alias.name == "sqlalchemy":
                        self.sqlalchemy_namespaces.add(binding)
                    elif alias.name == "sqlalchemy.orm":
                        self.orm_namespaces.add(binding)
            elif isinstance(statement, ast.ImportFrom) and statement.module is not None:
                if statement.module == "sqlalchemy" or statement.module.startswith(
                    "sqlalchemy."
                ):
                    for alias in statement.names:
                        binding = alias.asname or alias.name
                        if alias.name in options.query_functions:
                            self.function_bindings[binding] = alias.name
                        if alias.name in {"Session", "AsyncSession"}:
                            self.session_types.add(binding)
                        if alias.name == "Query":
                            self.query_types.add(binding)
            elif isinstance(statement, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
                shadowed.add(statement.name)

        for name in shadowed:
            self.function_bindings.pop(name, None)
            self.session_types.discard(name)
            self.query_types.discard(name)

    def function_name(self, node: ast.expr) -> str | None:
        if isinstance(node, ast.Name):
            return self.function_bindings.get(node.id)
        if isinstance(node, ast.Attribute) and isinstance(node.value, ast.Name):
            if node.value.id in self.sqlalchemy_namespaces | self.orm_namespaces:
                return node.attr if node.attr in self.options.query_functions else None
        return None

    def is_type(self, node: ast.AST | None, names: set[str]) -> bool:
        if node is None:
            return False
        if isinstance(node, ast.Constant) and isinstance(node.value, str):
            try:
                return self.is_type(ast.parse(node.value, mode="eval").body, names)
            except SyntaxError:
                return False
        if isinstance(node, ast.Name):
            return node.id in names
        if isinstance(node, ast.Attribute):
            root = node
            while isinstance(root, ast.Attribute):
                root = root.value
            return (
                isinstance(root, ast.Name)
                and root.id in self.orm_namespaces | self.sqlalchemy_namespaces
                and node.attr in {"Session", "AsyncSession", "Query"}
            )
        if isinstance(node, ast.Subscript):
            return self.is_type(node.value, names)
        return False


class _QueryVisitor(ast.NodeVisitor):
    def __init__(
        self,
        *,
        path: str,
        symbols: _Symbols,
        options: SqlalchemyQueryColumnsUseModelAttributesOptions,
    ) -> None:
        self.path = path
        self.symbols = symbols
        self.options = options
        self.query_names: list[set[str]] = [set()]
        self.session_names: list[set[str]] = [set()]
        self.diagnostics: list[Diagnostic] = []

    def visit_FunctionDef(self, node: ast.FunctionDef) -> None:
        query_parameters = {
            argument.arg
            for argument in [
                *node.args.posonlyargs,
                *node.args.args,
                *node.args.kwonlyargs,
            ]
            if self.symbols.is_type(argument.annotation, self.symbols.query_types)
        }
        session_parameters = {
            argument.arg
            for argument in [
                *node.args.posonlyargs,
                *node.args.args,
                *node.args.kwonlyargs,
            ]
            if self.symbols.is_type(argument.annotation, self.symbols.session_types)
        }
        self.query_names.append(query_parameters)
        self.session_names.append(session_parameters)
        for statement in node.body:
            self.visit(statement)
        self.session_names.pop()
        self.query_names.pop()

    visit_AsyncFunctionDef = visit_FunctionDef

    def visit_Assign(self, node: ast.Assign) -> None:
        if self._is_query_expression(node.value):
            for target in node.targets:
                if isinstance(target, ast.Name):
                    self.query_names[-1].add(target.id)
        self.generic_visit(node)

    def visit_AnnAssign(self, node: ast.AnnAssign) -> None:
        if isinstance(node.target, ast.Name):
            if self.symbols.is_type(node.annotation, self.symbols.query_types) or (
                node.value is not None and self._is_query_expression(node.value)
            ):
                self.query_names[-1].add(node.target.id)
        self.generic_visit(node)

    def visit_Call(self, node: ast.Call) -> None:
        function_name = self.symbols.function_name(node.func)
        if function_name in self.options.query_functions:
            self._report_string_arguments(node)
        elif (
            isinstance(node.func, ast.Attribute)
            and node.func.attr in self.options.query_methods
            and self._is_query_expression(node.func.value)
        ):
            self._report_string_arguments(node)
        self.generic_visit(node)

    def _report_string_arguments(self, node: ast.Call) -> None:
        model_name = self._model_name(node)
        for argument in node.args:
            if isinstance(argument, ast.Constant) and isinstance(argument.value, str):
                self.diagnostics.append(
                    _diagnostic(self.path, argument, model_name)
                )

    def _model_name(self, node: ast.Call) -> str | None:
        pending: ast.expr = node
        while isinstance(pending, ast.Call):
            for argument in pending.args:
                if isinstance(argument, ast.Name) and argument.id[:1].isupper():
                    return argument.id
            if not isinstance(pending.func, ast.Attribute):
                break
            pending = pending.func.value
        return None

    def _is_query_expression(self, node: ast.expr) -> bool:
        if isinstance(node, ast.Name):
            return any(node.id in names for names in reversed(self.query_names))
        if not isinstance(node, ast.Call):
            return False
        function_name = self.symbols.function_name(node.func)
        if function_name in _QUERY_CONSTRUCTORS:
            return True
        if not isinstance(node.func, ast.Attribute):
            return False
        if node.func.attr == "query" and isinstance(node.func.value, ast.Name):
            return any(
                node.func.value.id in names
                for names in reversed(self.session_names)
            )
        return self._is_query_expression(node.func.value)


def check_sqlalchemy_query_columns_use_model_attributes(
    source: str,
    *,
    path: str = "<memory>",
    options: SqlalchemyQueryColumnsUseModelAttributesOptions | None = None,
) -> list[Diagnostic]:
    """Return literal strings passed where SQLAlchemy expects attributes."""

    configured = options or SqlalchemyQueryColumnsUseModelAttributesOptions()
    module = ast.parse(source, filename=path)
    symbols = _Symbols(module, configured)
    visitor = _QueryVisitor(path=path, symbols=symbols, options=configured)
    visitor.visit(module)
    return sorted(visitor.diagnostics, key=lambda item: (item.line, item.column))
