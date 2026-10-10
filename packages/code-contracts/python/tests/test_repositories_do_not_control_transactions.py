from __future__ import annotations

import sys
import textwrap
import unittest
from pathlib import Path

PYTHON_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PYTHON_ROOT))

from code_contracts import (  # noqa: E402
    RepositoriesDoNotControlTransactionsOptions,
    check_repositories_do_not_control_transactions,
)


def check(source: str, *, path: str = "repositories/project.py", options=None):
    return check_repositories_do_not_control_transactions(
        textwrap.dedent(source), path=path, options=options
    )


class RepositoriesDoNotControlTransactionsTests(unittest.TestCase):
    def assert_codes(self, source: str, *codes: str, **kwargs) -> None:
        self.assertEqual(
            [diagnostic.code for diagnostic in check(source, **kwargs)],
            list(codes),
        )

    def test_rejects_sync_session_commit_and_rollback(self) -> None:
        self.assert_codes(
            """
            from sqlalchemy.orm import Session

            class ProjectRepository:
                def __init__(self, session: Session):
                    self.session = session

                def save(self, project):
                    self.session.add(project)
                    self.session.commit()

                def abandon(self):
                    self.session.rollback()
            """,
            "transaction-control",
            "transaction-control",
        )

    def test_rejects_async_session_commit_and_rollback(self) -> None:
        self.assert_codes(
            """
            from sqlalchemy.ext.asyncio import AsyncSession

            class ProjectRepository:
                def __init__(self, session: AsyncSession):
                    self._session = session

                async def save(self, project):
                    self._session.add(project)
                    await self._session.commit()

                async def abandon(self):
                    await self._session.rollback()
            """,
            "transaction-control",
            "transaction-control",
        )

    def test_rejects_begin_and_begin_nested_calls(self) -> None:
        self.assert_codes(
            """
            from sqlalchemy.orm import Session

            class ProjectRepository:
                def __init__(self, session: Session):
                    self.session = session

                def outer(self):
                    transaction = self.session.begin()
                    return transaction

                def nested(self):
                    return self.session.begin_nested()
            """,
            "transaction-control",
            "transaction-control",
        )

    def test_rejects_sync_transaction_context_managers_once(self) -> None:
        self.assert_codes(
            """
            from sqlalchemy.orm import Session

            class ProjectRepository:
                def __init__(self, session: Session):
                    self.session = session

                def save(self, project):
                    with self.session.begin():
                        self.session.add(project)

                def save_nested(self, project):
                    with self.session.begin_nested():
                        self.session.add(project)
            """,
            "transaction-control",
            "transaction-control",
        )

    def test_rejects_async_transaction_context_managers_once(self) -> None:
        self.assert_codes(
            """
            from sqlalchemy.ext.asyncio import AsyncSession

            class ProjectRepository:
                def __init__(self, session: AsyncSession):
                    self.session = session

                async def save(self, project):
                    async with self.session.begin():
                        self.session.add(project)
            """,
            "transaction-control",
        )

    def test_resolves_session_import_aliases_and_namespaces(self) -> None:
        self.assert_codes(
            """
            import sqlalchemy.orm as orm
            from sqlalchemy.ext.asyncio import AsyncSession as DatabaseSession

            class FirstRepository:
                def __init__(self, session: orm.Session):
                    self.database = session

                def save(self):
                    self.database.commit()

            class SecondRepository:
                def __init__(self, session: DatabaseSession):
                    self.database = session

                async def save(self):
                    await self.database.commit()
            """,
            "transaction-control",
            "transaction-control",
        )

    def test_tracks_local_aliases_of_repository_session_attributes(self) -> None:
        self.assert_codes(
            """
            from sqlalchemy.orm import Session

            class ProjectRepository:
                def __init__(self, session: Session):
                    self._database = session

                def save(self):
                    session = self._database
                    database = session
                    database.commit()
            """,
            "transaction-control",
        )

    def test_tracks_direct_typed_session_parameters_in_repository_methods(self) -> None:
        self.assert_codes(
            """
            from sqlalchemy.orm import Session

            class ProjectRepository:
                def save(self, session: Session):
                    session.commit()
            """,
            "transaction-control",
        )

    def test_checks_repository_subclasses(self) -> None:
        self.assert_codes(
            """
            from sqlalchemy.orm import Session

            class BaseRepository:
                pass

            class ProjectStore(BaseRepository):
                def __init__(self, session: Session):
                    self.session = session

                def save(self):
                    self.session.commit()
            """,
            "transaction-control",
        )

    def test_checks_async_and_sync_repository_methods(self) -> None:
        self.assert_codes(
            """
            from sqlalchemy.ext.asyncio import AsyncSession

            class ProjectRepository:
                def __init__(self, session: AsyncSession):
                    self.session = session

                def begin(self):
                    return self.session.begin()

                async def commit(self):
                    await self.session.commit()
            """,
            "transaction-control",
            "transaction-control",
        )

    def test_allows_non_transactional_session_operations(self) -> None:
        self.assert_codes(
            """
            from sqlalchemy.orm import Session

            class ProjectRepository:
                def __init__(self, session: Session):
                    self.session = session

                def save(self, project):
                    self.session.add(project)
                    self.session.add_all([project])
                    self.session.delete(project)
                    self.session.merge(project)
                    self.session.flush()
                    self.session.refresh(project)
                    self.session.expire(project)
                    self.session.execute(project)
                    return self.session.query(type(project))
            """
        )

    def test_allows_async_flush_refresh_and_execute(self) -> None:
        self.assert_codes(
            """
            from sqlalchemy.ext.asyncio import AsyncSession

            class ProjectRepository:
                def __init__(self, session: AsyncSession):
                    self.session = session

                async def save(self, project, statement):
                    self.session.add(project)
                    await self.session.flush()
                    await self.session.refresh(project)
                    return await self.session.execute(statement)
            """
        )

    def test_does_not_flag_unrelated_objects_with_transaction_method_names(self) -> None:
        self.assert_codes(
            """
            class GitClient:
                def commit(self): pass
                def rollback(self): pass
                def begin(self): pass
                def begin_nested(self): pass

            class ProjectRepository:
                def __init__(self, client: GitClient):
                    self.client = client

                def save(self):
                    self.client.begin()
                    self.client.begin_nested()
                    self.client.commit()
                    self.client.rollback()
            """
        )

    def test_does_not_infer_a_session_from_attribute_name_alone(self) -> None:
        self.assert_codes(
            """
            class ProjectRepository:
                def __init__(self, session):
                    self.session = session

                def save(self):
                    self.session.commit()
            """
        )

    def test_does_not_flag_transaction_calls_outside_repositories(self) -> None:
        self.assert_codes(
            """
            from sqlalchemy.orm import Session

            class ProjectService:
                def __init__(self, session: Session):
                    self.session = session

                def save(self):
                    self.session.commit()

            def migrate(session: Session):
                with session.begin():
                    pass
            """
        )

    def test_exempts_unit_of_work_and_transaction_manager_classes(self) -> None:
        self.assert_codes(
            """
            from sqlalchemy.orm import Session

            class SqlAlchemyUnitOfWork:
                def __init__(self, session: Session):
                    self.session = session

                def commit(self):
                    self.session.commit()

                def rollback(self):
                    self.session.rollback()

            class DatabaseTransactionManager:
                def __init__(self, session: Session):
                    self.session = session

                def transaction(self):
                    return self.session.begin()
            """
        )

    def test_supports_configured_repository_suffixes(self) -> None:
        options = RepositoriesDoNotControlTransactionsOptions(
            repository_suffixes=("Store",),
        )
        self.assert_codes(
            """
            from sqlalchemy.orm import Session

            class ProjectStore:
                def __init__(self, session: Session): self.session = session
                def save(self): self.session.commit()

            class ProjectRepository:
                def __init__(self, session: Session): self.session = session
                def save(self): self.session.commit()
            """,
            "transaction-control",
            options=options,
        )

    def test_supports_configured_transaction_owner_suffixes(self) -> None:
        options = RepositoriesDoNotControlTransactionsOptions(
            transaction_owner_suffixes=("AtomicBoundary",),
        )
        self.assert_codes(
            """
            from sqlalchemy.orm import Session

            class ProjectAtomicBoundary:
                def __init__(self, session: Session): self.session = session
                def save(self): self.session.commit()

            class ProjectRepository:
                def __init__(self, session: Session): self.session = session
                def save(self): self.session.commit()
            """,
            "transaction-control",
            options=options,
        )

    def test_supports_exact_qualified_class_exemptions(self) -> None:
        options = RepositoriesDoNotControlTransactionsOptions(
            exempt_classes=frozenset({"legacy.LegacyRepository"}),
        )
        source = """
            from sqlalchemy.orm import Session

            class LegacyRepository:
                def __init__(self, session: Session): self.session = session
                def save(self): self.session.commit()
        """
        self.assert_codes(source, options=options, path="legacy.py")
        self.assert_codes(
            source,
            "transaction-control",
            options=options,
            path="other.py",
        )

    def test_does_not_exempt_repository_implementations_in_test_files(self) -> None:
        self.assert_codes(
            """
            from sqlalchemy.orm import Session

            class FakeProjectRepository:
                def __init__(self, session: Session):
                    self.session = session

                def save(self):
                    self.session.commit()
            """,
            "transaction-control",
            path="tests/test_project_repository.py",
        )

    def test_ignores_shadowed_session_imports(self) -> None:
        self.assert_codes(
            """
            from sqlalchemy.orm import Session

            class Session:
                pass

            class ProjectRepository:
                def __init__(self, session: Session):
                    self.session = session

                def save(self):
                    self.session.commit()
            """
        )

    def test_reports_stable_rule_path_operation_and_location(self) -> None:
        diagnostics = check(
            """
            from sqlalchemy.orm import Session

            class ProjectRepository:
                def __init__(self, session: Session):
                    self.session = session

                def save(self):
                    self.session.commit()
            """,
            path="backend/repositories/project.py",
        )
        self.assertEqual(len(diagnostics), 1)
        diagnostic = diagnostics[0]
        self.assertEqual(diagnostic.rule, "repositories-do-not-control-transactions")
        self.assertEqual(diagnostic.code, "transaction-control")
        self.assertEqual(diagnostic.path, "backend/repositories/project.py")
        self.assertEqual((diagnostic.line, diagnostic.column), (9, 9))
        self.assertIn("commit", diagnostic.message)

    def test_reports_multiple_operations_in_source_order(self) -> None:
        diagnostics = check(
            """
            from sqlalchemy.orm import Session

            class ProjectRepository:
                def __init__(self, session: Session): self.session = session
                def save(self):
                    self.session.begin()
                    self.session.commit()
                    self.session.rollback()
            """
        )
        self.assertEqual([diagnostic.line for diagnostic in diagnostics], [7, 8, 9])


if __name__ == "__main__":
    unittest.main()
