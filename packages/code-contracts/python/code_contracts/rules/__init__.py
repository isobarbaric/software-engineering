"""Registry of Python contract rules executed by the CLI."""

from typing import Protocol

from code_contracts.diagnostics import Diagnostic


class Rule(Protocol):
    """A deterministic source-level Python contract."""

    def __call__(self, source: str, *, path: str) -> list[Diagnostic]: ...


RULES: tuple[Rule, ...] = ()

__all__ = ["RULES", "Rule"]
