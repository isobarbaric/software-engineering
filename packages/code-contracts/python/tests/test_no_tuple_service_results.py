from __future__ import annotations

import sys
import textwrap
import unittest
from pathlib import Path

PYTHON_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PYTHON_ROOT))

from code_contracts import (  # noqa: E402
    NoTupleServiceResultsOptions,
    check_no_tuple_service_results,
)


def check(source: str, *, path: str = "service.py", options=None):
    return check_no_tuple_service_results(
        textwrap.dedent(source), path=path, options=options
    )


class NoTupleServiceResultsTests(unittest.TestCase):
    def assert_codes(self, source: str, *codes: str, **kwargs) -> None:
        self.assertEqual(
            [diagnostic.code for diagnostic in check(source, **kwargs)],
            list(codes),
        )

    def test_accepts_a_pydantic_result_model(self) -> None:
        self.assert_codes(
            """
            from pydantic import BaseModel

            class RenameNodeResult(BaseModel):
                node: object
                replacements: dict[str, str]

            class RenameNodeService:
                def rename(self) -> RenameNodeResult:
                    return RenameNodeResult(node=object(), replacements={})
            """
        )

    def test_accepts_aliased_and_namespaced_pydantic_bases(self) -> None:
        self.assert_codes(
            """
            import pydantic as pd
            from pydantic import BaseModel as Model

            class FirstResult(Model):
                value: int

            class SecondResult(pd.BaseModel):
                value: int

            class ResultService:
                def first(self) -> FirstResult:
                    return FirstResult(value=1)

                def second(self) -> SecondResult:
                    return SecondResult(value=2)
            """
        )

    def test_accepts_a_transitive_pydantic_result_base(self) -> None:
        self.assert_codes(
            """
            from pydantic import BaseModel

            class ServiceResult(BaseModel):
                pass

            class CreateResult(ServiceResult):
                value: int

            class CreateService:
                def create(self) -> CreateResult:
                    return CreateResult(value=1)
            """
        )

    def test_accepts_single_values_and_homogeneous_collections(self) -> None:
        self.assert_codes(
            """
            from collections.abc import Sequence

            class Node: pass

            class ReadService:
                def one(self) -> Node: return Node()
                def many(self) -> Sequence[Node]: return []
                def mapping(self) -> dict[str, Node]: return {}
                def missing(self) -> None: return None
            """
        )

    def test_ignores_private_and_dunder_helpers(self) -> None:
        self.assert_codes(
            """
            class ReadService:
                def _pair(self) -> tuple[int, int]: return 1, 2
                def __iter__(self) -> tuple[int, int]: return 1, 2
            """
        )

    def test_ignores_non_service_classes(self) -> None:
        self.assert_codes(
            """
            class PairBuilder:
                def build(self) -> tuple[int, int]: return 1, 2
            """
        )

    def test_rejects_builtin_tuple_annotations_and_values(self) -> None:
        self.assert_codes(
            """
            class ReadService:
                def read(self) -> tuple[int, str]:
                    return 1, "one"
            """,
            "tuple-return-annotation",
            "tuple-return-value",
        )

    def test_rejects_imported_tuple_aliases(self) -> None:
        self.assert_codes(
            """
            from typing import Tuple as Product

            class ReadService:
                def read(self) -> Product[int, str]:
                    raise NotImplementedError
            """,
            "tuple-return-annotation",
        )

    def test_rejects_namespaced_tuple_annotations(self) -> None:
        self.assert_codes(
            """
            import typing as t

            class ReadService:
                def read(self) -> t.Tuple[int, str]:
                    raise NotImplementedError
            """,
            "tuple-return-annotation",
        )

    def test_rejects_tuples_nested_in_optional_and_collections(self) -> None:
        self.assert_codes(
            """
            from collections.abc import Sequence

            class ReadService:
                def optional(self) -> tuple[int, str] | None: return None
                def nested(self) -> Sequence[tuple[int, str]]: return []
            """,
            "tuple-return-annotation",
            "tuple-return-annotation",
        )

    def test_rejects_string_tuple_annotations(self) -> None:
        self.assert_codes(
            """
            class ReadService:
                def read(self) -> "tuple[int, str] | None":
                    return None
            """,
            "tuple-return-annotation",
        )

    def test_rejects_empty_and_single_item_tuple_values(self) -> None:
        self.assert_codes(
            """
            class ReadService:
                def empty(self): return ()
                def single(self): return (1,)
            """,
            "tuple-return-value",
            "tuple-return-value",
        )

    def test_rejects_tuple_constructor_results(self) -> None:
        self.assert_codes(
            """
            class ReadService:
                def read(self, values):
                    return tuple(values)
            """,
            "tuple-return-value",
        )

    def test_rejects_a_tuple_propagated_through_local_aliases(self) -> None:
        self.assert_codes(
            """
            class ReadService:
                def read(self):
                    pair = (1, 2)
                    result = pair
                    return result
            """,
            "tuple-return-value",
        )

    def test_does_not_retain_tuple_identity_after_reassignment(self) -> None:
        self.assert_codes(
            """
            class ReadService:
                def read(self):
                    result = (1, 2)
                    result = [1, 2]
                    return result
            """
        )

    def test_merges_definite_tuple_assignments_across_if_branches(self) -> None:
        self.assert_codes(
            """
            class ReadService:
                def read(self, condition):
                    if condition:
                        result = (1, 2)
                    else:
                        result = (3, 4)
                    return result
            """,
            "tuple-return-value",
        )

    def test_checks_returns_inside_control_flow(self) -> None:
        self.assert_codes(
            """
            class ReadService:
                def read(self, condition):
                    if condition:
                        return 1, 2
                    for item in []:
                        return item, item
                    return None
            """,
            "tuple-return-value",
            "tuple-return-value",
        )

    def test_checks_async_service_methods(self) -> None:
        self.assert_codes(
            """
            class ReadService:
                async def read(self) -> tuple[int, int]:
                    return 1, 2
            """,
            "tuple-return-annotation",
            "tuple-return-value",
        )

    def test_checks_classes_inheriting_a_local_service(self) -> None:
        self.assert_codes(
            """
            class BaseService: pass

            class SpecializedReader(BaseService):
                def read(self): return 1, 2
            """,
            "tuple-return-value",
        )

    def test_checks_classes_inheriting_an_imported_service_shaped_base(self) -> None:
        self.assert_codes(
            """
            class SpecializedReader(ExternalService):
                def read(self): return 1, 2
            """,
            "tuple-return-value",
        )

    def test_rejects_a_dataclass_result(self) -> None:
        self.assert_codes(
            """
            from dataclasses import dataclass

            @dataclass
            class RenameResult:
                value: int

            class RenameService:
                def rename(self) -> RenameResult:
                    return RenameResult(1)
            """,
            "non-pydantic-result",
            "non-pydantic-result",
        )

    def test_rejects_plain_result_classes(self) -> None:
        self.assert_codes(
            """
            class RenameResult:
                pass

            class RenameService:
                def rename(self) -> RenameResult:
                    return RenameResult()
            """,
            "non-pydantic-result",
            "non-pydantic-result",
        )

    def test_rejects_named_tuple_result_classes(self) -> None:
        self.assert_codes(
            """
            from typing import NamedTuple

            class RenameResult(NamedTuple):
                value: int

            class RenameService:
                def rename(self) -> RenameResult:
                    return RenameResult(1)
            """,
            "non-pydantic-result",
            "non-pydantic-result",
        )

    def test_rejects_typed_dict_result_classes(self) -> None:
        self.assert_codes(
            """
            import typing as t

            class RenameResult(t.TypedDict):
                value: int

            class RenameService:
                def rename(self) -> RenameResult:
                    return {"value": 1}
            """,
            "non-pydantic-result",
        )

    def test_rejects_functional_named_tuple_and_typed_dict_results(self) -> None:
        self.assert_codes(
            """
            from typing import NamedTuple as NT, TypedDict as TD

            FirstResult = NT("FirstResult", [("value", int)])
            SecondResult = TD("SecondResult", {"value": int})

            class ReadService:
                def first(self) -> FirstResult: return FirstResult(1)
                def second(self) -> SecondResult: return {"value": 2}
            """,
            "non-pydantic-result",
            "non-pydantic-result",
            "non-pydantic-result",
        )

    def test_rejects_non_pydantic_results_nested_in_a_union(self) -> None:
        self.assert_codes(
            """
            class RenameResult: pass

            class RenameService:
                def rename(self) -> RenameResult | None:
                    return None
            """,
            "non-pydantic-result",
        )

    def test_does_not_misclassify_domain_classes_as_result_envelopes(self) -> None:
        self.assert_codes(
            """
            from dataclasses import dataclass

            @dataclass
            class Node:
                value: int

            class ReadService:
                def read(self) -> Node:
                    return Node(1)
            """
        )

    def test_applies_in_test_and_generated_files(self) -> None:
        source = """
            class FakeService:
                def read(self): return 1, 2
        """
        self.assert_codes(source, "tuple-return-value", path="test_service.py")
        self.assert_codes(source, "tuple-return-value", path="generated_service.py")

    def test_allows_an_exact_framework_method_exemption(self) -> None:
        options = NoTupleServiceResultsOptions(
            exempt_methods=frozenset({"ProtocolService.call"})
        )
        self.assert_codes(
            """
            class ProtocolService:
                def call(self) -> tuple[int, int]: return 1, 2
                def other(self) -> tuple[int, int]: return 1, 2
            """,
            "tuple-return-annotation",
            "tuple-return-value",
            options=options,
        )

    def test_supports_configured_service_suffixes(self) -> None:
        options = NoTupleServiceResultsOptions(service_suffixes=("UseCase",))
        self.assert_codes(
            """
            class ReadUseCase:
                def execute(self): return 1, 2

            class ReadService:
                def read(self): return 3, 4
            """,
            "tuple-return-value",
            options=options,
        )

    def test_reports_stable_messages_and_locations(self) -> None:
        diagnostics = check(
            """
            class ReadService:
                def read(self) -> tuple[int, str]:
                    return 1, "one"
            """,
            path="backend/read_service.py",
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
                    "no-tuple-service-results",
                    "tuple-return-annotation",
                    "backend/read_service.py",
                    3,
                    23,
                ),
                (
                    "no-tuple-service-results",
                    "tuple-return-value",
                    "backend/read_service.py",
                    4,
                    16,
                ),
            ],
        )
        self.assertIn("named Pydantic model", diagnostics[0].message)

    def test_reports_multiple_methods_in_source_order(self) -> None:
        diagnostics = check(
            """
            class ReadService:
                def first(self): return 1, 2
                def second(self): return 3, 4
            """
        )
        self.assertEqual([diagnostic.line for diagnostic in diagnostics], [3, 4])


if __name__ == "__main__":
    unittest.main()
