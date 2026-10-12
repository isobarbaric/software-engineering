from __future__ import annotations

import ast

from code_contracts.diagnostics import Diagnostic

RULE_NAME = "no-underscore-pydantic-model-names"
MODEL_BASES = frozenset({
    "pydantic.BaseModel",
    "pydantic.RootModel",
    "pydantic.main.BaseModel",
    "pydantic.root_model.RootModel",
    "pydantic.v1.BaseModel",
    "pydantic.v1.main.BaseModel",
    "pydantic.generics.GenericModel",
    "pydantic.v1.generics.GenericModel",
})


class _ModelNameChecker(ast.NodeVisitor):
    def __init__(self, path: str) -> None:
        self.path = path
        self.bindings: dict[str, str] = {}
        self.diagnostics: list[Diagnostic] = []

    def resolve(self, node: ast.AST) -> str:
        if isinstance(node, ast.Name):
            return self.bindings.get(node.id, "")
        if isinstance(node, ast.Attribute):
            owner = self.resolve(node.value)
            return f"{owner}.{node.attr}" if owner else ""
        if isinstance(node, ast.Subscript):
            return self.resolve(node.value)
        return ""

    def visit_Import(self, node: ast.Import) -> None:
        for alias in node.names:
            name = alias.asname or alias.name.split(".")[0]
            self.bindings[name] = alias.name if alias.asname else name

    def visit_ImportFrom(self, node: ast.ImportFrom) -> None:
        for alias in node.names:
            self.bindings[alias.asname or alias.name] = (
                f"{node.module}.{alias.name}" if not node.level else ""
            )

    def visit_Assign(self, node: ast.Assign) -> None:
        value = self.resolve(node.value)
        for target in node.targets:
            for binding in ast.walk(target):
                if isinstance(binding, ast.Name) and isinstance(binding.ctx, ast.Store):
                    self.bindings[binding.id] = value if target is binding else ""

    def visit_AnnAssign(self, node: ast.AnnAssign) -> None:
        if isinstance(node.target, ast.Name) and node.value is not None:
            self.bindings[node.target.id] = self.resolve(node.value)

    def visit_ClassDef(self, node: ast.ClassDef) -> None:
        is_model = any(self.resolve(base) in MODEL_BASES for base in node.bases)
        if is_model and node.name.startswith("_"):
            self.diagnostics.append(Diagnostic(
                rule=RULE_NAME,
                code="underscore-model-name",
                message=(
                    f"Pydantic model '{node.name}' must not begin with an underscore; "
                    "use a class name without a leading underscore, even for internal models."
                ),
                path=self.path,
                line=node.lineno,
                column=node.col_offset + 1,
                end_line=node.lineno,
                end_column=node.col_offset + len("class ") + len(node.name) + 1,
            ))
        outer = self.bindings
        self.bindings = outer.copy()
        for statement in node.body:
            self.visit(statement)
        self.bindings = outer
        self.bindings[node.name] = "pydantic.BaseModel" if is_model else ""

    def visit_FunctionDef(self, node: ast.FunctionDef | ast.AsyncFunctionDef) -> None:
        self.bindings[node.name] = ""
        outer = self.bindings
        self.bindings = outer.copy()
        arguments = [*node.args.posonlyargs, *node.args.args, *node.args.kwonlyargs]
        if node.args.vararg:
            arguments.append(node.args.vararg)
        if node.args.kwarg:
            arguments.append(node.args.kwarg)
        for argument in arguments:
            self.bindings[argument.arg] = ""
        for statement in node.body:
            self.visit(statement)
        self.bindings = outer

    visit_AsyncFunctionDef = visit_FunctionDef


def check_no_underscore_pydantic_model_names(
    source: str, *, path: str = "<unknown>"
) -> list[Diagnostic]:
    checker = _ModelNameChecker(path)
    checker.visit(ast.parse(source, filename=path))
    return checker.diagnostics
