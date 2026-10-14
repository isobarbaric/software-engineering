import assert from "node:assert/strict";
import test from "node:test";
import { Linter } from "eslint";
import parser from "@typescript-eslint/parser";
import { generalRules } from "../../../src/index.js";

const ruleName = "no-blank-lines-between-imports";
const linter = new Linter({ configType: "flat" });
const config = {
  files: ["**/*.{ts,tsx}"],
  languageOptions: { parser },
  plugins: { contracts: { rules: { [ruleName]: generalRules[ruleName] } } },
  rules: { [`contracts/${ruleName}`]: "error" },
};
const options = { filename: "Example.ts" };

const validCases = [
  ["adjacent imports", 'import "first";\nimport "second";'],
  ["imports on one line", 'import "first"; import "second";'],
  ["one import", 'import "first";\n\nconst value = 1;'],
  ["spacing before application code", 'import "first";\nimport "second";\n\nexport const value = 1;'],
  ["a comment-separated group", 'import "first";\n\n// Application imports\nimport "second";'],
  ["a block-comment separator", 'import "first";\n\n/* Application imports */\n\nimport "second";'],
  ["a trailing import comment", 'import "first"; // Initialize before consumers\n\nimport "second";'],
  ["spacing inside a multiline import", 'import {\n  first,\n\n  second,\n} from "module";\nimport "other";'],
  ["intervening statements", 'import "first";\nconst value = 1;\n\nimport "second";'],
  ["CommonJS declarations", 'const first = require("first");\n\nconst second = require("second");'],
  ["dynamic imports", 'import("first");\n\nimport("second");'],
];

for (const [name, code] of validCases) {
  test(`preserves ${name}`, () => {
    assert.deepEqual(linter.verify(code, config, options), []);
    const result = linter.verifyAndFix(code, config, options);
    assert.equal(result.fixed, false);
    assert.equal(result.output, code);
  });
}

const invalidCases = [
  {
    name: "one blank line",
    code: 'import "first";\n\nimport "second";',
    output: 'import "first";\nimport "second";',
  },
  {
    name: "multiple whitespace-only lines",
    code: 'import "first";\n \t\n\nimport "second";',
    output: 'import "first";\nimport "second";',
  },
  {
    name: "multiple import gaps without changing order",
    code: 'import "z-initialize";\n\nimport { value } from "b";\n\nimport type { Type } from "a";',
    output: 'import "z-initialize";\nimport { value } from "b";\nimport type { Type } from "a";',
    count: 2,
  },
  {
    name: "a gap after a multiline import",
    code: 'import {\n  first,\n  second,\n} from "module";\n\nimport "other";',
    output: 'import {\n  first,\n  second,\n} from "module";\nimport "other";',
  },
  {
    name: "TypeScript import-equals declarations",
    code: 'import First = require("first");\n\nimport Second = require("second");',
    output: 'import First = require("first");\nimport Second = require("second");',
  },
  {
    name: "mixed import forms",
    code: 'import First = require("first");\n\nimport type { Second } from "second";',
    output: 'import First = require("first");\nimport type { Second } from "second";',
  },
  {
    name: "semicolon-free imports",
    code: 'import "first"\n\nimport "second"',
    output: 'import "first"\nimport "second"',
  },
  {
    name: "a gap inside a documented group",
    code: 'import "first";\n\n// Application imports\nimport "second";\n\nimport "third";',
    output: 'import "first";\n\n// Application imports\nimport "second";\nimport "third";',
  },
  ...["\r\n", "\r", "\u2028", "\u2029"].map((newline) => ({
    name: `line-ending ${JSON.stringify(newline)}`,
    code: `import "first";${newline}${newline}  import "second";`,
    output: `import "first";${newline}  import "second";`,
  })),
];

for (const { name, code, output, count = 1 } of invalidCases) {
  test(`fixes ${name} without changing import text`, () => {
    const diagnostics = linter.verify(code, config, options);
    assert.equal(diagnostics.length, count);
    assert.ok(diagnostics.every(({ messageId }) => messageId === "blankLine"));
    const result = linter.verifyAndFix(code, config, options);
    assert.equal(result.fixed, true);
    assert.equal(result.output, output);
    assert.deepEqual(result.messages, []);
    assert.equal(linter.verifyAndFix(output, config, options).fixed, false);
  });
}

test("reports the next import at its exact location", () => {
  const [diagnostic] = linter.verify('import "first";\n\nimport "second";', config, options);
  assert.equal(diagnostic.message, "Remove blank lines between consecutive imports.");
  assert.equal(diagnostic.line, 3);
  assert.equal(diagnostic.column, 1);
  assert.equal(diagnostic.endLine, 3);
  assert.equal(diagnostic.endColumn, 17);
});
