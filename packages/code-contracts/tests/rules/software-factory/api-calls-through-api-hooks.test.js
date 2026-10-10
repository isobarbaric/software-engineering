import assert from "node:assert/strict";
import test from "node:test";

import { softwareFactoryRules } from "../../../src/index.js";
import { lintRule } from "../../lint-rule.js";

const ruleName = "software-factory/api-calls-through-api-hooks";
const componentFilename =
  "frontend/src/app/projects/components/ProjectPanel.tsx";

function messages(code, filename = componentFilename) {
  return lintRule({
    ruleName,
    rule: softwareFactoryRules[ruleName],
    code,
    filename,
  });
}

const allowedBoundaryFiles = [
  "frontend/src/app/projects/hooks/api/useGetProject.ts",
  "frontend/src/lib/api/client.ts",
  "frontend/src/lib/http/request.ts",
  "frontend/src/lib/upload/put-object.ts",
  "frontend/src/lib/uploads/put-object.ts",
];

for (const filename of allowedBoundaryFiles) {
  test(`allows transport calls in ${filename}`, () => {
    assert.deepEqual(
      messages(
        `export function request() {
          const api = useV2Api();
          return fetch("/projects");
        }`,
        filename,
      ),
      [],
    );
  });
}

test("normalizes Windows paths before matching an allowed boundary", () => {
  assert.deepEqual(
    messages(
      `export const request = () => fetch("/projects");`,
      "C:\\repo\\frontend\\src\\app\\projects\\hooks\\api\\useGetProject.ts",
    ),
    [],
  );
});

const validCases = [
  {
    name: "ignores similarly named local helpers",
    code: `fetchProjects(); useApi(); useProjectApi();`,
  },
  {
    name: "ignores references that are not calls",
    code: `const transports = { fetch, useV2Api };`,
  },
  {
    name: "ignores computed members because their runtime identity is unknown",
    code: `transport[method]("/projects");`,
  },
  {
    name: "does not treat a hooks api lookalike directory as a boundary",
    code: `const value = 1;`,
    filename: "frontend/src/app/projects/hooks/apiary/useGetProject.ts",
  },
  {
    name: "does not treat an api-client lookalike directory as a boundary",
    code: `const value = 1;`,
    filename: "frontend/src/lib/api-client/request.ts",
  },
];

for (const fixture of validCases) {
  test(fixture.name, () => {
    assert.deepEqual(messages(fixture.code, fixture.filename), []);
  });
}

const invalidCases = [
  {
    name: "rejects a direct fetch call",
    code: `fetch("/projects");`,
    calledName: "fetch",
  },
  {
    name: "rejects a globalThis fetch call",
    code: `globalThis.fetch("/projects");`,
    calledName: "fetch",
  },
  {
    name: "rejects a window fetch call",
    code: `window.fetch("/projects");`,
    calledName: "fetch",
  },
  {
    name: "rejects a transport member named fetch",
    code: `transport.fetch("/projects");`,
    calledName: "fetch",
  },
  {
    name: "rejects a direct useV2Api call",
    code: `const api = useV2Api();`,
    calledName: "useV2Api",
  },
  {
    name: "rejects a qualified useV2Api call",
    code: `const api = hooks.useV2Api();`,
    calledName: "useV2Api",
  },
  {
    name: "rejects an optional fetch call",
    code: `transport.fetch?.("/projects");`,
    calledName: "fetch",
  },
  {
    name: "rejects a TypeScript-wrapped fetch call",
    code: `(fetch as typeof fetch)("/projects");`,
    calledName: "fetch",
  },
  {
    name: "rejects a statically computed fetch call",
    code: `transport["fetch"]("/projects");`,
    calledName: "fetch",
  },
  {
    name: "rejects a static template-literal useV2Api call",
    code: `hooks[\`useV2Api\`]();`,
    calledName: "useV2Api",
  },
  {
    name: "rejects transport calls in a hooks api lookalike directory",
    code: `fetch("/projects");`,
    filename: "frontend/src/app/projects/hooks/apiary/useGetProject.ts",
    calledName: "fetch",
  },
  {
    name: "rejects transport calls in an api-client lookalike directory",
    code: `useV2Api();`,
    filename: "frontend/src/lib/api-client/request.ts",
    calledName: "useV2Api",
  },
  {
    name: "does not exempt test files",
    code: `fetch("/projects");`,
    filename: "frontend/src/app/projects/ProjectPanel.test.tsx",
    calledName: "fetch",
  },
  {
    name: "does not exempt story files",
    code: `useV2Api();`,
    filename: "frontend/src/app/projects/ProjectPanel.stories.tsx",
    calledName: "useV2Api",
  },
  {
    name: "does not exempt generated files",
    code: `fetch("/projects");`,
    filename: "frontend/src/app/projects/generated/client.ts",
    calledName: "fetch",
  },
];

for (const fixture of invalidCases) {
  test(fixture.name, () => {
    const result = messages(fixture.code, fixture.filename);
    assert.equal(result.length, 1);
    assert.equal(result[0].ruleId, `test/${ruleName}`);
    assert.equal(result[0].severity, 2);
    assert.equal(result[0].messageId, "boundary");
    assert.match(result[0].message, new RegExp(`^${fixture.calledName} belongs`));
  });
}

test("reports every forbidden call once and in source order", () => {
  const result = messages(`
    const api = useV2Api();
    const response = fetch("/projects");
    window.fetch("/organizations");
  `);

  assert.deepEqual(
    result.map(({ messageId, line, column }) => ({ messageId, line, column })),
    [
      { messageId: "boundary", line: 2, column: 17 },
      { messageId: "boundary", line: 3, column: 22 },
      { messageId: "boundary", line: 4, column: 5 },
    ],
  );
  assert.match(result[0].message, /^useV2Api belongs/);
  assert.match(result[1].message, /^fetch belongs/);
  assert.match(result[2].message, /^fetch belongs/);
});
