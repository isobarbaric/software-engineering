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

const genericApis = [
  "createContext",
  "use",
  "useActionState",
  "useCallback",
  "useContext",
  "useDebugValue",
  "useDeferredValue",
  "useEffectEvent",
  "useImperativeHandle",
  "useMemo",
  "useOptimistic",
  "useReducer",
  "useRef",
  "useState",
  "useSyncExternalStore",
];

for (const api of genericApis) {
  test(`accepts an explicit type argument on ${api}`, () => {
    assert.deepEqual(
      messages(`import { ${api} } from "react"; ${api}<unknown>(value);`),
      [],
    );
  });

  test(`requires an explicit type argument on ${api}`, () => {
    const result = messages(`import { ${api} } from "react"; ${api}(value);`);
    assert.equal(result.length, 1);
    assert.equal(result[0].messageId, "missing");
    assert.equal(result[0].message, `Add an explicit type argument to React.${api}.`);
  });
}

test("reports the complete diagnostic at the offending call expression", () => {
  const result = messages(`import { useState } from "react";\nuseState(0);`);

  assert.deepEqual(
    result.map(
      ({
        ruleId,
        severity,
        messageId,
        message,
        line,
        column,
        endLine,
        endColumn,
      }) => ({
        ruleId,
        severity,
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
        ruleId: "test/explicit-react-hook-generics",
        severity: 2,
        messageId: "missing",
        message: "Add an explicit type argument to React.useState.",
        line: 2,
        column: 1,
        endLine: 2,
        endColumn: 12,
      },
    ],
  );
});

const validCases = [
  {
    name: "accepts an aliased named import with a type argument",
    code: `import { useState as useReactState } from "react"; useReactState<number>(0);`,
  },
  {
    name: "accepts a default import member with a type argument",
    code: `import React from "react"; React.useState<number>(0);`,
  },
  {
    name: "accepts a namespace import member with a type argument",
    code: `import * as R from "react"; R.useState<number>(0);`,
  },
  {
    name: "accepts a quoted static member with a type argument",
    code: `import React from "react"; React["useState"]<number>(0);`,
  },
  {
    name: "ignores same-named imports from another package",
    code: `import { useState, useMemo } from "state-library"; useState(0); useMemo(work);`,
  },
  {
    name: "ignores local functions with React API names",
    code: `
      function useState(value) { return value; }
      const createContext = (value) => value;
      useState(0);
      createContext(null);
    `,
  },
  {
    name: "ignores members on unrelated objects",
    code: `stateLibrary.useState(0); stateLibrary["useMemo"](work);`,
  },
  {
    name: "ignores non-generic React hooks",
    code: `
      import React, { useEffect, useId, useTransition } from "react";
      useEffect(effect, []);
      useId();
      useTransition();
      React.useLayoutEffect(effect, []);
    `,
  },
  {
    name: "does not mistake a type-only import for a runtime React binding",
    code: `import type { useState } from "react"; declare const useState: Function; useState(0);`,
  },
  {
    name: "respects a shadowed named React import",
    code: `
      import { useState } from "react";
      function run(useState: (value: number) => number) { return useState(0); }
    `,
  },
  {
    name: "respects a shadowed React namespace",
    code: `
      import React from "react";
      function run(React: { useState(value: number): number }) {
        return React.useState(0);
      }
    `,
  },
  {
    name: "ignores dynamic computed properties",
    code: `import React from "react"; React[hookName](value);`,
  },
  {
    name: "does not treat a shadowed require as the CommonJS loader",
    code: `
      function run(require: (name: string) => any) {
        const React = require("react");
        React.useState(0);
      }
    `,
  },
];

for (const fixture of validCases) {
  test(fixture.name, () => {
    assert.deepEqual(messages(fixture.code), []);
  });
}

const invalidCases = [
  {
    name: "recognizes an aliased named import",
    code: `import { useState as useReactState } from "react"; useReactState(0);`,
    api: "useState",
  },
  {
    name: "recognizes a default React import",
    code: `import React from "react"; React.useRef(null);`,
    api: "useRef",
  },
  {
    name: "recognizes a namespace React import",
    code: `import * as R from "react"; R.useMemo(work, []);`,
    api: "useMemo",
  },
  {
    name: "recognizes quoted static React members",
    code: `import React from "react"; React["useCallback"](work, []);`,
    api: "useCallback",
  },
  {
    name: "recognizes a TypeScript import-equals namespace",
    code: `import React = require("react"); React.useContext(Context);`,
    api: "useContext",
  },
  {
    name: "recognizes a CommonJS namespace",
    code: `const React = require("react"); React.useState(0);`,
    api: "useState",
  },
  {
    name: "recognizes a CommonJS default namespace",
    code: `const React = require("react").default; React.useRef(null);`,
    api: "useRef",
  },
  {
    name: "recognizes a destructured CommonJS import",
    code: `const { useReducer } = require("react"); useReducer(reducer, initial);`,
    api: "useReducer",
  },
  {
    name: "recognizes a renamed destructured CommonJS import",
    code: `const { useMemo: memoize } = require("react"); memoize(work, []);`,
    api: "useMemo",
  },
  {
    name: "recognizes direct CommonJS member calls",
    code: `require("react").useState(0);`,
    api: "useState",
  },
  {
    name: "recognizes a destructured namespace alias",
    code: `
      import React from "react";
      const { useOptimistic: optimistic } = React;
      optimistic(value);
    `,
    api: "useOptimistic",
  },
  {
    name: "recognizes a static member alias",
    code: `
      import React from "react";
      const stateHook = React.useState;
      stateHook(0);
    `,
    api: "useState",
  },
  {
    name: "recognizes transitive namespace and API aliases",
    code: `
      import React from "react";
      const R = React;
      const stateHook = R.useState;
      const aliasedStateHook = stateHook;
      aliasedStateHook(0);
    `,
    api: "useState",
  },
  {
    name: "recognizes aliases declared inside a function scope",
    code: `
      import React from "react";
      function run() {
        const { useDeferredValue: defer } = React;
        return defer(value);
      }
    `,
    api: "useDeferredValue",
  },
];

for (const fixture of invalidCases) {
  test(fixture.name, () => {
    const result = messages(fixture.code);
    assert.equal(result.length, 1);
    assert.equal(result[0].messageId, "missing");
    assert.equal(
      result[0].message,
      `Add an explicit type argument to React.${fixture.api}.`,
    );
  });
}

test("reports every missing generic in source order", () => {
  const result = messages(`
    import React, { useMemo, useState } from "react";
    useState(0);
    React.useRef(null);
    useMemo(work, []);
  `);
  assert.deepEqual(
    result.map((message) => message.message),
    [
      "Add an explicit type argument to React.useState.",
      "Add an explicit type argument to React.useRef.",
      "Add an explicit type argument to React.useMemo.",
    ],
  );
});

test("does not exempt tests, stories, or generated files", () => {
  for (const filename of [
    "state.test.tsx",
    "state.spec.tsx",
    "State.story.tsx",
    "State.stories.tsx",
    "src/__tests__/state.tsx",
    "src/generated/state.tsx",
  ]) {
    const result = messages(
      `import { useState } from "react"; useState(0);`,
      filename,
    );
    assert.equal(result.length, 1, filename);
    assert.equal(result[0].messageId, "missing", filename);
  }
});
