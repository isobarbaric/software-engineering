import assert from "node:assert/strict";
import test from "node:test";
import { generalRules } from "../../../src/index.js";
import { lintRule } from "../../lint-rule.js";

const ruleName = "explicit-react-hook-generics";

function messages(code, filename = "Example.tsx") {
  return lintRule({
    ruleName,
    rule: generalRules[ruleName],
    code,
    filename,
  });
}

function reportedApis(code, filename) {
  return messages(code, filename).map(({ messageId, message }) => ({
    messageId,
    message,
  }));
}

function missing(api) {
  return {
    messageId: "missing",
    message: `Add an explicit type argument to React.${api}.`,
  };
}

const ignoredCases = [
  {
    name: "ignores named, namespace, and CommonJS bindings from unrelated packages",
    code: `
      import Other, { useMemo, useState as stateHook } from "state-library";
      const Preact = require("preact/compat");
      useMemo(work, []);
      stateHook(0);
      Other.useRef(null);
      Preact.useReducer(reducer, initial);
    `,
  },
  {
    name: "ignores matching static members on unrelated objects",
    code: `
      stateLibrary.useState(0);
      stateLibrary["useMemo"](work, []);
      stateLibrary[\`useRef\`](null);
    `,
  },
  {
    name: "respects block shadows of named and namespace React imports",
    code: `
      import React, { useState } from "react";
      {
        const React = stateLibrary;
        const useState = localState;
        React.useRef(null);
        useState(0);
      }
    `,
  },
  {
    name: "ignores API aliases after a definite reassignment",
    code: `
      import { useState } from "react";
      let stateHook = useState;
      stateHook = localState;
      stateHook(0);
    `,
  },
  {
    name: "ignores namespace aliases after a definite reassignment",
    code: `
      import React from "react";
      let R = React;
      R = stateLibrary;
      R.useState(0);
    `,
  },
  {
    name: "does not infer dynamic computed members",
    code: `
      import React from "react";
      const useState = getHookName();
      React[useState](0);
      React[\`use\${suffix}\`](0);
    `,
  },
  {
    name: "does not infer dynamic computed destructuring keys",
    code: `
      import React from "react";
      const useState = getHookName();
      const { [useState]: stateHook } = React;
      stateHook(0);
    `,
  },
  {
    name: "accepts generics through optional calls and TypeScript wrappers",
    code: `
      import React, { useMemo } from "react";
      React?.useState<number>(0);
      React.useRef?.<HTMLDivElement>(null);
      (useMemo as typeof useMemo)<number>(work, []);
    `,
  },
];

for (const fixture of ignoredCases) {
  test(fixture.name, () => {
    assert.deepEqual(messages(fixture.code), []);
  });
}

test("reports a call before but not after an API alias is reassigned", () => {
  assert.deepEqual(
    reportedApis(`
      import { useState } from "react";
      let stateHook = useState;
      stateHook(0);
      stateHook = localState;
      stateHook(1);
    `),
    [missing("useState")],
  );
});

test("reports a call before but not after a namespace alias is reassigned", () => {
  assert.deepEqual(
    reportedApis(`
      import React from "react";
      let R = React;
      R.useRef(null);
      R = stateLibrary;
      R.useRef(null);
    `),
    [missing("useRef")],
  );
});

test("recognizes zero-expression template and TypeScript-wrapped literal members", () => {
  assert.deepEqual(
    reportedApis(`
      import React from "react";
      React[\`useState\`](0);
      React["useRef" as const](null);
      const memo = React[\`useMemo\`];
      memo(work, []);
    `),
    [missing("useState"), missing("useRef"), missing("useMemo")],
  );
});

test("recognizes static computed destructuring aliases", () => {
  assert.deepEqual(
    reportedApis(`
      import React from "react";
      const { ["useReducer" as const]: reducerHook } = React;
      reducerHook(reducer, initial);
    `),
    [missing("useReducer")],
  );
});

test("recognizes optional member and call chains", () => {
  assert.deepEqual(
    reportedApis(`
      import React from "react";
      React?.useState(0);
      React.useRef?.(null);
      React?.["useMemo"]?.(work, []);
    `),
    [missing("useState"), missing("useRef"), missing("useMemo")],
  );
});

test("reports exact ranges for optional and computed call chains", () => {
  const result = messages(`import React from "react";\nReact?.[\`useMemo\`]?.(work, []);`);

  assert.deepEqual(
    result.map(
      ({ messageId, message, line, column, endLine, endColumn }) => ({
        messageId,
        message,
        line,
        column,
        endLine,
        endColumn,
      }),
    ),
    [
      {
        messageId: "missing",
        message: "Add an explicit type argument to React.useMemo.",
        line: 2,
        column: 1,
        endLine: 2,
        endColumn: 31,
      },
    ],
  );
});

test("reports aliases captured before their source bindings are overwritten", () => {
  assert.deepEqual(
    reportedApis(`
      import React, { useState } from "react";
      let state = useState;
      const capturedState = state;
      let Framework = React;
      const capturedFramework = Framework;
      state = localState;
      Framework = stateLibrary;
      capturedState(0);
      capturedFramework.useRef(null);
    `),
    [missing("useState"), missing("useRef")],
  );
});

test("recognizes TypeScript-wrapped namespaces and callees", () => {
  assert.deepEqual(
    reportedApis(`
      import React, { useMemo, useRef } from "react";
      (React as typeof React).useState(0);
      (useRef as typeof useRef)(null);
      useMemo!(work, []);
    `),
    [missing("useState"), missing("useRef"), missing("useMemo")],
  );
});

test("reports multiple binding forms in source order", () => {
  assert.deepEqual(
    reportedApis(`
      import React, { useContext, useState as stateHook } from "react";
      stateHook(0);
      React.useRef(null);
      useContext(Context);
      require("react")["useMemo"](work, []);
    `),
    [
      missing("useState"),
      missing("useRef"),
      missing("useContext"),
      missing("useMemo"),
    ],
  );
});

test("enforces the rule in test, story, and generated files", () => {
  for (const filename of [
    "state.test.tsx",
    "State.story.tsx",
    "src/__stories__/State.tsx",
    "state.generated.tsx",
    "src/__generated__/state.tsx",
  ]) {
    assert.deepEqual(
      reportedApis(
        `import { useState } from "react"; useState(0);`,
        filename,
      ),
      [missing("useState")],
      filename,
    );
  }
});
