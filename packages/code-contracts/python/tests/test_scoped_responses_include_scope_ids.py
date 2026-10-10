from __future__ import annotations

import sys
import textwrap
import unittest
from pathlib import Path

PYTHON_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PYTHON_ROOT))

from code_contracts.rules.scoped_responses_include_scope_ids import (  # noqa: E402
    ScopedResponsesIncludeScopeIdsOptions,
    check_scoped_responses_include_scope_ids,
)


def check(
    source: str,
    *,
    path: str = "app/api/responses/models.py",
    options: ScopedResponsesIncludeScopeIdsOptions | None = None,
):
    return check_scoped_responses_include_scope_ids(
        textwrap.dedent(source),
        path=path,
        options=options,
    )


ORGANIZATION_BASE_OPTIONS = ScopedResponsesIncludeScopeIdsOptions(
    organization_scoped_bases=frozenset({"OrganizationScopedResponse"}),
)
PROJECT_BASE_OPTIONS = ScopedResponsesIncludeScopeIdsOptions(
    project_scoped_bases=frozenset({"ProjectScopedResponse"}),
)


class ScopedResponsesIncludeScopeIdsTests(unittest.TestCase):
    def assert_codes(
        self,
        source: str,
        *codes: str,
        path: str = "app/api/responses/models.py",
        options: ScopedResponsesIncludeScopeIdsOptions | None = None,
    ) -> None:
        self.assertEqual(
            [diagnostic.code for diagnostic in check(source, path=path, options=options)],
            list(codes),
        )

    def test_does_not_guess_scope_from_model_or_field_names(self) -> None:
        self.assert_codes(
            """
            from pydantic import BaseModel
            from uuid import UUID

            class ProjectResponse(BaseModel):
                project_id: UUID

            class OrganizationSummaryResponse(BaseModel):
                organization_id: UUID
            """
        )

    def test_does_not_guess_scope_from_a_project_shaped_path(self) -> None:
        self.assert_codes(
            """
            from pydantic import BaseModel

            class ProjectResponse(BaseModel):
                name: str
            """,
            path="app/api/responses/projects.py",
        )

    def test_global_responses_require_neither_scope_identifier(self) -> None:
        options = ScopedResponsesIncludeScopeIdsOptions(
            organization_scoped_models=frozenset(
                {"app.api.responses.HealthResponse"}
            ),
        )
        self.assert_codes(
            """
            from pydantic import BaseModel

            class HealthResponse(BaseModel):
                healthy: bool

            class VersionResponse(BaseModel):
                version: str
            """,
            "missing-organization-id",
            options=options,
        )

    def test_organization_scoped_response_requires_only_organization_id(self) -> None:
        self.assert_codes(
            """
            from pydantic import BaseModel
            from uuid import UUID

            class OrganizationScopedResponse(BaseModel):
                pass

            class OrganizationResponse(OrganizationScopedResponse):
                organization_id: UUID
            """,
            options=ORGANIZATION_BASE_OPTIONS,
        )

    def test_organization_scoped_response_reports_a_missing_identifier(self) -> None:
        self.assert_codes(
            """
            from pydantic import BaseModel

            class OrganizationScopedResponse(BaseModel):
                pass

            class OrganizationResponse(OrganizationScopedResponse):
                name: str
            """,
            "missing-organization-id",
            options=ORGANIZATION_BASE_OPTIONS,
        )

    def test_project_scoped_response_requires_both_identifiers(self) -> None:
        self.assert_codes(
            """
            from pydantic import BaseModel
            from uuid import UUID

            class ProjectScopedResponse(BaseModel):
                pass

            class ProjectResponse(ProjectScopedResponse):
                organization_id: UUID
                project_id: UUID
            """,
            options=PROJECT_BASE_OPTIONS,
        )

    def test_project_scoped_response_reports_both_missing_identifiers(self) -> None:
        self.assert_codes(
            """
            from pydantic import BaseModel

            class ProjectScopedResponse(BaseModel):
                pass

            class ProjectResponse(ProjectScopedResponse):
                name: str
            """,
            "missing-organization-id",
            "missing-project-id",
            options=PROJECT_BASE_OPTIONS,
        )

    def test_project_scope_does_not_duplicate_organization_diagnostic(self) -> None:
        options = ScopedResponsesIncludeScopeIdsOptions(
            organization_scoped_bases=frozenset({"OrganizationScopedResponse"}),
            project_scoped_bases=frozenset({"ProjectScopedResponse"}),
        )
        self.assert_codes(
            """
            from pydantic import BaseModel

            class OrganizationScopedResponse: pass
            class ProjectScopedResponse: pass

            class ProjectResponse(
                OrganizationScopedResponse,
                ProjectScopedResponse,
                BaseModel,
            ):
                pass
            """,
            "missing-organization-id",
            "missing-project-id",
            options=options,
        )

    def test_accepts_import_aliases_for_uuid_pydantic_and_field(self) -> None:
        self.assert_codes(
            """
            from pydantic import BaseModel as Schema, Field as schema_field
            from uuid import UUID as Identifier

            class ProjectScopedResponse(Schema):
                pass

            class ProjectResponse(ProjectScopedResponse):
                organization_id: Identifier
                project_id: Identifier = schema_field(...)
            """,
            options=PROJECT_BASE_OPTIONS,
        )

    def test_accepts_namespaced_uuid_and_pydantic_imports(self) -> None:
        self.assert_codes(
            """
            import pydantic as pd
            import uuid as identifiers

            class ProjectScopedResponse(pd.BaseModel):
                pass

            class ProjectResponse(ProjectScopedResponse):
                organization_id: identifiers.UUID
                project_id: identifiers.UUID = pd.Field(...)
            """,
            options=PROJECT_BASE_OPTIONS,
        )

    def test_accepts_pydantic_v1_base_model_imports(self) -> None:
        self.assert_codes(
            """
            from pydantic.v1 import BaseModel as Schema
            from uuid import UUID

            class ProjectScopedResponse(Schema):
                pass

            class ProjectResponse(ProjectScopedResponse):
                organization_id: UUID
                project_id: UUID
            """,
            options=PROJECT_BASE_OPTIONS,
        )

    def test_accepts_forward_reference_uuid_annotations(self) -> None:
        self.assert_codes(
            """
            from pydantic import BaseModel
            from uuid import UUID

            class ProjectScopedResponse(BaseModel):
                pass

            class ProjectResponse(ProjectScopedResponse):
                organization_id: "UUID"
                project_id: "UUID"
            """,
            options=PROJECT_BASE_OPTIONS,
        )

    def test_accepts_annotated_uuid_fields(self) -> None:
        self.assert_codes(
            """
            from typing import Annotated
            from pydantic import BaseModel, Field
            from uuid import UUID

            class ProjectScopedResponse(BaseModel):
                pass

            class ProjectResponse(ProjectScopedResponse):
                organization_id: Annotated[UUID, Field(description="tenant")]
                project_id: Annotated[UUID, Field(description="project")]
            """,
            options=PROJECT_BASE_OPTIONS,
        )

    def test_accepts_direct_and_transitively_inherited_fields(self) -> None:
        self.assert_codes(
            """
            from pydantic import BaseModel
            from uuid import UUID

            class ProjectScopedResponse(BaseModel):
                pass

            class OrganizationIdentity(BaseModel):
                organization_id: UUID

            class ProjectIdentity(OrganizationIdentity):
                project_id: UUID

            class ProjectResponse(ProjectScopedResponse, ProjectIdentity):
                name: str
            """,
            options=PROJECT_BASE_OPTIONS,
        )

    def test_inherited_invalid_field_is_still_invalid(self) -> None:
        self.assert_codes(
            """
            from pydantic import BaseModel
            from uuid import UUID

            class ProjectScopedResponse(BaseModel):
                pass

            class ScopeIdentity(BaseModel):
                organization_id: UUID | None
                project_id: UUID

            class ProjectResponse(ProjectScopedResponse, ScopeIdentity):
                pass
            """,
            "invalid-organization-id",
            options=PROJECT_BASE_OPTIONS,
        )

    def test_child_override_must_preserve_the_inherited_contract(self) -> None:
        self.assert_codes(
            """
            from pydantic import BaseModel
            from uuid import UUID

            class ProjectScopedResponse(BaseModel):
                pass

            class ScopeIdentity(BaseModel):
                organization_id: UUID
                project_id: UUID

            class ProjectResponse(ProjectScopedResponse, ScopeIdentity):
                project_id: str
            """,
            "invalid-project-id",
            options=PROJECT_BASE_OPTIONS,
        )

    def test_rejects_pep_604_nullable_identifiers(self) -> None:
        self.assert_codes(
            """
            from pydantic import BaseModel
            from uuid import UUID

            class ProjectScopedResponse(BaseModel): pass

            class ProjectResponse(ProjectScopedResponse):
                organization_id: UUID | None
                project_id: UUID | None
            """,
            "invalid-organization-id",
            "invalid-project-id",
            options=PROJECT_BASE_OPTIONS,
        )

    def test_rejects_typing_optional_and_union_none(self) -> None:
        self.assert_codes(
            """
            from pydantic import BaseModel
            from typing import Optional, Union
            from uuid import UUID

            class ProjectScopedResponse(BaseModel): pass

            class ProjectResponse(ProjectScopedResponse):
                organization_id: Optional[UUID]
                project_id: Union[UUID, None]
            """,
            "invalid-organization-id",
            "invalid-project-id",
            options=PROJECT_BASE_OPTIONS,
        )

    def test_rejects_namespaced_nullable_annotations(self) -> None:
        self.assert_codes(
            """
            import typing as t
            import uuid
            from pydantic import BaseModel

            class ProjectScopedResponse(BaseModel): pass

            class ProjectResponse(ProjectScopedResponse):
                organization_id: t.Optional[uuid.UUID]
                project_id: t.Union[uuid.UUID, None]
            """,
            "invalid-organization-id",
            "invalid-project-id",
            options=PROJECT_BASE_OPTIONS,
        )

    def test_rejects_wrong_identifier_types(self) -> None:
        self.assert_codes(
            """
            from pydantic import BaseModel

            class ProjectScopedResponse(BaseModel): pass

            class ProjectResponse(ProjectScopedResponse):
                organization_id: str
                project_id: int
            """,
            "invalid-organization-id",
            "invalid-project-id",
            options=PROJECT_BASE_OPTIONS,
        )

    def test_rejects_a_union_that_can_hold_a_non_uuid_value(self) -> None:
        self.assert_codes(
            """
            from pydantic import BaseModel
            from uuid import UUID

            class ProjectScopedResponse(BaseModel): pass

            class ProjectResponse(ProjectScopedResponse):
                organization_id: UUID | str
                project_id: UUID
            """,
            "invalid-organization-id",
            options=PROJECT_BASE_OPTIONS,
        )

    def test_rejects_plain_defaults_even_when_the_type_is_uuid(self) -> None:
        self.assert_codes(
            """
            from pydantic import BaseModel
            from uuid import UUID, uuid4

            class ProjectScopedResponse(BaseModel): pass

            class ProjectResponse(ProjectScopedResponse):
                organization_id: UUID = uuid4()
                project_id: UUID = uuid4()
            """,
            "invalid-organization-id",
            "invalid-project-id",
            options=PROJECT_BASE_OPTIONS,
        )

    def test_rejects_none_and_field_none_defaults(self) -> None:
        self.assert_codes(
            """
            from pydantic import BaseModel, Field
            from uuid import UUID

            class ProjectScopedResponse(BaseModel): pass

            class ProjectResponse(ProjectScopedResponse):
                organization_id: UUID = None
                project_id: UUID = Field(default=None)
            """,
            "invalid-organization-id",
            "invalid-project-id",
            options=PROJECT_BASE_OPTIONS,
        )

    def test_rejects_default_factory_fields(self) -> None:
        self.assert_codes(
            """
            from pydantic import BaseModel, Field
            from uuid import UUID, uuid4

            class ProjectScopedResponse(BaseModel): pass

            class ProjectResponse(ProjectScopedResponse):
                organization_id: UUID = Field(default_factory=uuid4)
                project_id: UUID = Field(default_factory=uuid4)
            """,
            "invalid-organization-id",
            "invalid-project-id",
            options=PROJECT_BASE_OPTIONS,
        )

    def test_rejects_excluded_fields(self) -> None:
        self.assert_codes(
            """
            from pydantic import BaseModel, Field
            from uuid import UUID

            class ProjectScopedResponse(BaseModel): pass

            class ProjectResponse(ProjectScopedResponse):
                organization_id: UUID = Field(..., exclude=True)
                project_id: UUID = Field(..., exclude=True)
            """,
            "invalid-organization-id",
            "invalid-project-id",
            options=PROJECT_BASE_OPTIONS,
        )

    def test_rejects_exclusion_in_annotated_field_metadata(self) -> None:
        self.assert_codes(
            """
            from typing import Annotated
            from pydantic import BaseModel, Field
            from uuid import UUID

            class ProjectScopedResponse(BaseModel): pass

            class ProjectResponse(ProjectScopedResponse):
                organization_id: Annotated[UUID, Field(exclude=True)]
                project_id: UUID
            """,
            "invalid-organization-id",
            options=PROJECT_BASE_OPTIONS,
        )

    def test_rejects_serialization_aliases_and_general_aliases(self) -> None:
        self.assert_codes(
            """
            from pydantic import BaseModel, Field
            from uuid import UUID

            class ProjectScopedResponse(BaseModel): pass

            class ProjectResponse(ProjectScopedResponse):
                organization_id: UUID = Field(..., alias="organizationId")
                project_id: UUID = Field(..., serialization_alias="projectId")
            """,
            "invalid-organization-id",
            "invalid-project-id",
            options=PROJECT_BASE_OPTIONS,
        )

    def test_rejects_close_but_inexact_field_names(self) -> None:
        self.assert_codes(
            """
            from pydantic import BaseModel
            from uuid import UUID

            class ProjectScopedResponse(BaseModel): pass

            class ProjectResponse(ProjectScopedResponse):
                organizationId: UUID
                projectId: UUID
            """,
            "missing-organization-id",
            "missing-project-id",
            options=PROJECT_BASE_OPTIONS,
        )

    def test_class_vars_and_private_attributes_are_not_model_fields(self) -> None:
        self.assert_codes(
            """
            from typing import ClassVar
            from pydantic import BaseModel, PrivateAttr
            from uuid import UUID, uuid4

            class ProjectScopedResponse(BaseModel): pass

            class ProjectResponse(ProjectScopedResponse):
                organization_id: ClassVar[UUID] = uuid4()
                project_id: UUID = PrivateAttr()
            """,
            "invalid-organization-id",
            "invalid-project-id",
            options=PROJECT_BASE_OPTIONS,
        )

    def test_computed_properties_do_not_satisfy_required_model_fields(self) -> None:
        self.assert_codes(
            """
            from pydantic import BaseModel, computed_field
            from uuid import UUID, uuid4

            class ProjectScopedResponse(BaseModel): pass

            class ProjectResponse(ProjectScopedResponse):
                @computed_field
                @property
                def organization_id(self) -> UUID:
                    return uuid4()

                @computed_field
                @property
                def project_id(self) -> UUID:
                    return uuid4()
            """,
            "missing-organization-id",
            "missing-project-id",
            options=PROJECT_BASE_OPTIONS,
        )

    def test_selects_scope_by_a_local_base_and_checks_only_descendants(self) -> None:
        self.assert_codes(
            """
            from pydantic import BaseModel

            class ProjectScopedResponse(BaseModel):
                pass

            class ProjectResponse(ProjectScopedResponse):
                pass
            """,
            "missing-organization-id",
            "missing-project-id",
            options=PROJECT_BASE_OPTIONS,
        )

    def test_imported_aliased_scope_base_guarantees_fields_until_overridden(self) -> None:
        options = ScopedResponsesIncludeScopeIdsOptions(
            project_scoped_bases=frozenset(
                {"app.api.contracts.ProjectScopedResponse"}
            ),
        )
        self.assert_codes(
            """
            from app.api.contracts import ProjectScopedResponse as ProjectContract
            from pydantic import BaseModel

            class ProjectResponse(ProjectContract, BaseModel):
                project_id: str
            """,
            "invalid-project-id",
            options=options,
        )

    def test_base_selector_applies_through_local_inheritance(self) -> None:
        self.assert_codes(
            """
            from pydantic import BaseModel

            class ProjectScopedResponse(BaseModel): pass
            class IntermediateResponse(ProjectScopedResponse): pass
            class ProjectResponse(IntermediateResponse): pass
            """,
            "missing-organization-id",
            "missing-project-id",
            "missing-organization-id",
            "missing-project-id",
            options=PROJECT_BASE_OPTIONS,
        )

    def test_selects_scope_by_exact_qualified_model_name(self) -> None:
        options = ScopedResponsesIncludeScopeIdsOptions(
            project_scoped_models=frozenset(
                {"app.api.responses.shared.ProjectSummary"}
            ),
        )
        self.assert_codes(
            """
            from pydantic import BaseModel

            class ProjectSummary(BaseModel): pass
            class UnscopedSummary(BaseModel): pass
            """,
            "missing-organization-id",
            "missing-project-id",
            path="app/api/responses/shared.py",
            options=options,
        )

    def test_qualified_model_selector_handles_package_init_modules(self) -> None:
        options = ScopedResponsesIncludeScopeIdsOptions(
            organization_scoped_models=frozenset(
                {"app.api.responses.OrganizationSummary"}
            ),
        )
        self.assert_codes(
            """
            from pydantic import BaseModel

            class OrganizationSummary(BaseModel): pass
            """,
            "missing-organization-id",
            path="app/api/responses/__init__.py",
            options=options,
        )

    def test_selects_scope_by_an_explicit_unqualified_model_name(self) -> None:
        options = ScopedResponsesIncludeScopeIdsOptions(
            project_scoped_models=frozenset({"ProjectSummary"}),
        )
        self.assert_codes(
            """
            from pydantic import BaseModel

            class ProjectSummary(BaseModel): pass
            class OtherSummary(BaseModel): pass
            """,
            "missing-organization-id",
            "missing-project-id",
            path="app/api/responses/shared.py",
            options=options,
        )

    def test_qualified_model_selector_is_exact(self) -> None:
        options = ScopedResponsesIncludeScopeIdsOptions(
            project_scoped_models=frozenset(
                {"app.api.responses.shared.ProjectSummary"}
            ),
        )
        self.assert_codes(
            """
            from pydantic import BaseModel

            class ProjectSummaryDetail(BaseModel): pass
            """,
            path="app/api/responses/shared.py",
            options=options,
        )

    def test_selects_scope_by_package_and_subpackages(self) -> None:
        options = ScopedResponsesIncludeScopeIdsOptions(
            project_scoped_packages=("app.api.responses.projects",),
        )
        self.assert_codes(
            """
            from pydantic import BaseModel

            class ProjectResponse(BaseModel): pass
            """,
            "missing-organization-id",
            "missing-project-id",
            path="app/api/responses/projects/detail.py",
            options=options,
        )

    def test_package_selector_respects_dotted_name_boundaries(self) -> None:
        options = ScopedResponsesIncludeScopeIdsOptions(
            project_scoped_packages=("app.api.responses.project",),
        )
        self.assert_codes(
            """
            from pydantic import BaseModel

            class ProjectileResponse(BaseModel): pass
            """,
            path="app/api/responses/projectile/models.py",
            options=options,
        )

    def test_package_selector_ignores_non_pydantic_classes(self) -> None:
        options = ScopedResponsesIncludeScopeIdsOptions(
            project_scoped_packages=("app.api.responses.projects",),
        )
        self.assert_codes(
            """
            from dataclasses import dataclass

            @dataclass
            class ProjectResponse:
                name: str
            """,
            path="app/api/responses/projects/models.py",
            options=options,
        )

    def test_generic_response_wrapper_is_exempt_in_a_scoped_package(self) -> None:
        options = ScopedResponsesIncludeScopeIdsOptions(
            project_scoped_packages=("app.api.responses.projects",),
        )
        self.assert_codes(
            """
            from typing import Generic, TypeVar
            from pydantic import BaseModel

            T = TypeVar("T")

            class Page(BaseModel, Generic[T]):
                items: list[T]
                total: int
            """,
            path="app/api/responses/projects/page.py",
            options=options,
        )

    def test_aliased_generic_response_wrapper_is_exempt(self) -> None:
        options = ScopedResponsesIncludeScopeIdsOptions(
            project_scoped_packages=("app.api.responses.projects",),
        )
        self.assert_codes(
            """
            from typing import Generic as ParameterizedBy, TypeVar as TypeParameter
            from pydantic import BaseModel

            Item = TypeParameter("Item")

            class Envelope(BaseModel, ParameterizedBy[Item]):
                data: Item
            """,
            path="app/api/responses/projects/envelope.py",
            options=options,
        )

    def test_concrete_scoped_collection_response_is_not_exempt(self) -> None:
        options = ScopedResponsesIncludeScopeIdsOptions(
            project_scoped_packages=("app.api.responses.projects",),
        )
        self.assert_codes(
            """
            from typing import Generic, TypeVar
            from pydantic import BaseModel
            from uuid import UUID

            T = TypeVar("T")

            class Page(BaseModel, Generic[T]):
                items: list[T]

            class ProjectItem(BaseModel):
                organization_id: UUID
                project_id: UUID
                name: str

            class ProjectPage(Page[ProjectItem]):
                pass
            """,
            "missing-organization-id",
            "missing-project-id",
            options=options,
            path="app/api/responses/projects/page.py",
        )

    def test_abstract_response_base_is_exempt_but_concrete_child_is_not(self) -> None:
        options = ScopedResponsesIncludeScopeIdsOptions(
            project_scoped_packages=("app.api.responses.projects",),
        )
        self.assert_codes(
            """
            from abc import ABC, abstractmethod
            from pydantic import BaseModel

            class ProjectResponseBase(BaseModel, ABC):
                @abstractmethod
                def render(self) -> str: ...

            class ProjectResponse(ProjectResponseBase):
                def render(self) -> str:
                    return "project"
            """,
            "missing-organization-id",
            "missing-project-id",
            options=options,
            path="app/api/responses/projects/base.py",
        )

    def test_reports_each_concrete_model_in_source_order(self) -> None:
        options = ScopedResponsesIncludeScopeIdsOptions(
            organization_scoped_packages=("app.api.responses.organizations",),
        )
        diagnostics = check(
            """
            from pydantic import BaseModel

            class FirstResponse(BaseModel): pass
            class SecondResponse(BaseModel): pass
            """,
            path="app/api/responses/organizations/models.py",
            options=options,
        )
        self.assertEqual(
            [(diagnostic.code, diagnostic.line) for diagnostic in diagnostics],
            [
                ("missing-organization-id", 4),
                ("missing-organization-id", 5),
            ],
        )

    def test_reports_stable_rule_path_and_actionable_messages(self) -> None:
        diagnostics = check(
            """
            from pydantic import BaseModel
            from uuid import UUID

            class ProjectScopedResponse(BaseModel): pass

            class ProjectResponse(ProjectScopedResponse):
                organization_id: UUID | None
            """,
            path="backend/api/project_response.py",
            options=PROJECT_BASE_OPTIONS,
        )
        self.assertEqual(
            [
                (
                    diagnostic.rule,
                    diagnostic.code,
                    diagnostic.path,
                    diagnostic.line,
                )
                for diagnostic in diagnostics
            ],
            [
                (
                    "scoped-responses-include-scope-ids",
                    "invalid-organization-id",
                    "backend/api/project_response.py",
                    8,
                ),
                (
                    "scoped-responses-include-scope-ids",
                    "missing-project-id",
                    "backend/api/project_response.py",
                    7,
                ),
            ],
        )
        self.assertIn("required", diagnostics[0].message)
        self.assertIn("non-null", diagnostics[0].message)
        self.assertIn("organization_id", diagnostics[0].message)
        self.assertIn("project_id", diagnostics[1].message)


if __name__ == "__main__":
    unittest.main()
