import assert from "node:assert/strict";
import test from "node:test";
import { generalRules } from "../../../src/index.js";
import { lintRule } from "../../lint-rule.js";

const ruleName = "query-keys-from-factories";

function messages(code, filename = "queries.ts") {
  return lintRule({
    ruleName,
    rule: generalRules[ruleName],
    code,
    filename,
  });
}

const validCases = [
  {
    name: "accepts a direct query-key factory call",
    code: `useQuery({ queryKey: projectQueryKeys.detail(projectId), queryFn });`,
  },
  {
    name: "accepts a static key owned by a query-key factory",
    code: `invalidateQueries({ queryKey: projectQueryKeys.all });`,
  },
  {
    name: "accepts nested factory groups",
    code: `useQuery({ queryKey: projectQueryKeys.detail.byId(projectId), queryFn });`,
  },
  {
    name: "accepts static computed factory members",
    code: `useQuery({ queryKey: projectQueryKeys["detail"](projectId), queryFn });`,
  },
  {
    name: "accepts a local queryKeys factory",
    code: `useQuery({ queryKey: queryKeys.list(filters), queryFn });`,
  },
  {
    name: "accepts TypeScript wrappers around a factory result",
    code: `useQuery({ queryKey: projectQueryKeys.detail(projectId) as QueryKey, queryFn });`,
  },
  {
    name: "accepts stacked TypeScript wrappers around static factory keys",
    code: `useQuery({ queryKey: (projectQueryKeys.all! satisfies QueryKey) as QueryKey, queryFn });`,
  },
  {
    name: "accepts factory keys in positional methods on a conventional client",
    code: `
      queryClient.getQueryData(projectQueryKeys.detail(projectId));
      queryClient.getQueryState(projectQueryKeys.detail(projectId));
      queryClient.setQueryData(projectQueryKeys.detail(projectId), project);
      queryClient.getQueryDefaults(projectQueryKeys.all);
      queryClient.setQueryDefaults(projectQueryKeys.all, { staleTime: Infinity });
    `,
  },
  {
    name: "tracks a client returned by an aliased useQueryClient import",
    code: `
      import { useQueryClient as useClient } from "@tanstack/react-query";
      const client = useClient();
      client.setQueryData(projectQueryKeys.detail(projectId), project);
    `,
  },
  {
    name: "tracks a client constructed from an aliased QueryClient import",
    code: `
      import { QueryClient as Client } from "@tanstack/react-query";
      const cache = new Client();
      cache.getQueryData(projectQueryKeys.detail(projectId));
    `,
  },
  {
    name: "tracks an explicitly typed QueryClient parameter",
    code: `
      import type { QueryClient } from "@tanstack/react-query";
      function seed(client: QueryClient) {
        client.setQueryData(projectQueryKeys.detail(projectId), project);
      }
    `,
  },
  {
    name: "tracks a defaulted typed QueryClient parameter",
    code: `
      import { QueryClient } from "@tanstack/react-query";
      function seed(client: QueryClient = new QueryClient()) {
        client.setQueryData(projectQueryKeys.detail(projectId), project);
      }
    `,
  },
  {
    name: "tracks QueryClient aliases",
    code: `
      import { useQueryClient } from "@tanstack/react-query";
      const cache = useQueryClient();
      const alias = cache;
      alias.getQueryState(projectQueryKeys.detail(projectId));
    `,
  },
  {
    name: "tracks namespace imports",
    code: `
      import * as TanStack from "@tanstack/react-query";
      const cache = TanStack.useQueryClient();
      cache.setQueryData(projectQueryKeys.detail(projectId), project);
    `,
  },
  {
    name: "tracks type-only namespace imports on parameters",
    code: `
      import type * as TanStack from "@tanstack/react-query";
      function seed(client: TanStack.QueryClient) {
        client.setQueryData(projectQueryKeys.detail(projectId), project);
      }
    `,
  },
  {
    name: "ignores positional method names on unrelated objects",
    code: `
      const client = createAnalyticsClient();
      client.setQueryData(["not", "a", "tanstack", "key"]);
    `,
  },
  {
    name: "ignores dynamic positional method names and calls without keys",
    code: `
      queryClient[method](["not", "statically", "known"]);
      queryClient.getQueryData();
    `,
  },
  {
    name: "respects a local shadow of an imported query-client hook",
    code: `
      import { useQueryClient } from "@tanstack/react-query";
      function inspect(useQueryClient: () => AnalyticsClient) {
        const client = useQueryClient();
        client.getQueryData(["analytics"]);
      }
    `,
  },
  {
    name: "ignores a tracked query-client binding reassigned before use",
    code: `
      import { useQueryClient } from "@tanstack/react-query";
      let client = useQueryClient();
      client = analyticsClient;
      client.getQueryData(["analytics"]);
    `,
  },
  {
    name: "does not leak typed parameter-property names across classes",
    code: `
      import type { QueryClient } from "@tanstack/react-query";
      class ProjectCache {
        constructor(private cache: QueryClient) {}
      }
      class AnalyticsCache {
        constructor(private cache: AnalyticsClient) {}
        read() { return this.cache.getQueryData(["analytics"]); }
      }
    `,
  },
  {
    name: "does not treat static or dynamically bound this as a typed instance property",
    code: `
      import type { QueryClient } from "@tanstack/react-query";
      class ProjectCache {
        constructor(private cache: QueryClient) {}
        static read() { return this.cache.getQueryData(["static"]); }
        static { this.cache.getQueryData(["static-block"]); }
        callback() {
          return function read() {
            return this.cache.getQueryData(["dynamic-this"]);
          };
        }
      }
    `,
  },
  {
    name: "ignores properties other than queryKey",
    code: `useMutation({ mutationKey: ["projects"], mutationFn });`,
  },
  {
    name: "ignores query-key properties used as type declarations",
    code: `interface QueryContext { queryKey: readonly unknown[] }`,
  },
  {
    name: "ignores queryKey destructuring",
    code: `const { queryKey } = context;`,
  },
];

for (const fixture of validCases) {
  test(fixture.name, () => {
    assert.deepEqual(messages(fixture.code, fixture.filename), []);
  });
}

const invalidCases = [
  {
    name: "rejects an inline query-key array",
    code: `useQuery({ queryKey: ["projects", projectId], queryFn });`,
  },
  {
    name: "rejects a spread that reconstructs a factory key",
    code: `useQuery({ queryKey: [...projectQueryKeys.detail(projectId)], queryFn });`,
  },
  {
    name: "rejects a query-key alias",
    code: `
      const key = projectQueryKeys.detail(projectId);
      useQuery({ queryKey: key, queryFn });
    `,
  },
  {
    name: "rejects queryKey shorthand properties",
    code: `
      const queryKey = projectQueryKeys.detail(projectId);
      useQuery({ queryKey, queryFn });
    `,
  },
  {
    name: "rejects later assignment of an inline query key",
    code: `options.queryKey = ["projects", projectId];`,
  },
  {
    name: "rejects aliases assigned to queryKey properties",
    code: `options["queryKey"] = key;`,
  },
  {
    name: "rejects static template-literal queryKey properties",
    code: `useQuery({ [\`queryKey\`]: ["projects"], queryFn });`,
  },
  {
    name: "rejects unrelated function calls",
    code: `useQuery({ queryKey: buildQueryKey(projectId), queryFn });`,
  },
  {
    name: "rejects members on objects not named as query-key factories",
    code: `useQuery({ queryKey: projectKeys.detail(projectId), queryFn });`,
  },
  {
    name: "rejects the factory object itself",
    code: `invalidateQueries({ queryKey: projectQueryKeys });`,
  },
  {
    name: "rejects dynamic factory members",
    code: `useQuery({ queryKey: projectQueryKeys[kind](projectId), queryFn });`,
  },
  {
    name: "rejects optional factory member access",
    code: `useQuery({ queryKey: projectQueryKeys?.detail(projectId), queryFn });`,
  },
  {
    name: "rejects optional factory invocation",
    code: `useQuery({ queryKey: projectQueryKeys.detail?.(projectId), queryFn });`,
  },
  {
    name: "rejects call helpers around factory functions",
    code: `useQuery({ queryKey: projectQueryKeys.detail.call(null, projectId), queryFn });`,
  },
  {
    name: "rejects every function helper around factory functions",
    code: `
      useQuery({ queryKey: projectQueryKeys.detail.apply(null, [projectId]), queryFn });
      useQuery({ queryKey: projectQueryKeys.detail.bind(null)(projectId), queryFn });
    `,
    count: 2,
  },
  {
    name: "rejects mutation of a returned factory key",
    code: `useQuery({ queryKey: projectQueryKeys.detail(projectId).slice(), queryFn });`,
  },
  {
    name: "rejects conditional key selection",
    code: `
      useQuery({
        queryKey: projectId
          ? projectQueryKeys.detail(projectId)
          : projectQueryKeys.all,
        queryFn,
      });
    `,
  },
  {
    name: "rejects logical key selection",
    code: `useQuery({ queryKey: overrideKey || projectQueryKeys.all, queryFn });`,
  },
  {
    name: "rejects inline keys passed to a conventionally named query client",
    code: `queryClient.setQueryData(["projects", projectId], project);`,
  },
  {
    name: "rejects aliases passed to positional QueryClient methods",
    code: `
      const key = projectQueryKeys.detail(projectId);
      queryClient.getQueryData(key);
    `,
  },
  {
    name: "rejects an inline key through useQueryClient",
    code: `
      import { useQueryClient } from "@tanstack/react-query";
      const client = useQueryClient();
      client.getQueryState(["projects", projectId]);
    `,
  },
  {
    name: "rejects an inline key through new QueryClient",
    code: `
      import { QueryClient } from "@tanstack/query-core";
      const cache = new QueryClient();
      cache.setQueryDefaults(["projects"], { staleTime: Infinity });
    `,
  },
  {
    name: "rejects an inline key through a typed parameter",
    code: `
      import type { QueryClient as Client } from "@tanstack/react-query";
      function read(cache: Client) {
        return cache.getQueryDefaults(["projects"]);
      }
    `,
  },
  {
    name: "rejects an inline key through a type-only namespace parameter",
    code: `
      import type * as TanStack from "@tanstack/react-query";
      function read(cache: TanStack.QueryClient) {
        return cache.getQueryData(["projects"]);
      }
    `,
  },
  {
    name: "rejects inline keys on direct useQueryClient calls",
    code: `
      import { useQueryClient } from "@tanstack/react-query";
      useQueryClient().getQueryData(["projects"]);
    `,
  },
  {
    name: "tracks TypeScript import-equals query-client namespaces",
    code: `
      import TanStack = require("@tanstack/react-query");
      const cache = TanStack.useQueryClient();
      cache.getQueryData(["projects"]);
    `,
  },
  {
    name: "tracks constructor-scoped bindings declared by QueryClient parameter properties",
    code: `
      import type { QueryClient } from "@tanstack/react-query";
      class ProjectCache {
        constructor(private cache: QueryClient) {
          cache.getQueryData(["projects"]);
        }
      }
    `,
  },
  {
    name: "tracks QueryClient parameter properties through class member access",
    code: `
      import type { QueryClient } from "@tanstack/react-query";
      class ProjectCache {
        constructor(private cache: QueryClient) {}
        read() { return this.cache.getQueryData(["projects"]); }
      }
    `,
  },
  {
    name: "tracks defaulted and statically computed QueryClient parameter properties",
    code: `
      import { QueryClient } from "@tanstack/react-query";
      class ProjectCache {
        constructor(private cache: QueryClient = new QueryClient()) {}
        read() { return this["cache"].getQueryData(["projects"]); }
      }
    `,
  },
  {
    name: "rejects static computed positional methods on client members",
    code: `services.queryClient["setQueryData"](["projects"], project);`,
  },
  {
    name: "enforces the rule in test files",
    code: `useQuery({ queryKey: ["projects"], queryFn });`,
    filename: "queries.test.ts",
  },
  {
    name: "enforces the rule in story files",
    code: `useQuery({ queryKey: ["projects"], queryFn });`,
    filename: "Project.story.tsx",
  },
  {
    name: "enforces the rule in generated files",
    code: `useQuery({ queryKey: ["projects"], queryFn });`,
    filename: "queries.generated.ts",
  },
];

for (const fixture of invalidCases) {
  test(fixture.name, () => {
    const result = messages(fixture.code, fixture.filename);
    assert.equal(result.length, fixture.count ?? 1);
    assert.ok(result.every((message) => message.messageId === "factory"));
  });
}

test("reports invalid query keys once and in source order", () => {
  const result = messages(`
    useQuery({ queryKey: ["first"], queryFn: first });
    queryClient.getQueryData(buildKey());
    useQuery({ queryKey: secondQueryKeys.all, queryFn: second });
    queryClient.setQueryData(key, value);
  `);

  assert.deepEqual(
    result.map((message) => [message.line, message.messageId]),
    [
      [2, "factory"],
      [3, "factory"],
      [5, "factory"],
    ],
  );
});

test("reports the exact factory diagnostic, count, order, and locations", () => {
  const result = messages(`useQuery({ queryKey: ["projects"], queryFn });
queryClient.getQueryData(buildKey());
options.queryKey = alias;`);

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
        messageId: "factory",
        message:
          "Build this query key directly from an owning `*QueryKeys` factory without aliases, spreads, or conditional reconstruction.",
        line: 1,
        column: 22,
        endLine: 1,
        endColumn: 34,
      },
      {
        messageId: "factory",
        message:
          "Build this query key directly from an owning `*QueryKeys` factory without aliases, spreads, or conditional reconstruction.",
        line: 2,
        column: 26,
        endLine: 2,
        endColumn: 36,
      },
      {
        messageId: "factory",
        message:
          "Build this query key directly from an owning `*QueryKeys` factory without aliases, spreads, or conditional reconstruction.",
        line: 3,
        column: 20,
        endLine: 3,
        endColumn: 25,
      },
    ],
  );
});
