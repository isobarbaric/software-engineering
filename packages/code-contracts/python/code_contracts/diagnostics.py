"""Shared diagnostic values for Python code contracts."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class Diagnostic:
    """One deterministic contract violation."""

    rule: str
    code: str
    message: str
    path: str
    line: int
    column: int
    end_line: int
    end_column: int

    def format(self) -> str:
        """Render a stable compiler-style diagnostic."""

        return (
            f"{self.path}:{self.line}:{self.column}: "
            f"{self.rule}/{self.code}: {self.message}"
        )
