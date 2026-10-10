"""Command-line entrypoint for Python code contracts."""

from __future__ import annotations

import argparse
import ast
import json
import sys
from pathlib import Path
from typing import Iterable

from code_contracts import Diagnostic
from code_contracts.rules import RULES


def _python_files(paths: Iterable[str]) -> Iterable[Path]:
    for raw_path in paths:
        path = Path(raw_path)
        if path.is_file() and path.suffix == ".py":
            yield path
        elif path.is_dir():
            yield from (
                candidate
                for candidate in sorted(path.rglob("*.py"))
                if not any(part.startswith(".") for part in candidate.parts)
                and "__pycache__" not in candidate.parts
            )


def _syntax_diagnostic(path: str, error: SyntaxError) -> Diagnostic:
    line = error.lineno or 1
    column = error.offset or 1
    end_line = error.end_lineno or line
    end_column = error.end_offset or column
    return Diagnostic(
        rule="python",
        code="syntax-error",
        message=error.msg,
        path=path,
        line=line,
        column=column,
        end_line=end_line,
        end_column=end_column,
    )


def _check_source(source: str, path: str) -> list[Diagnostic]:
    try:
        ast.parse(source, filename=path)
    except SyntaxError as error:
        return [_syntax_diagnostic(path, error)]
    return [diagnostic for rule in RULES for diagnostic in rule(source, path=path)]


def _stdin_sources() -> list[tuple[str, str]]:
    payload = json.load(sys.stdin)
    if not isinstance(payload, list):
        raise ValueError("stdin JSON must be an array of source objects")

    sources = []
    for entry in payload:
        if not isinstance(entry, dict):
            raise ValueError("each stdin source must be an object")
        path = entry.get("path")
        source = entry.get("source")
        if not isinstance(path, str) or not isinstance(source, str):
            raise ValueError("each stdin source requires string path and source fields")
        sources.append((path, source))
    return sources


def main() -> int:
    parser = argparse.ArgumentParser(prog="python3 -m code_contracts")
    parser.add_argument("paths", nargs="*", help="Python files or directories.")
    parser.add_argument(
        "--stdin-json",
        action="store_true",
        help="Read [{path, source}] objects from stdin instead of files.",
    )
    parser.add_argument(
        "--format",
        choices=["text", "json"],
        default="text",
        help="Diagnostic output format.",
    )
    arguments = parser.parse_args()

    if arguments.stdin_json and arguments.paths:
        parser.error("paths cannot be combined with --stdin-json")
    if not arguments.stdin_json and not arguments.paths:
        parser.error("provide paths or --stdin-json")

    if arguments.stdin_json:
        sources = _stdin_sources()
    else:
        sources = [
            (str(path), path.read_text(encoding="utf-8"))
            for path in _python_files(arguments.paths)
        ]

    diagnostics = [
        diagnostic
        for path, source in sources
        for diagnostic in _check_source(source, path)
    ]
    diagnostics.sort(key=lambda item: (item.path, item.line, item.column, item.rule))

    if arguments.format == "json":
        print(
            json.dumps(
                [
                    {
                        "rule": diagnostic.rule,
                        "code": diagnostic.code,
                        "message": diagnostic.message,
                        "path": diagnostic.path,
                        "line": diagnostic.line,
                        "column": diagnostic.column,
                        "end_line": diagnostic.end_line,
                        "end_column": diagnostic.end_column,
                    }
                    for diagnostic in diagnostics
                ]
            )
        )
    else:
        for diagnostic in diagnostics:
            print(diagnostic.format())
    return 1 if diagnostics else 0


if __name__ == "__main__":
    raise SystemExit(main())
