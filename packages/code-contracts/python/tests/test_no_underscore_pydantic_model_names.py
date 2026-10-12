from __future__ import annotations

import json
import os
import subprocess
import sys
import textwrap
import unittest
from pathlib import Path

PYTHON_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PYTHON_ROOT))

from code_contracts import check_no_underscore_pydantic_model_names


def check(source: str, path: str = "models.py"):
    return check_no_underscore_pydantic_model_names(textwrap.dedent(source), path=path)


class NoUnderscorePydanticModelNamesTests(unittest.TestCase):
    def test_rejects_the_reported_internal_result(self) -> None:
        diagnostics = check(
            "from pydantic import BaseModel\n"
            "class _DocumentTreeNodeInitializationResult(BaseModel):\n    pass\n"
        )
        self.assertEqual(len(diagnostics), 1)
        finding = diagnostics[0]
        self.assertEqual(finding.rule, "no-underscore-pydantic-model-names")
        self.assertEqual(finding.code, "underscore-model-name")
        self.assertEqual((finding.path, finding.line, finding.column), ("models.py", 2, 1))
        self.assertIn("_DocumentTreeNodeInitializationResult", finding.message)

    def test_recognizes_import_forms_and_parameterized_bases(self) -> None:
        for statement, base in [
            ("from pydantic import BaseModel as Model", "Model"),
            ("import pydantic", "pydantic.BaseModel"),
            ("import pydantic as pd", "pd.BaseModel"),
            ("from pydantic import RootModel", "RootModel[list[int]]"),
            ("from pydantic.v1 import BaseModel", "BaseModel"),
            ("import pydantic.v1 as pd", "pd.BaseModel"),
            ("import pydantic.v1", "pydantic.v1.BaseModel"),
            ("from pydantic import v1 as pd", "pd.BaseModel"),
            ("from pydantic.generics import GenericModel", "GenericModel"),
            ("from pydantic.main import BaseModel", "BaseModel"),
        ]:
            with self.subTest(statement=statement):
                self.assertEqual(len(check(f"{statement}\nclass _Model({base}): pass")), 1)

    def test_tracks_local_inheritance_and_base_aliases(self) -> None:
        self.assertEqual(len(check("""
            from pydantic import BaseModel
            class Parent(BaseModel): pass
            class Child(Parent): pass
            Alias = Child
            class _Result(object, Alias[int]): pass
            class __Result(_Result): pass
        """)), 2)

    def test_checks_nested_models_and_local_imports(self) -> None:
        self.assertEqual(len(check("""
            def factory():
                from pydantic import BaseModel
                class _Local(BaseModel): pass
            async def other_factory():
                import pydantic as pd
                class _Other(pd.RootModel[int]): pass
            class Container:
                from pydantic import BaseModel
                class _Nested(BaseModel): pass
        """)), 3)

    def test_accepts_public_models_and_unrelated_private_classes(self) -> None:
        self.assertEqual(check("""
            from pydantic import BaseModel
            class DocumentTreeNodeInitializationResult(BaseModel): pass
            class _Helper: pass
            from another_library import BaseModel
            class _Other(BaseModel): pass
        """), [])

    def test_respects_rebinding_and_parameter_shadowing(self) -> None:
        self.assertEqual(check("""
            import pydantic as pd
            from pydantic import BaseModel
            def factory(BaseModel, pd):
                class _Local(BaseModel): pass
                class _Other(pd.BaseModel): pass
            BaseModel = object
            class _Helper(BaseModel): pass
            class pd:
                class BaseModel: pass
            class _Other(pd.BaseModel): pass
        """), [])

    def test_nested_bindings_do_not_leak(self) -> None:
        self.assertEqual(check("""
            def factory():
                from pydantic import BaseModel
            class _Unresolved(BaseModel): pass
        """), [])

    def test_does_not_exempt_test_files(self) -> None:
        self.assertEqual(len(check(
            "from pydantic import BaseModel\nclass _Fixture(BaseModel): pass",
            path="tests/test_models.py",
        )), 1)

    def test_cli_enforces_both_profiles_and_accepts_the_rename(self) -> None:
        for profile in ("general", "software-factory"):
            for name, expected_status in (("_Result", 1), ("Result", 0)):
                with self.subTest(profile=profile, name=name):
                    result = subprocess.run(
                        [sys.executable, "-m", "code_contracts", "--stdin-json",
                         "--profile", profile, "--format", "json"],
                        input=json.dumps([{
                            "path": "models.py",
                            "source": f"from pydantic import BaseModel\nclass {name}(BaseModel): pass",
                        }]),
                        text=True,
                        capture_output=True,
                        env={**os.environ, "PYTHONPATH": str(PYTHON_ROOT)},
                    )
                    self.assertEqual(result.returncode, expected_status, result.stderr)
                    findings = json.loads(result.stdout)
                    self.assertEqual(len(findings), expected_status)
                    if findings:
                        self.assertEqual(findings[0]["rule"], "no-underscore-pydantic-model-names")


if __name__ == "__main__":
    unittest.main()
