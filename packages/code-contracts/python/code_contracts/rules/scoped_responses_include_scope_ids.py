"""Require explicit scope identifiers on configured Pydantic response models."""

from __future__ import annotations

import ast
from dataclasses import dataclass
from pathlib import PurePosixPath
from typing import Literal

from code_contracts.diagnostics import Diagnostic

RULE_NAME = "scoped-responses-include-scope-ids"


@dataclass(frozen=True, slots=True)
class ScopedResponsesIncludeScopeIdsOptions:
    """Explicit selectors for organization- and project-scoped responses."""

    organization_scoped_bases: frozenset[str] = frozenset()
    organization_scoped_packages: tuple[str, ...] = ()
    organization_scoped_models: frozenset[str] = frozenset()
    project_scoped_bases: frozenset[str] = frozenset()
    project_scoped_packages: tuple[str, ...] = ()
    project_scoped_models: frozenset[str] = frozenset()
    generic_wrapper_bases: frozenset[str] = frozenset()


@dataclass(frozen=True, slots=True)
class _Field:
    node: ast.AnnAssign
    annotation: ast.expr
    value: ast.expr | None


def _module_name(path: str) -> str:
    normalized = PurePosixPath(path.replace("\\", "/"))
    parts = list(normalized.parts)
    if parts and parts[-1].endswith(".py"):
        parts[-1] = parts[-1][:-3]
    if parts and parts[-1] == "__init__":
        parts.pop()
    return ".".join(part for part in parts if part not in {"", "."})


def _qualified(module_name: str, class_name: str) -> str:
    return f"{module_name}.{class_name}" if module_name else class_name


def _dotted_name(node: ast.AST) -> str | None:
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        prefix = _dotted_name(node.value)
        return f"{prefix}.{node.attr}" if prefix else node.attr
    if isinstance(node, ast.Subscript):
        return _dotted_name(node.value)
    return None


class _Symbols:
    def __init__(self, module: ast.Module) -> None:
        self.pydantic_bases: set[str] = set()
        self.pydantic_namespaces: set[str] = set()
        self.field_names: set[str] = set()
        self.uuid_names: set[str] = set()
        self.uuid_namespaces: set[str] = set()
        self.typing_namespaces: set[str] = set()
        self.annotated_names: set[str] = set()
        self.class_var_names: set[str] = set()
        self.generic_names: set[str] = set()
        self.type_var_factories: set[str] = set()
        self.abc_names: set[str] = set()
        self.abstractmethod_names: set[str] = set()
        self.imported_bindings: dict[str, str] = {}
        self.type_variables: set[str] = set()

        for statement in module.body:
            if isinstance(statement, ast.Import):
                for alias in statement.names:
                    binding = alias.asname or alias.name.split(".", 1)[0]
                    self.imported_bindings[binding] = alias.name
                    if alias.name in {"pydantic", "pydantic.v1"}:
                        self.pydantic_namespaces.add(binding)
                    elif alias.name == "uuid":
                        self.uuid_namespaces.add(binding)
                    elif alias.name == "typing":
                        self.typing_namespaces.add(binding)
            elif isinstance(statement, ast.ImportFrom) and statement.module is not None:
                for alias in statement.names:
                    binding = alias.asname or alias.name
                    self.imported_bindings[binding] = f"{statement.module}.{alias.name}"
                    if statement.module in {"pydantic", "pydantic.v1"}:
                        if alias.name == "BaseModel":
                            self.pydantic_bases.add(binding)
                        elif alias.name == "Field":
                            self.field_names.add(binding)
                    elif statement.module == "uuid" and alias.name == "UUID":
                        self.uuid_names.add(binding)
                    elif statement.module == "typing":
                        if alias.name == "Annotated":
                            self.annotated_names.add(binding)
                        elif alias.name == "ClassVar":
                            self.class_var_names.add(binding)
                        elif alias.name == "Generic":
                            self.generic_names.add(binding)
                        elif alias.name == "TypeVar":
                            self.type_var_factories.add(binding)
                    elif statement.module == "abc":
                        if alias.name == "ABC":
                            self.abc_names.add(binding)
                        elif alias.name == "abstractmethod":
                            self.abstractmethod_names.add(binding)

        for statement in module.body:
            if not isinstance(statement, (ast.Assign, ast.AnnAssign)):
                continue
            value = statement.value
            if not isinstance(value, ast.Call) or not self._is_type_var_factory(value.func):
                continue
            targets = statement.targets if isinstance(statement, ast.Assign) else [statement.target]
            for target in targets:
                if isinstance(target, ast.Name):
                    self.type_variables.add(target.id)

    def _is_type_var_factory(self, node: ast.expr) -> bool:
        if isinstance(node, ast.Name):
            return node.id in self.type_var_factories
        return (
            isinstance(node, ast.Attribute)
            and isinstance(node.value, ast.Name)
            and node.value.id in self.typing_namespaces
            and node.attr == "TypeVar"
        )

    def imported_identity(self, node: ast.expr) -> str | None:
        if isinstance(node, ast.Name):
            return self.imported_bindings.get(node.id)
        dotted = _dotted_name(node)
        if dotted is None:
            return None
        root, _, remainder = dotted.partition(".")
        imported = self.imported_bindings.get(root)
        if imported is None:
            return None
        return f"{imported}.{remainder}" if remainder else imported

    def is_pydantic_base(self, node: ast.expr, local_models: set[str]) -> bool:
        if isinstance(node, ast.Name):
            return node.id in self.pydantic_bases or node.id in local_models
        if isinstance(node, ast.Subscript):
            return self.is_pydantic_base(node.value, local_models)
        return (
            isinstance(node, ast.Attribute)
            and isinstance(node.value, ast.Name)
            and node.value.id in self.pydantic_namespaces
            and node.attr == "BaseModel"
        )

    def is_uuid(self, node: ast.expr) -> bool:
        if isinstance(node, ast.Constant) and isinstance(node.value, str):
            try:
                return self.is_uuid(ast.parse(node.value, mode="eval").body)
            except SyntaxError:
                return False
        if isinstance(node, ast.Name):
            return node.id in self.uuid_names
        if (
            isinstance(node, ast.Attribute)
            and isinstance(node.value, ast.Name)
            and node.value.id in self.uuid_namespaces
            and node.attr == "UUID"
        ):
            return True
        if isinstance(node, ast.Subscript) and self._is_annotated(node.value):
            elements = node.slice.elts if isinstance(node.slice, ast.Tuple) else [node.slice]
            return bool(elements) and self.is_uuid(elements[0])
        return False

    def is_class_var(self, node: ast.expr) -> bool:
        if not isinstance(node, ast.Subscript):
            return False
        if isinstance(node.value, ast.Name):
            return node.value.id in self.class_var_names
        return (
            isinstance(node.value, ast.Attribute)
            and isinstance(node.value.value, ast.Name)
            and node.value.value.id in self.typing_namespaces
            and node.value.attr == "ClassVar"
        )

    def field_calls(self, node: ast.AST | None) -> list[ast.Call]:
        if node is None:
            return []
        calls: list[ast.Call] = []
        for candidate in ast.walk(node):
            if not isinstance(candidate, ast.Call):
                continue
            if isinstance(candidate.func, ast.Name) and candidate.func.id in self.field_names:
                calls.append(candidate)
            elif (
                isinstance(candidate.func, ast.Attribute)
                and isinstance(candidate.func.value, ast.Name)
                and candidate.func.value.id in self.pydantic_namespaces
                and candidate.func.attr == "Field"
            ):
                calls.append(candidate)
        return calls

    def is_generic_base(self, node: ast.expr) -> bool:
        if not isinstance(node, ast.Subscript):
            return False
        value = node.value
        is_generic = (
            isinstance(value, ast.Name) and value.id in self.generic_names
        ) or (
            isinstance(value, ast.Attribute)
            and isinstance(value.value, ast.Name)
            and value.value.id in self.typing_namespaces
            and value.attr == "Generic"
        )
        if not is_generic:
            return False
        elements = node.slice.elts if isinstance(node.slice, ast.Tuple) else [node.slice]
        return any(isinstance(element, ast.Name) and element.id in self.type_variables for element in elements)

    def _is_annotated(self, node: ast.expr) -> bool:
        if isinstance(node, ast.Name):
            return node.id in self.annotated_names
        return (
            isinstance(node, ast.Attribute)
            and isinstance(node.value, ast.Name)
            and node.value.id in self.typing_namespaces
            and node.attr == "Annotated"
        )


def _pydantic_models(
    definitions: dict[str, ast.ClassDef], symbols: _Symbols
) -> set[str]:
    models: set[str] = set()
    changed = True
    while changed:
        changed = False
        for name, definition in definitions.items():
            if name in models:
                continue
            if any(symbols.is_pydantic_base(base, models) for base in definition.bases):
                models.add(name)
                changed = True
    return models


def _package_matches(module_name: str, packages: tuple[str, ...]) -> bool:
    return any(
        module_name == package or module_name.startswith(f"{package}.")
        for package in packages
    )


def _model_selected(
    name: str, module_name: str, selectors: frozenset[str]
) -> bool:
    identities = {name, _qualified(module_name, name)}
    if module_name.endswith(".models"):
        identities.add(_qualified(module_name.removesuffix(".models"), name))
    return bool(identities & selectors)


def _base_selector_matches(
    base: ast.expr,
    *,
    selectors: frozenset[str],
    symbols: _Symbols,
) -> bool:
    local_name = _dotted_name(base)
    imported = symbols.imported_identity(base)
    return (local_name is not None and local_name in selectors) or (
        imported is not None and imported in selectors
    )


def _selected_descendants(
    definitions: dict[str, ast.ClassDef],
    selectors: frozenset[str],
    symbols: _Symbols,
) -> tuple[set[str], dict[str, set[str]]]:
    selected: set[str] = set()
    imported_guarantees: dict[str, set[str]] = {}
    changed = True
    while changed:
        changed = False
        for name, definition in definitions.items():
            direct_selected = False
            guarantees: set[str] = set()
            for base in definition.bases:
                local = _dotted_name(base)
                imported = symbols.imported_identity(base)
                if local in selected:
                    direct_selected = True
                    guarantees.update(imported_guarantees.get(local, set()))
                if _base_selector_matches(base, selectors=selectors, symbols=symbols):
                    direct_selected = True
                    if imported is not None:
                        guarantees.add(imported)
            if direct_selected and name not in selected:
                selected.add(name)
                imported_guarantees[name] = guarantees
                changed = True
    return selected, imported_guarantees


def _fields_for(
    name: str,
    definitions: dict[str, ast.ClassDef],
    cache: dict[str, dict[str, _Field]],
    active: set[str] | None = None,
) -> dict[str, _Field]:
    if name in cache:
        return cache[name]
    active = set() if active is None else set(active)
    if name in active:
        return {}
    active.add(name)
    definition = definitions[name]
    fields: dict[str, _Field] = {}
    for base in definition.bases:
        base_name = _dotted_name(base)
        if base_name in definitions:
            fields.update(_fields_for(base_name, definitions, cache, active))
    for statement in definition.body:
        if isinstance(statement, ast.AnnAssign) and isinstance(statement.target, ast.Name):
            fields[statement.target.id] = _Field(
                node=statement,
                annotation=statement.annotation,
                value=statement.value,
            )
    cache[name] = fields
    return fields


def _literal_true(node: ast.expr) -> bool:
    return isinstance(node, ast.Constant) and node.value is True


def _field_is_valid(field: _Field, symbols: _Symbols) -> bool:
    if symbols.is_class_var(field.annotation) or not symbols.is_uuid(field.annotation):
        return False
    calls = symbols.field_calls(field.annotation) + symbols.field_calls(field.value)
    for call in calls:
        for keyword in call.keywords:
            if keyword.arg in {"alias", "serialization_alias", "default_factory"}:
                return False
            if keyword.arg == "exclude" and _literal_true(keyword.value):
                return False
            if keyword.arg == "default" and not (
                isinstance(keyword.value, ast.Constant)
                and keyword.value.value is Ellipsis
            ):
                return False
    if field.value is None:
        return True
    if not isinstance(field.value, ast.Call) or field.value not in calls:
        return False
    if not field.value.args:
        return not any(keyword.arg == "default" for keyword in field.value.keywords)
    return (
        len(field.value.args) == 1
        and isinstance(field.value.args[0], ast.Constant)
        and field.value.args[0].value is Ellipsis
    )


def _is_generic_wrapper(
    definition: ast.ClassDef,
    *,
    symbols: _Symbols,
    options: ScopedResponsesIncludeScopeIdsOptions,
) -> bool:
    for base in definition.bases:
        if symbols.is_generic_base(base):
            return True
        name = _dotted_name(base)
        imported = symbols.imported_identity(base)
        if name in options.generic_wrapper_bases or imported in options.generic_wrapper_bases:
            return True
    return False


def _is_abstract(definition: ast.ClassDef, symbols: _Symbols) -> bool:
    for base in definition.bases:
        if isinstance(base, ast.Name) and base.id in symbols.abc_names:
            return True
        imported = symbols.imported_identity(base)
        if imported == "abc.ABC":
            return True
    for statement in definition.body:
        if not isinstance(statement, (ast.FunctionDef, ast.AsyncFunctionDef)):
            continue
        for decorator in statement.decorator_list:
            target = decorator.func if isinstance(decorator, ast.Call) else decorator
            if isinstance(target, ast.Name) and target.id in symbols.abstractmethod_names:
                return True
            if symbols.imported_identity(target) == "abc.abstractmethod":
                return True
    return False


def _diagnostic(
    *, path: str, node: ast.AST, field_name: str, missing: bool
) -> Diagnostic:
    line = getattr(node, "lineno", 1)
    column = getattr(node, "col_offset", 0) + 1
    end_line = getattr(node, "end_lineno", line)
    end_column = getattr(node, "end_col_offset", column - 1) + 1
    adjective = "missing" if missing else "invalid"
    return Diagnostic(
        rule=RULE_NAME,
        code=f"{adjective}-{field_name.replace('_', '-')}",
        message=(
            f"{field_name} must be a required, non-null UUID field serialized "
            f"under the exact name {field_name}."
        ),
        path=path,
        line=line,
        column=column,
        end_line=end_line,
        end_column=end_column,
    )


def check_scoped_responses_include_scope_ids(
    source: str,
    *,
    path: str = "<memory>",
    options: ScopedResponsesIncludeScopeIdsOptions | None = None,
) -> list[Diagnostic]:
    """Return missing or invalid scope identifiers on explicitly scoped models."""

    configured = options or ScopedResponsesIncludeScopeIdsOptions()
    module = ast.parse(source, filename=path)
    module_name = _module_name(path)
    symbols = _Symbols(module)
    definitions = {
        statement.name: statement
        for statement in module.body
        if isinstance(statement, ast.ClassDef)
    }
    pydantic_models = _pydantic_models(definitions, symbols)
    organization_descendants, organization_guarantees = _selected_descendants(
        definitions, configured.organization_scoped_bases, symbols
    )
    project_descendants, project_guarantees = _selected_descendants(
        definitions, configured.project_scoped_bases, symbols
    )
    field_cache: dict[str, dict[str, _Field]] = {}
    diagnostics: list[Diagnostic] = []

    for statement in module.body:
        if not isinstance(statement, ast.ClassDef) or statement.name not in pydantic_models:
            continue
        name = statement.name
        if _is_generic_wrapper(statement, symbols=symbols, options=configured):
            continue
        if _is_abstract(statement, symbols):
            continue

        project_scoped = (
            name in project_descendants
            or _model_selected(name, module_name, configured.project_scoped_models)
            or _package_matches(module_name, configured.project_scoped_packages)
        )
        organization_scoped = project_scoped or (
            name in organization_descendants
            or _model_selected(name, module_name, configured.organization_scoped_models)
            or _package_matches(module_name, configured.organization_scoped_packages)
        )
        if not organization_scoped:
            continue

        fields = _fields_for(name, definitions, field_cache)
        guaranteed = set()
        for identity in organization_guarantees.get(name, set()):
            if identity in configured.organization_scoped_bases:
                guaranteed.add("organization_id")
        for identity in project_guarantees.get(name, set()):
            if identity in configured.project_scoped_bases:
                guaranteed.update({"organization_id", "project_id"})

        required_fields = ["organization_id"]
        if project_scoped:
            required_fields.append("project_id")
        for field_name in required_fields:
            field = fields.get(field_name)
            if field is None and field_name in guaranteed:
                continue
            if field is None:
                diagnostics.append(
                    _diagnostic(
                        path=path,
                        node=statement,
                        field_name=field_name,
                        missing=True,
                    )
                )
            elif not _field_is_valid(field, symbols):
                diagnostics.append(
                    _diagnostic(
                        path=path,
                        node=field.node,
                        field_name=field_name,
                        missing=False,
                    )
                )

    return diagnostics
