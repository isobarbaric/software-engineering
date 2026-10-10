from __future__ import annotations

import sys
import textwrap
import unittest
from pathlib import Path

PYTHON_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PYTHON_ROOT))

from code_contracts import (  # noqa: E402
    NoGenericDomainExceptionsOptions,
    check_no_generic_domain_exceptions,
)


def check(source: str, *, path: str = "service.py", options=None):
    return check_no_generic_domain_exceptions(
        textwrap.dedent(source), path=path, options=options
    )


class NoGenericDomainExceptionsTests(unittest.TestCase):
    def assert_codes(self, source: str, *codes: str, **kwargs) -> None:
        self.assertEqual(
            [diagnostic.code for diagnostic in check(source, **kwargs)],
            list(codes),
        )

    def test_rejects_each_prohibited_builtin_in_services(self) -> None:
        self.assert_codes(
            """
            class ProjectService:
                def create(self):
                    raise ValueError("invalid project")

                def update(self):
                    raise RuntimeError("update failed")

                def delete(self):
                    raise Exception("delete failed")
            """,
            "generic-domain-exception",
            "generic-domain-exception",
            "generic-domain-exception",
        )

    def test_rejects_exception_classes_raised_without_instantiation(self) -> None:
        self.assert_codes(
            """
            class ProjectService:
                def create(self):
                    raise ValueError

                def update(self):
                    raise RuntimeError

                def delete(self):
                    raise Exception
            """,
            "generic-domain-exception",
            "generic-domain-exception",
            "generic-domain-exception",
        )

    def test_rejects_generic_exceptions_in_sync_and_async_repositories(self) -> None:
        self.assert_codes(
            """
            class ProjectRepository:
                def save(self):
                    raise ValueError("invalid")

                async def delete(self):
                    raise RuntimeError("failed")
            """,
            "generic-domain-exception",
            "generic-domain-exception",
        )

    def test_rejects_generic_exceptions_from_private_static_and_class_methods(self) -> None:
        self.assert_codes(
            """
            class ProjectService:
                def _validate(self):
                    raise ValueError("invalid")

                @staticmethod
                def normalize():
                    raise RuntimeError("failed")

                @classmethod
                def construct(cls):
                    raise Exception("failed")
            """,
            "generic-domain-exception",
            "generic-domain-exception",
            "generic-domain-exception",
        )

    def test_rejects_generic_exceptions_in_nested_service_helpers(self) -> None:
        self.assert_codes(
            """
            class ProjectService:
                def create(self):
                    def validate():
                        raise ValueError("invalid")

                    validate()
            """,
            "generic-domain-exception",
        )

    def test_rejects_generic_exceptions_in_local_inherited_domain_classes(self) -> None:
        self.assert_codes(
            """
            class BaseService:
                pass

            class ProjectCreator(BaseService):
                def create(self):
                    raise ValueError("invalid")

            class BaseRepository:
                pass

            class ProjectStore(BaseRepository):
                def save(self):
                    raise RuntimeError("failed")
            """,
            "generic-domain-exception",
            "generic-domain-exception",
        )

    def test_rejects_generic_exceptions_in_transitively_inherited_domain_classes(self) -> None:
        self.assert_codes(
            """
            class BaseService:
                pass

            class ProjectOperations(BaseService):
                pass

            class ProjectCreator(ProjectOperations):
                def create(self):
                    raise ValueError("invalid")
            """,
            "generic-domain-exception",
        )

    def test_rejects_generic_exceptions_in_imported_domain_subclasses(self) -> None:
        self.assert_codes(
            """
            from application.services import Service as ApplicationBoundary
            from infrastructure.repositories import Repository as StorageBoundary

            class ProjectCreator(ApplicationBoundary):
                def create(self):
                    raise ValueError("invalid")

            class ProjectStore(StorageBoundary):
                def save(self):
                    raise RuntimeError("failed")
            """,
            "generic-domain-exception",
            "generic-domain-exception",
        )

    def test_rejects_imported_builtin_aliases(self) -> None:
        self.assert_codes(
            """
            from builtins import Exception as GenericFailure
            from builtins import RuntimeError as OperationFailure
            from builtins import ValueError as InvalidValue

            class ProjectService:
                def create(self):
                    raise InvalidValue("invalid")

                def update(self):
                    raise OperationFailure("failed")

                def delete(self):
                    raise GenericFailure("failed")
            """,
            "generic-domain-exception",
            "generic-domain-exception",
            "generic-domain-exception",
        )

    def test_rejects_builtins_namespace_aliases(self) -> None:
        self.assert_codes(
            """
            import builtins as py

            class ProjectService:
                def create(self):
                    raise py.ValueError("invalid")

                def update(self):
                    raise py.RuntimeError("failed")

                def delete(self):
                    raise py.Exception("failed")
            """,
            "generic-domain-exception",
            "generic-domain-exception",
            "generic-domain-exception",
        )

    def test_rejects_direct_and_chained_assignment_aliases(self) -> None:
        self.assert_codes(
            """
            InvalidValue = ValueError
            OperationFailure = RuntimeError
            GenericFailure = Exception
            ChainedFailure = InvalidValue

            class ProjectService:
                def create(self):
                    raise InvalidValue("invalid")

                def update(self):
                    raise OperationFailure("failed")

                def delete(self):
                    raise GenericFailure("failed")

                def clone(self):
                    raise ChainedFailure("invalid")
            """,
            "generic-domain-exception",
            "generic-domain-exception",
            "generic-domain-exception",
            "generic-domain-exception",
        )

    def test_rejects_generic_exceptions_with_explicit_causes(self) -> None:
        self.assert_codes(
            """
            class ProjectService:
                def create(self, cause):
                    raise ValueError("invalid") from cause
            """,
            "generic-domain-exception",
        )

    def test_allows_bare_reraises(self) -> None:
        self.assert_codes(
            """
            class ProjectService:
                def create(self):
                    try:
                        perform_create()
                    except ValueError:
                        raise
            """
        )

    def test_allows_domain_and_library_exceptions(self) -> None:
        self.assert_codes(
            """
            from fastapi import HTTPException
            from sqlalchemy.exc import IntegrityError

            class ProjectNotFoundError(Exception):
                pass

            class ProjectService:
                def read(self):
                    raise ProjectNotFoundError("missing")

                def authorize(self):
                    raise HTTPException(status_code=403)

                def save(self):
                    raise IntegrityError("statement", {}, None)
            """
        )

    def test_allows_not_implemented_error_and_its_builtin_aliases(self) -> None:
        self.assert_codes(
            """
            import builtins as py
            from builtins import NotImplementedError as AbstractMethod

            class ProjectService:
                def create(self):
                    raise NotImplementedError

                def update(self):
                    raise AbstractMethod

                def delete(self):
                    raise py.NotImplementedError
            """
        )

    def test_allows_other_builtin_exception_types(self) -> None:
        self.assert_codes(
            """
            class ProjectService:
                def wrong_type(self):
                    raise TypeError("wrong type")

                def missing_key(self):
                    raise KeyError("missing")

                def missing_value(self):
                    raise LookupError("missing")

                def assert_invariant(self):
                    raise AssertionError("broken")

                def grouped(self):
                    raise ExceptionGroup("failures", [])
            """
        )

    def test_ignores_generic_exception_references_that_are_not_raised(self) -> None:
        self.assert_codes(
            """
            class ProjectService:
                exception_type = ValueError

                def create(self, error: RuntimeError):
                    failure = Exception("failed")
                    return failure
            """
        )

    def test_ignores_non_domain_classes_and_top_level_functions(self) -> None:
        self.assert_codes(
            """
            def parse_input():
                raise ValueError("invalid")

            class ProjectBuilder:
                def build(self):
                    raise RuntimeError("failed")

            class ExceptionTranslator:
                def translate(self):
                    raise Exception("failed")
            """
        )

    def test_does_not_blanket_exempt_test_files_with_domain_implementations(self) -> None:
        self.assert_codes(
            """
            class FakeProjectService:
                def create(self):
                    raise ValueError("invalid")

            class InMemoryProjectRepository:
                def save(self):
                    raise RuntimeError("failed")
            """,
            "generic-domain-exception",
            "generic-domain-exception",
            path="tests/test_project_service.py",
        )

    def test_pydantic_field_validators_are_exempt(self) -> None:
        self.assert_codes(
            """
            from pydantic import BaseModel, field_validator

            class ConfigurationService(BaseModel):
                name: str

                @field_validator("name")
                @classmethod
                def validate_name(cls, value):
                    if not value:
                        raise ValueError("name is required")
                    return value
            """
        )

    def test_aliased_and_namespaced_pydantic_validators_are_exempt(self) -> None:
        self.assert_codes(
            """
            import pydantic as pd
            from pydantic import BaseModel, field_validator as validates

            class FirstService(BaseModel):
                name: str

                @validates("name")
                @classmethod
                def validate_name(cls, value):
                    raise ValueError("invalid")

            class SecondService(pd.BaseModel):
                name: str

                @pd.model_validator(mode="after")
                def validate_model(self):
                    raise RuntimeError("invalid")
            """
        )

    def test_pydantic_v1_validator_forms_are_exempt(self) -> None:
        self.assert_codes(
            """
            from pydantic import BaseModel, root_validator, validator

            class LegacyService(BaseModel):
                name: str

                @validator("name")
                def validate_name(cls, value):
                    raise ValueError("invalid")

                @root_validator
                def validate_values(cls, values):
                    raise ValueError("invalid")
            """
        )

    def test_non_pydantic_validator_decorators_do_not_create_an_exemption(self) -> None:
        self.assert_codes(
            """
            from application.validation import field_validator

            class ProjectService:
                @field_validator("name")
                def validate_name(self, value):
                    raise ValueError("invalid")
            """,
            "generic-domain-exception",
        )

    def test_default_cli_and_configuration_directories_are_exempt(self) -> None:
        source = """
            class BootstrapService:
                def parse(self):
                    raise ValueError("invalid argument")
        """
        self.assert_codes(source, path="backend/cli/parser.py")
        self.assert_codes(source, path="backend/config/parser.py")
        self.assert_codes(source, path="backend/configuration/parser.py")

    def test_similar_path_parts_do_not_create_an_exemption(self) -> None:
        self.assert_codes(
            """
            class ProjectService:
                def create(self):
                    raise ValueError("invalid")
            """,
            "generic-domain-exception",
            path="backend/project_configuration/service.py",
        )

    def test_path_exemptions_are_configurable(self) -> None:
        source = """
            class MigrationService:
                def migrate(self):
                    raise RuntimeError("failed")
        """
        options = NoGenericDomainExceptionsOptions(
            exempt_path_parts=frozenset({"migrations"})
        )
        self.assert_codes(source, path="backend/migrations/project.py", options=options)
        self.assert_codes(
            source,
            "generic-domain-exception",
            path="backend/config/project.py",
            options=options,
        )

    def test_exact_domain_methods_can_be_exempted(self) -> None:
        options = NoGenericDomainExceptionsOptions(
            exempt_methods=frozenset({"ProtocolService.call"})
        )
        self.assert_codes(
            """
            class ProtocolService:
                def call(self):
                    raise ValueError("protocol requirement")

                def other(self):
                    raise ValueError("invalid")
            """,
            "generic-domain-exception",
            options=options,
        )

    def test_domain_class_suffixes_are_configurable(self) -> None:
        options = NoGenericDomainExceptionsOptions(domain_suffixes=("UseCase",))
        self.assert_codes(
            """
            class CreateProjectUseCase:
                def execute(self):
                    raise ValueError("invalid")

            class ProjectService:
                def create(self):
                    raise RuntimeError("failed")
            """,
            "generic-domain-exception",
            options=options,
        )

    def test_module_level_shadowing_avoids_false_positives(self) -> None:
        self.assert_codes(
            """
            class DomainFailure(Exception):
                pass

            ValueError = DomainFailure
            RuntimeError = DomainFailure
            Exception = DomainFailure

            class ProjectService:
                def create(self):
                    raise ValueError("invalid")

                def update(self):
                    raise RuntimeError("failed")

                def delete(self):
                    raise Exception("failed")
            """
        )

    def test_import_shadowing_avoids_false_positives(self) -> None:
        self.assert_codes(
            """
            from domain.errors import ValueError
            from domain.errors import RuntimeError as OperationError

            class ProjectService:
                def create(self):
                    raise ValueError("invalid")

                def update(self):
                    raise OperationError("failed")
            """
        )

    def test_parameter_shadowing_avoids_false_positives(self) -> None:
        self.assert_codes(
            """
            class ProjectService:
                def create(self, ValueError, RuntimeError, Exception):
                    raise ValueError("invalid")
                    raise RuntimeError("failed")
                    raise Exception("failed")
            """
        )

    def test_local_assignment_shadowing_avoids_false_positives(self) -> None:
        self.assert_codes(
            """
            class ProjectDomainError(Exception):
                pass

            class ProjectService:
                def create(self):
                    ValueError = ProjectDomainError
                    raise ValueError("invalid")
            """
        )

    def test_a_function_local_binding_shadows_a_builtin_for_the_whole_scope(self) -> None:
        self.assert_codes(
            """
            class ProjectDomainError(Exception):
                pass

            class ProjectService:
                def create(self):
                    raise ValueError("invalid")
                    ValueError = ProjectDomainError
            """
        )

    def test_local_class_definition_shadowing_avoids_false_positives(self) -> None:
        self.assert_codes(
            """
            class ProjectService:
                def create(self):
                    class ValueError(Exception):
                        pass

                    raise ValueError("invalid")
            """
        )

    def test_exception_handler_binding_shadowing_avoids_false_positives(self) -> None:
        self.assert_codes(
            """
            class ProjectService:
                def create(self):
                    try:
                        perform_create()
                    except ProjectError as Exception:
                        raise Exception
            """
        )

    def test_a_shadowed_bare_name_does_not_hide_an_explicit_builtin(self) -> None:
        self.assert_codes(
            """
            import builtins

            class ProjectDomainError(Exception):
                pass

            class ProjectService:
                def create(self):
                    ValueError = ProjectDomainError
                    raise builtins.ValueError("invalid")
            """,
            "generic-domain-exception",
        )

    def test_a_locally_shadowed_import_alias_is_not_treated_as_builtin(self) -> None:
        self.assert_codes(
            """
            from builtins import ValueError as InvalidValue

            class ProjectDomainError(Exception):
                pass

            class ProjectService:
                def create(self, InvalidValue):
                    raise InvalidValue("invalid")
            """
        )

    def test_reports_stable_messages_and_locations(self) -> None:
        diagnostics = check(
            """
            class ProjectService:
                def create(self):
                    raise ValueError("invalid")

                async def update(self):
                    raise RuntimeError("failed")
            """,
            path="backend/project_service.py",
        )
        self.assertEqual(
            [
                (
                    diagnostic.rule,
                    diagnostic.code,
                    diagnostic.path,
                    diagnostic.line,
                    diagnostic.column,
                )
                for diagnostic in diagnostics
            ],
            [
                (
                    "no-generic-domain-exceptions",
                    "generic-domain-exception",
                    "backend/project_service.py",
                    4,
                    15,
                ),
                (
                    "no-generic-domain-exceptions",
                    "generic-domain-exception",
                    "backend/project_service.py",
                    7,
                    15,
                ),
            ],
        )
        self.assertIn("domain-specific exception", diagnostics[0].message)

    def test_reports_multiple_violations_in_source_order(self) -> None:
        diagnostics = check(
            """
            class FirstService:
                def create(self):
                    raise RuntimeError("failed")

            class SecondRepository:
                def save(self):
                    raise ValueError("invalid")
            """
        )
        self.assertEqual([diagnostic.line for diagnostic in diagnostics], [4, 8])


if __name__ == "__main__":
    unittest.main()
