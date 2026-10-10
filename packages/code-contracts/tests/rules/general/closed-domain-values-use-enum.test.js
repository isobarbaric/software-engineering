import assert from "node:assert/strict";
import test from "node:test";
import { generalRules } from "../../../src/index.js";
import { lintRule } from "../../lint-rule.js";

const ruleName = "closed-domain-values-use-enum";

function messages(code, filename = "Example.tsx") {
  return lintRule({
    ruleName,
    rule: generalRules[ruleName],
    code,
    filename,
  });
}

const validCases = [
  {
    name: "accepts enum-backed scalar domains",
    code: `
      enum ViewMode { Grid = "grid", List = "list" }
      const compact = mode === ViewMode.Grid || mode === ViewMode.List;
    `,
  },
  {
    name: "accepts enum-backed discriminated unions",
    code: `
      enum ResultKind { Success = "success", Failure = "failure" }
      type Result =
        | { kind: ResultKind.Success; value: string }
        | { kind: ResultKind.Failure; error: Error };
    `,
  },
  {
    name: "accepts enum members in an as-const array",
    code: `
      enum ViewMode { Grid = "grid", List = "list" }
      const modes = [ViewMode.Grid, ViewMode.List] as const;
    `,
  },
  {
    name: "ignores ordinary copy, paths, URLs, CSS, and DOM attributes",
    code: `
      import value from "./module";
      const title = "Projects";
      const url = "https://example.com";
      const style = { display: "grid", position: "relative" };
      const button = <button type="button" aria-label="Save">Save</button>;
    `,
  },
  {
    name: "does not classify member-expression branches as client-owned",
    code: `
      const retry = response.status === "queued" || response.status === "running";
      switch (response.status) {
        case "queued": break;
        case "running": break;
      }
    `,
  },
  {
    name: "does not classify reversed member-expression comparisons as client-owned",
    code: `const retry = "queued" === response.status || "running" !== response.status;`,
  },
  {
    name: "allows one literal because it is not a multi-value domain",
    code: `type OnlyMode = "grid";`,
  },
  {
    name: "allows duplicate-only unions because they contain one distinct value",
    code: `type OnlyMode = "grid" | "grid";`,
  },
  {
    name: "allows ordinary arrays because they are not declared closed sets",
    code: `const modes = ["grid", "list"];`,
  },
  {
    name: "allows one-element as-const arrays",
    code: `const modes = ["grid"] as const;`,
  },
  {
    name: "allows duplicate-only as-const arrays because they contain one distinct value",
    code: `const modes = ["grid", "grid"] as const;`,
  },
  {
    name: "allows heterogeneous as-const arrays",
    code: `const values = ["grid", 2] as const;`,
  },
  {
    name: "allows non-string literal unions",
    code: `type Result = 200 | 404 | true;`,
  },
  {
    name: "allows open string unions",
    code: `type ViewMode = string | "grid";`,
  },
  {
    name: "allows object unions without a shared string discriminant",
    code: `type Value = { name: "primary" } | { count: 2 };`,
  },
  {
    name: "allows object unions whose shared literal does not distinguish variants",
    code: `type Value = { kind: "value"; text: string } | { kind: "value"; count: number };`,
  },
  {
    name: "allows object unions with heterogeneous discriminant types",
    code: `type Value = { kind: "value" } | { kind: 2 };`,
  },
  {
    name: "allows a switch with one string case",
    code: `switch (mode) { case "grid": break; default: break; }`,
  },
  {
    name: "does not combine comparisons of different subjects",
    code: `const value = mode === "grid" || density === "compact";`,
  },
  {
    name: "does not treat repeated comparison values as a multi-value domain",
    code: `const value = mode === "grid" || mode !== "grid";`,
  },
  {
    name: "does not combine same-named identifiers from different lexical bindings",
    code: `
      function isGrid(mode: string) { return mode === "grid"; }
      function isList(mode: string) { return mode === "list"; }
    `,
  },
  {
    name: "does not combine a shadowed parameter with its outer binding",
    code: `
      function render(mode: string) {
        const outer = mode === "grid";
        function nested(mode: string) {
          return mode === "list";
        }
        return outer || nested(mode);
      }
    `,
  },
  {
    name: "allows enum members in a switch over a bare identifier",
    code: `
      enum ViewMode { Grid = "grid", List = "list" }
      switch (mode) {
        case ViewMode.Grid: break;
        case ViewMode.List: break;
      }
    `,
  },
  {
    name: "ignores non-equality comparisons",
    code: `const ordered = mode < "grid" || mode > "list";`,
  },
];

for (const fixture of validCases) {
  test(fixture.name, () => {
    assert.deepEqual(messages(fixture.code), []);
  });
}

const invalidCases = [
  {
    name: "rejects a scalar string-literal union",
    code: `type ViewMode = "grid" | "list";`,
    messageId: "union",
  },
  {
    name: "rejects scalar unions with more than two string literals",
    code: `type ViewMode = "grid" | "list" | "table";`,
    messageId: "union",
  },
  {
    name: "rejects closed string state",
    code: `const [mode] = useState<"grid" | "list">("grid");`,
    messageId: "union",
  },
  {
    name: "rejects a closed as-const string array",
    code: `const modes = ["grid", "list"] as const;`,
    messageId: "constSet",
  },
  {
    name: "rejects wrapped literals in a closed as-const string array",
    code: `const modes = [("grid"), "list" as const] as const;`,
    messageId: "constSet",
  },
  {
    name: "rejects a loose discriminated union",
    code: `
      type Result =
        | { kind: "success"; value: string }
        | { kind: "failure"; error: Error };
    `,
    messageId: "discriminant",
  },
  {
    name: "rejects any shared string discriminant name",
    code: `
      type Request =
        | { phase: "idle" }
        | { phase: "loading" }
        | { phase: "complete"; value: string };
    `,
    messageId: "discriminant",
  },
  {
    name: "rejects readonly quoted string discriminants",
    code: `
      type Result =
        | { readonly "result-kind": "success"; value: string }
        | { readonly "result-kind": "failure"; error: Error };
    `,
    messageId: "discriminant",
  },
  {
    name: "rejects optional computed string discriminants",
    code: `
      type Result =
        | { ["kind"]?: "success"; value: string }
        | { ["kind"]?: "failure"; error: Error };
    `,
    messageId: "discriminant",
  },
  {
    name: "rejects a loose literal mixed with enum discriminants",
    code: `
      enum ResultKind { Success = "success", Failure = "failure" }
      type Result =
        | { kind: ResultKind.Success; value: string }
        | { kind: "failure"; error: Error };
    `,
    messageId: "discriminant",
  },
  {
    name: "rejects repeated comparisons on one bare identifier",
    code: `const compact = mode === "grid" || mode === "list";`,
    messageId: "branch",
  },
  {
    name: "rejects reversed loose-equality comparisons on one bare identifier",
    code: `const compact = "grid" == mode || "list" != mode;`,
    messageId: "branch",
  },
  {
    name: "rejects TypeScript-wrapped literals in comparisons",
    code: `const compact = mode === ("grid" as const) || mode !== ("list" satisfies string);`,
    messageId: "branch",
  },
  {
    name: "aggregates comparisons across separate statements",
    code: `
      const grid = mode === "grid";
      const list = mode !== "list";
    `,
    messageId: "branch",
  },
  {
    name: "aggregates comparisons to one binding across a nested closure",
    code: `
      function render(mode: string) {
        const grid = mode === "grid";
        function isList() { return mode === "list"; }
        return grid || isList();
      }
    `,
    messageId: "branch",
  },
  {
    name: "rejects a switch over string cases on a bare identifier",
    code: `
      switch (mode) {
        case "grid": break;
        case "list": break;
      }
    `,
    messageId: "branch",
  },
  {
    name: "rejects a switch whose closed vocabulary includes the empty string",
    code: `
      switch (mode) {
        case "": break;
        case "ready": break;
        default: break;
      }
    `,
    messageId: "branch",
  },
];

for (const fixture of invalidCases) {
  test(fixture.name, () => {
    const result = messages(fixture.code);
    assert.equal(result.length, 1);
    assert.equal(result[0].messageId, fixture.messageId);
  });
}

test("exempts tests, stories, and generated files", () => {
  for (const filename of [
    "domain.test.ts",
    "domain.spec.ts",
    "Component.story.tsx",
    "Component.stories.tsx",
    "src/__tests__/domain.ts",
    "src/__stories__/Component.tsx",
    "src/generated/domain.ts",
    "src/__generated__/domain.ts",
    "domain.gen.ts",
    "domain.generated.ts",
    "src\\__tests__\\domain.ts",
    "src\\generated\\domain.ts",
  ]) {
    assert.deepEqual(
      messages(`type ViewMode = "grid" | "list";`, filename),
      [],
    );
  }
});

test("does not exempt filenames that merely resemble exempt conventions", () => {
  for (const filename of [
    "domain.test-helper.ts",
    "Component.stories-helper.tsx",
    "src/__tests__-helpers/domain.ts",
    "src/generated-code/domain.ts",
    "domain.generated-helper.ts",
  ]) {
    const result = messages(`type ViewMode = "grid" | "list";`, filename);
    assert.equal(result.length, 1, filename);
    assert.equal(result[0].messageId, "union", filename);
  }
});

test("reports exact diagnostic identities, messages, order, and coordinates", () => {
  const result = messages(`type ViewMode = "grid" | "list";
const modes = ["grid", "list"] as const;
const compact = mode === "grid" || mode !== "list";`);

  assert.deepEqual(
    result.map(({ ruleId, severity, messageId, message, line, column }) => ({
      ruleId,
      severity,
      messageId,
      message,
      line,
      column,
    })),
    [
      {
        ruleId: "test/closed-domain-values-use-enum",
        severity: 2,
        messageId: "union",
        message: "Replace this closed string-literal union with an enum.",
        line: 1,
        column: 17,
      },
      {
        ruleId: "test/closed-domain-values-use-enum",
        severity: 2,
        messageId: "constSet",
        message: "Replace this closed string `as const` set with an enum.",
        line: 2,
        column: 15,
      },
      {
        ruleId: "test/closed-domain-values-use-enum",
        severity: 2,
        messageId: "branch",
        message:
          "mode is compared against a closed string vocabulary (grid, list). Use an enum instead of loose strings.",
        line: 3,
        column: 17,
      },
    ],
  );
});

test("reports discriminant names and values in declaration order", () => {
  const [result] = messages(`
    type Result =
      | { phase: "idle"; value: string }
      | { phase: "loading"; pending: boolean }
      | { phase: "complete"; value: string };
  `);

  assert.equal(result.messageId, "discriminant");
  assert.equal(
    result.message,
    "Replace the loose phase discriminants (idle, loading, complete) with members of a dedicated enum.",
  );
});
