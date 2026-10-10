import assert from "node:assert/strict";
import test from "node:test";
import { generalRules } from "../../../src/index.js";
import { lintRule } from "../../lint-rule.js";

const ruleName = "query-key-parameters-non-nullable";

function messages(code, filename = "query-keys.ts") {
  return lintRule({
    ruleName,
    rule: generalRules[ruleName],
    code,
    filename,
  });
}

const validCases = [
  {
    name: "accepts required primitive parameters",
    code: `
      const projectQueryKeys = {
        detail: (projectId: string, revision: number) =>
          ["projects", projectId, revision] as const,
      };
    `,
  },
  {
    name: "accepts zero-parameter root keys",
    code: `
      const projectQueryKeys = {
        all: () => ["projects"] as const,
      };
    `,
  },
  {
    name: "accepts required filter objects with nullable fields",
    code: `
      interface Filters { ownerId: string | null; archived?: boolean }
      const projectQueryKeys = {
        list: (filters: Filters) => ["projects", filters] as const,
      };
    `,
  },
  {
    name: "accepts defaults that normalize undefined",
    code: `
      const projectQueryKeys = {
        list: (page: number | undefined = 1) => ["projects", page] as const,
        search: (term = "") => ["projects", term] as const,
      };
    `,
  },
  {
    name: "accepts nested query-key factory groups",
    code: `
      const projectQueryKeys = {
        detail: {
          byId: (projectId: string) => ["projects", projectId] as const,
        },
      };
    `,
  },
  {
    name: "accepts object method syntax with required parameters",
    code: `
      const projectQueryKeys = {
        detail(projectId: string) { return ["projects", projectId] as const; },
      };
    `,
  },
  {
    name: "accepts required parameters in a builder-backed factory",
    code: `
      const projectQueryKeys = createQueryKeys("projects", {
        detail: (projectId: string) => [projectId] as const,
      });
    `,
  },
  {
    name: "accepts required parameters through TypeScript factory wrappers",
    code: `
      const projectQueryKeys = ({
        detail: (projectId: string) => ["projects", projectId] as const,
      } satisfies QueryKeyFactory) as QueryKeyFactory;
    `,
  },
  {
    name: "ignores array factories outside query-key containers",
    code: `
      const serializers = {
        values: (value?: string) => [value],
      };
    `,
  },
  {
    name: "ignores non-function values in query-key containers",
    code: `
      const projectQueryKeys = {
        root: ["projects"] as const,
      };
    `,
  },
  {
    name: "does not infer absence hidden behind a named type",
    code: `
      type ProjectId = string | undefined;
      const projectQueryKeys = {
        detail: (projectId: ProjectId) => ["projects", projectId] as const,
      };
    `,
  },
  {
    name: "ignores similarly named containers that are not query keys",
    code: `
      const keyboardKeys = {
        shortcut: (key?: string) => ["Meta", key],
      };
    `,
  },
];

for (const fixture of validCases) {
  test(fixture.name, () => {
    assert.deepEqual(messages(fixture.code, fixture.filename), []);
  });
}

const invalidCases = [
  {
    name: "rejects a nullable identifier parameter",
    code: `
      const projectQueryKeys = {
        detail: (projectId: string | null) => ["projects", projectId] as const,
      };
    `,
    messageIds: ["nullable"],
  },
  {
    name: "rejects an undefined identifier parameter",
    code: `
      const projectQueryKeys = {
        detail: (projectId: string | undefined) => ["projects", projectId] as const,
      };
    `,
    messageIds: ["nullable"],
  },
  {
    name: "rejects a parameter with both absence values",
    code: `
      const projectQueryKeys = {
        detail: (projectId: string | null | undefined) => ["projects", projectId] as const,
      };
    `,
    messageIds: ["nullable"],
  },
  {
    name: "rejects optional parameters",
    code: `
      const projectQueryKeys = {
        list: (filters?: ProjectFilters) => ["projects", filters] as const,
      };
    `,
    messageIds: ["nullable"],
  },
  {
    name: "rejects any and unknown because they do not exclude absence",
    code: `
      const projectQueryKeys = {
        first: (params: any) => ["first", params] as const,
        second: (params: unknown) => ["second", params] as const,
      };
    `,
    messageIds: ["nullable", "nullable"],
  },
  {
    name: "rejects void parameters",
    code: `
      const projectQueryKeys = {
        detail: (projectId: string | void) => ["projects", projectId] as const,
      };
    `,
    messageIds: ["nullable"],
  },
  {
    name: "rejects parenthesized nullable unions",
    code: `
      const projectQueryKeys = {
        detail: (projectId: (string | null)) => ["projects", projectId] as const,
      };
    `,
    messageIds: ["nullable"],
  },
  {
    name: "rejects null even when a default normalizes undefined",
    code: `
      const projectQueryKeys = {
        detail: (projectId: string | null | undefined = "root") =>
          ["projects", projectId] as const,
      };
    `,
    messageIds: ["nullable"],
  },
  {
    name: "rejects defaults that introduce null or undefined",
    code: `
      const projectQueryKeys = {
        first: (projectId = null) => ["first", projectId] as const,
        second: (projectId = undefined) => ["second", projectId] as const,
      };
    `,
    messageIds: ["nullable", "nullable"],
  },
  {
    name: "rejects a void-expression default",
    code: `
      const projectQueryKeys = {
        detail: (projectId = void 0) => ["projects", projectId] as const,
      };
    `,
    messageIds: ["nullable"],
  },
  {
    name: "rejects nullable object method parameters",
    code: `
      const projectQueryKeys = {
        detail(projectId: string | null) {
          return ["projects", projectId] as const;
        },
      };
    `,
    messageIds: ["nullable"],
  },
  {
    name: "rejects nullable parameters in nested factory groups",
    code: `
      const projectQueryKeys = {
        detail: {
          byId: (projectId: string | undefined) => ["projects", projectId] as const,
        },
      };
    `,
    messageIds: ["nullable"],
  },
  {
    name: "rejects nullable parameters in a builder-backed factory",
    code: `
      const projectQueryKeys = createQueryKeys("projects", {
        detail: (projectId: string | null) => [projectId] as const,
      });
    `,
    messageIds: ["nullable"],
  },
  {
    name: "rejects absence in rest and destructured parameters",
    code: `
      const projectQueryKeys = {
        spread: (...parts: any) => ["projects", ...parts] as const,
        detail: ({ id }: { id: string } | null) => ["projects", id] as const,
      };
    `,
    messageIds: ["nullable", "nullable"],
  },
  {
    name: "rejects nullable parameters on a directly declared factory function",
    code: `
      const projectQueryKeys = function (projectId?: string) {
        return ["projects", projectId] as const;
      };
    `,
    messageIds: ["nullable"],
  },
  {
    name: "recognizes local lowercase queryKeys containers",
    code: `
      function createProjectQueries() {
        const queryKeys = {
          detail: (projectId?: string) => ["projects", projectId] as const,
        };
        return queryKeys;
      }
    `,
    messageIds: ["nullable"],
  },
  {
    name: "reports every invalid parameter in source order",
    code: `
      export const projectQueryKeys = {
        detail: (
          projectId: string | null,
          revision: number | undefined,
          locale?: string,
        ) => ["projects", projectId, revision, locale] as const,
      };
    `,
    messageIds: ["nullable", "nullable", "nullable"],
  },
  {
    name: "enforces the rule in test files",
    code: `
      const projectQueryKeys = {
        detail: (projectId?: string) => ["projects", projectId] as const,
      };
    `,
    filename: "query-keys.test.ts",
    messageIds: ["nullable"],
  },
  {
    name: "enforces the rule in generated files",
    code: `
      const projectQueryKeys = {
        detail: (projectId: string | null) => ["projects", projectId] as const,
      };
    `,
    filename: "query-keys.generated.ts",
    messageIds: ["nullable"],
  },
  {
    name: "enforces the rule in story files",
    code: `
      const projectQueryKeys = {
        detail: (projectId?: string) => ["projects", projectId] as const,
      };
    `,
    filename: "query-keys.stories.ts",
    messageIds: ["nullable"],
  },
];

for (const fixture of invalidCases) {
  test(fixture.name, () => {
    const result = messages(fixture.code, fixture.filename);
    assert.deepEqual(
      result.map((message) => message.messageId),
      fixture.messageIds,
    );
  });
}

test("reports exact parameter data, count, order, and locations", () => {
  const result = messages(`const projectQueryKeys = {
  detail: (
    projectId: string | null,
    { locale }: { locale: string } | undefined,
    ...parts: unknown
  ) => ["projects", projectId, locale, parts] as const,
};`);

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
        messageId: "nullable",
        message:
          "Query-key factory parameter projectId must be required and exclude null and undefined. Normalize or gate the value before building the key.",
        line: 3,
        column: 5,
        endLine: 3,
        endColumn: 29,
      },
      {
        messageId: "nullable",
        message:
          "Query-key factory parameter this parameter must be required and exclude null and undefined. Normalize or gate the value before building the key.",
        line: 4,
        column: 5,
        endLine: 4,
        endColumn: 47,
      },
      {
        messageId: "nullable",
        message:
          "Query-key factory parameter parts must be required and exclude null and undefined. Normalize or gate the value before building the key.",
        line: 5,
        column: 5,
        endLine: 5,
        endColumn: 22,
      },
    ],
  );
});
