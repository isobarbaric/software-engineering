import assert from "node:assert/strict";
import test from "node:test";
import { generalRules } from "../../../src/index.js";
import { lintRule } from "../../lint-rule.js";

const ruleName = "no-redundant-nullable-optionals";

function messages(code, filename = "contracts.ts") {
  return lintRule({
    ruleName,
    rule: generalRules[ruleName],
    code,
    filename,
  });
}

const validCases = [
  {
    name: "accepts optional properties with non-nullish values",
    code: `interface Selection { selectedId?: string; revision?: number }`,
  },
  {
    name: "accepts required properties with explicit absence values",
    code: `
      interface Selection {
        selectedId: string | null;
        revision: number | undefined;
        payload: unknown;
      }
    `,
  },
  {
    name: "accepts nullable data nested inside a present value",
    code: `
      interface Selection {
        ids?: Array<string | null>;
        filters?: { ownerId: string | null; archived?: boolean };
        result?: Promise<string | undefined>;
      }
    `,
  },
  {
    name: "accepts optional callbacks whose return value is nullable",
    code: `
      interface Callbacks {
        resolve?: () => string | null;
        load?(): Promise<string | undefined>;
      }
    `,
  },
  {
    name: "accepts non-nullable utility types",
    code: `interface Selection { selectedId?: NonNullable<string | null> }`,
  },
  {
    name: "accepts optional never properties used to forbid a variant field",
    code: `
      type Result =
        | { kind: "success"; error?: never }
        | { kind: "failure"; error: Error };
    `,
  },
  {
    name: "does not infer nullability hidden behind a named type",
    code: `
      type Maybe<T> = T | null;
      interface Selection { selectedId?: Maybe<string> }
    `,
  },
  {
    name: "allows an intentional three-state property through a narrow suppression",
    code: `
      interface ProjectPatch {
        // eslint-disable-next-line test/no-redundant-nullable-optionals -- PATCH contract: omitted preserves; null clears.
        name?: string | null;
      }
    `,
  },
  {
    name: "does not inspect optional function parameters",
    code: `function select(id?: string | null): void { void id; }`,
  },
  {
    name: "accepts mapped properties that remove optionality",
    code: `type Complete<T> = { [Key in keyof T]-?: T[Key] | null };`,
  },
];

for (const fixture of validCases) {
  test(fixture.name, () => {
    assert.deepEqual(messages(fixture.code, fixture.filename), []);
  });
}

const invalidCases = [
  {
    name: "rejects null on an optional interface property",
    code: `interface Selection { selectedId?: string | null }`,
    types: "`null`",
  },
  {
    name: "rejects undefined on an optional type-literal property",
    code: `type Selection = { selectedId?: string | undefined };`,
    types: "`undefined`",
  },
  {
    name: "rejects void on an optional readonly property",
    code: `interface Selection { readonly selectedId?: string | void }`,
    types: "`void`",
  },
  {
    name: "rejects any because it does not establish a non-nullish value",
    code: `interface Selection { selectedId?: any }`,
    types: "`any`",
  },
  {
    name: "rejects unknown because it does not establish a non-nullish value",
    code: `interface Selection { selectedId?: unknown }`,
    types: "`unknown`",
  },
  {
    name: "rejects parenthesized top-level absence values",
    code: `interface Selection { selectedId?: (string | null | undefined) }`,
    types: "`null`, `undefined`",
  },
  {
    name: "rejects quoted property names",
    code: `interface Selection { "selected-id"?: string | null }`,
    types: "`null`",
  },
  {
    name: "rejects optional class fields",
    code: `class Selection { selectedId?: string | null }`,
    types: "`null`",
  },
  {
    name: "rejects optional declared class fields",
    code: `class Selection { declare selectedId?: string | undefined }`,
    types: "`undefined`",
  },
  {
    name: "rejects optional accessor properties",
    code: `class Selection { accessor selectedId?: string | null }`,
    types: "`null`",
  },
  {
    name: "rejects optional constructor parameter properties",
    code: `class Selection { constructor(public selectedId?: string | null) {} }`,
    types: "`null`",
  },
  {
    name: "rejects optional mapped properties",
    code: `type Patch<T> = { [Key in keyof T]?: T[Key] | null };`,
    types: "`null`",
  },
  {
    name: "rejects mapped properties that explicitly add optionality",
    code: `type Patch<T> = { [Key in keyof T]+?: T[Key] | undefined };`,
    types: "`undefined`",
  },
  {
    name: "does not create an implicit exemption for Patch type names",
    code: `interface ProjectPatch { name?: string | null }`,
    types: "`null`",
  },
  {
    name: "does not create an implicit exemption for Update type names",
    code: `interface UpdateProjectRequest { name?: string | null }`,
    types: "`null`",
  },
  {
    name: "enforces the rule in test files",
    code: `interface ProjectFixture { name?: string | null }`,
    filename: "contracts.test.ts",
    types: "`null`",
  },
  {
    name: "enforces the rule in story files",
    code: `interface ProjectStory { name?: string | null }`,
    filename: "Project.story.tsx",
    types: "`null`",
  },
  {
    name: "enforces the rule in generated files",
    code: `interface GeneratedProject { name?: string | null }`,
    filename: "contracts.generated.ts",
    types: "`null`",
  },
];

for (const fixture of invalidCases) {
  test(fixture.name, () => {
    const result = messages(fixture.code, fixture.filename);
    assert.equal(result.length, 1);
    assert.equal(result[0].messageId, "duplicateAbsence");
    assert.ok(result[0].message.includes(fixture.types));
  });
}

test("reports every invalid property once and in source order", () => {
  const result = messages(`
    interface Selection {
      first?: string | null | undefined;
      second?: any;
      third?: string;
      fourth?: unknown | null;
    }
  `);

  assert.deepEqual(
    result.map((message) => [message.line, message.messageId]),
    [
      [3, "duplicateAbsence"],
      [4, "duplicateAbsence"],
      [6, "duplicateAbsence"],
    ],
  );
});

test("a narrow suppression does not exempt the next property", () => {
  const result = messages(`
    interface ProjectPatch {
      // eslint-disable-next-line test/no-redundant-nullable-optionals -- PATCH contract: omitted preserves; null clears.
      name?: string | null;
      description?: string | null;
    }
  `);

  assert.equal(result.length, 1);
  assert.equal(result[0].line, 5);
  assert.equal(result[0].messageId, "duplicateAbsence");
});

test("reports exact property data, type order, count, and locations", () => {
  const result = messages(`interface Contract {
  "selected-id"?: string | null | undefined | void | any | unknown;
  ready?: boolean;
  count?: number | null;
}`);

  assert.deepEqual(
    result.map(({ messageId, message, line, column, endLine, endColumn }) => ({
      messageId,
      message,
      line,
      column,
      endLine,
      endColumn,
    })),
    [
      {
        messageId: "duplicateAbsence",
        message:
          "Optional property `selected-id` has a value type that does not exclude `null`, `undefined`, `void`, `any`, `unknown`. Use optionality as the absence contract or make the property required.",
        line: 2,
        column: 3,
        endLine: 2,
        endColumn: 68,
      },
      {
        messageId: "duplicateAbsence",
        message:
          "Optional property `count` has a value type that does not exclude `null`. Use optionality as the absence contract or make the property required.",
        line: 4,
        column: 3,
        endLine: 4,
        endColumn: 25,
      },
    ],
  );
});
