import { Linter } from "eslint";
import parser from "@typescript-eslint/parser";

export function lintRule({ ruleName, rule, code, filename = "Example.tsx" }) {
  const linter = new Linter({ configType: "flat" });
  return linter.verify(
    code,
    {
      files: ["**/*.{ts,tsx}"],
      languageOptions: {
        parser,
        parserOptions: {
          ecmaVersion: "latest",
          sourceType: "module",
          ecmaFeatures: { jsx: true },
        },
      },
      plugins: {
        test: { rules: { [ruleName]: rule } },
      },
      rules: {
        [`test/${ruleName}`]: "error",
      },
    },
    { filename },
  );
}
