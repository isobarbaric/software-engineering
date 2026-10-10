from __future__ import annotations

import sys
import textwrap
import unittest
from pathlib import Path

PYTHON_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PYTHON_ROOT))

from code_contracts import (  # noqa: E402
    SqlalchemyQueryColumnsUseModelAttributesOptions,
    check_sqlalchemy_query_columns_use_model_attributes,
)


def check(source: str, *, path: str = "repositories/project.py", options=None):
    return check_sqlalchemy_query_columns_use_model_attributes(
        textwrap.dedent(source), path=path, options=options
    )


class SqlalchemyQueryColumnsUseModelAttributesTests(unittest.TestCase):
    def assert_codes(self, source: str, *codes: str, **kwargs) -> None:
        self.assertEqual(
            [diagnostic.code for diagnostic in check(source, **kwargs)],
            list(codes),
        )

    def test_rejects_strings_in_select_order_by_and_group_by(self) -> None:
        self.assert_codes(
            """
            from sqlalchemy import select

            def query_projects():
                return (
                    select("id", Project)
                    .order_by("created_at")
                    .group_by("organization_id")
                )
            """,
            "string-column-reference",
            "string-column-reference",
            "string-column-reference",
        )

    def test_rejects_strings_in_legacy_query_column_methods(self) -> None:
        self.assert_codes(
            """
            from sqlalchemy.orm import Session

            def query_projects(session: Session):
                return (
                    session.query(Project)
                    .order_by("created_at")
                    .group_by("organization_id")
                )
            """,
            "string-column-reference",
            "string-column-reference",
        )

    def test_rejects_each_string_argument_in_loader_column_options(self) -> None:
        self.assert_codes(
            """
            from sqlalchemy.orm import defer, load_only, undefer

            def options():
                return (
                    load_only("id", "name"),
                    defer("content"),
                    undefer("summary"),
                )
            """,
            "string-column-reference",
            "string-column-reference",
            "string-column-reference",
            "string-column-reference",
        )

    def test_rejects_strings_in_relationship_loader_options(self) -> None:
        self.assert_codes(
            """
            from sqlalchemy.orm import (
                contains_eager,
                joinedload,
                selectinload,
                subqueryload,
            )

            def options():
                return (
                    joinedload("children"),
                    selectinload("owner"),
                    subqueryload("comments"),
                    contains_eager("project"),
                )
            """,
            "string-column-reference",
            "string-column-reference",
            "string-column-reference",
            "string-column-reference",
        )

    def test_resolves_imported_loader_function_aliases(self) -> None:
        self.assert_codes(
            """
            from sqlalchemy.orm import defer as later, load_only as only

            def query():
                return (
                    only("id", "name"),
                    later("content"),
                )
            """,
            "string-column-reference",
            "string-column-reference",
            "string-column-reference",
        )

    def test_resolves_sqlalchemy_namespace_aliases(self) -> None:
        self.assert_codes(
            """
            import sqlalchemy as sa
            import sqlalchemy.orm as orm

            def query():
                statement = sa.select("id", Project).order_by("created_at")
                options = orm.load_only("id"), orm.defer("content")
                return statement, options
            """,
            "string-column-reference",
            "string-column-reference",
            "string-column-reference",
            "string-column-reference",
        )

    def test_allows_symbolic_model_attributes_in_every_supported_api(self) -> None:
        self.assert_codes(
            """
            from sqlalchemy import asc, desc, select
            from sqlalchemy.orm import defer, load_only, undefer

            def query_projects():
                statement = (
                    select(Project)
                    .order_by(Project.created_at)
                    .group_by(Project.organization_id)
                    .distinct(Project.project_id)
                )
                options = (
                    load_only(Project.id, Project.name),
                    defer(Project.content),
                    undefer(Project.summary),
                )
                ordering = asc(Project.name), desc(Project.created_at)
                return statement, options, ordering
            """
        )

    def test_supports_configured_query_functions(self) -> None:
        options = SqlalchemyQueryColumnsUseModelAttributesOptions(
            query_functions=frozenset({"asc", "desc"}),
        )
        self.assert_codes(
            """
            from sqlalchemy import asc as ascending, desc

            ordering = ascending("name"), desc("created_at")
            """,
            "string-column-reference",
            "string-column-reference",
            options=options,
        )

    def test_supports_configured_query_methods(self) -> None:
        options = SqlalchemyQueryColumnsUseModelAttributesOptions(
            query_methods=frozenset({"distinct"}),
        )
        self.assert_codes(
            """
            from sqlalchemy import select

            statement = select(Project).distinct("project_id")
            """,
            "string-column-reference",
            options=options,
        )

    def test_allows_sqlalchemy_foreign_key_strings(self) -> None:
        self.assert_codes(
            """
            from sqlalchemy import ForeignKey
            from sqlalchemy.orm import mapped_column

            project_id = mapped_column(ForeignKey("projects.id"))
            organization_id = mapped_column(
                ForeignKey("organizations.id", ondelete="CASCADE")
            )
            """
        )

    def test_allows_relationship_forward_references(self) -> None:
        self.assert_codes(
            """
            from sqlalchemy.orm import relationship

            project = relationship("Project", back_populates="documents")
            children = relationship("DocumentNode", foreign_keys="DocumentNode.parent_id")
            """
        )

    def test_allows_explicit_textual_sql_boundaries(self) -> None:
        self.assert_codes(
            """
            from sqlalchemy import literal_column, text

            statement = text("SELECT id FROM projects ORDER BY created_at")
            expression = literal_column("projects.created_at")
            """
        )

    def test_allows_string_defaults_and_server_values(self) -> None:
        self.assert_codes(
            """
            from sqlalchemy import Column, String
            from sqlalchemy.orm import mapped_column

            status = mapped_column(String, default="pending", server_default="pending")
            legacy = Column(String, default="active", server_default="active")
            """
        )

    def test_allows_string_values_in_predicates_and_updates(self) -> None:
        self.assert_codes(
            """
            from sqlalchemy import select, update

            statement = select(Project).where(Project.status == "active")
            mutation = update(Project).values(status="archived")
            """
        )

    def test_allows_string_labels_and_label_references(self) -> None:
        self.assert_codes(
            """
            from sqlalchemy import func, select

            count = func.count(Project.id).label("project_count")
            statement = select(count)
            """
        )

    def test_allows_filter_by_and_values_keyword_names(self) -> None:
        self.assert_codes(
            """
            from sqlalchemy import select, update

            query = select(Project).filter_by(status="active", kind="document")
            mutation = update(Project).values(status="archived")
            """
        )

    def test_does_not_flag_unrelated_apis_with_matching_method_names(self) -> None:
        self.assert_codes(
            """
            class Collection:
                def order_by(self, field): return self
                def group_by(self, field): return self
                def distinct(self, field): return self

            collection = Collection()
            collection.order_by("name").group_by("team").distinct("id")
            """
        )

    def test_does_not_flag_shadowed_sqlalchemy_imports(self) -> None:
        self.assert_codes(
            """
            from sqlalchemy.orm import load_only

            def load_only(value):
                return value

            result = load_only("name")
            """
        )

    def test_does_not_use_string_near_database_heuristics(self) -> None:
        self.assert_codes(
            """
            from sqlalchemy import select

            def query_projects(logger):
                logger.info("created_at")
                message = "organization_id"
                statement = select(Project).where(Project.name == "project_id")
                return statement, message
            """
        )

    def test_reports_stable_rule_path_and_location(self) -> None:
        diagnostics = check(
            """
            from sqlalchemy import select

            statement = select(Project).order_by("created_at")
            """,
            path="backend/repositories/project.py",
        )
        self.assertEqual(len(diagnostics), 1)
        diagnostic = diagnostics[0]
        self.assertEqual(
            diagnostic.rule,
            "sqlalchemy-query-columns-use-model-attributes",
        )
        self.assertEqual(diagnostic.code, "string-column-reference")
        self.assertEqual(diagnostic.path, "backend/repositories/project.py")
        self.assertEqual((diagnostic.line, diagnostic.column), (4, 38))
        self.assertIn("Project", diagnostic.message)

    def test_reports_multiple_references_in_source_order(self) -> None:
        diagnostics = check(
            """
            from sqlalchemy import select
            from sqlalchemy.orm import load_only

            statement = select(Project).order_by("name").group_by("kind")
            options = load_only("id", "created_at")
            """
        )
        self.assertEqual([diagnostic.line for diagnostic in diagnostics], [5, 5, 6, 6])


if __name__ == "__main__":
    unittest.main()
