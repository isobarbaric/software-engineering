"""Registry of Python contract rules executed by the CLI."""

from functools import partial
from typing import Protocol

from code_contracts.diagnostics import Diagnostic

from .no_generic_domain_exceptions import (
    NoGenericDomainExceptionsOptions,
    check_no_generic_domain_exceptions,
)
from .no_tuple_service_results import (
    NoTupleServiceResultsOptions,
    check_no_tuple_service_results,
)
from .no_underscore_pydantic_model_names import check_no_underscore_pydantic_model_names
from .repositories_do_not_control_transactions import (
    RepositoriesDoNotControlTransactionsOptions,
    check_repositories_do_not_control_transactions,
)
from .scoped_responses_include_scope_ids import (
    ScopedResponsesIncludeScopeIdsOptions,
    check_scoped_responses_include_scope_ids,
)
from .sqlalchemy_query_columns_use_model_attributes import (
    SqlalchemyQueryColumnsUseModelAttributesOptions,
    check_sqlalchemy_query_columns_use_model_attributes,
)


class Rule(Protocol):
    """A deterministic source-level Python contract."""

    def __call__(self, source: str, *, path: str) -> list[Diagnostic]: ...


GENERAL_RULES: tuple[Rule, ...] = (
    check_no_underscore_pydantic_model_names,
    check_no_tuple_service_results,
    check_no_generic_domain_exceptions,
    check_repositories_do_not_control_transactions,
    check_sqlalchemy_query_columns_use_model_attributes,
)

SOFTWARE_FACTORY_RULES: tuple[Rule, ...] = (
    *GENERAL_RULES,
    partial(
        check_scoped_responses_include_scope_ids,
        options=ScopedResponsesIncludeScopeIdsOptions(
            organization_scoped_bases=frozenset({"OrganizationScopedResponse"}),
            project_scoped_bases=frozenset({"ProjectScopedResponse"}),
        ),
    ),
)


def rules_for_profile(profile: str) -> tuple[Rule, ...]:
    """Return the exact Python rule set for a CLI profile."""

    if profile == "general":
        return GENERAL_RULES
    if profile == "software-factory":
        return SOFTWARE_FACTORY_RULES
    raise ValueError(f"Unknown Python contract profile: {profile}")

__all__ = [
    "GENERAL_RULES",
    "NoTupleServiceResultsOptions",
    "NoGenericDomainExceptionsOptions",
    "RepositoriesDoNotControlTransactionsOptions",
    "Rule",
    "SOFTWARE_FACTORY_RULES",
    "ScopedResponsesIncludeScopeIdsOptions",
    "SqlalchemyQueryColumnsUseModelAttributesOptions",
    "check_no_generic_domain_exceptions",
    "check_no_tuple_service_results",
    "check_no_underscore_pydantic_model_names",
    "check_repositories_do_not_control_transactions",
    "check_scoped_responses_include_scope_ids",
    "check_sqlalchemy_query_columns_use_model_attributes",
    "rules_for_profile",
]
