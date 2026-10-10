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

function assertMissing(code, api, filename) {
  const result = messages(code, filename);
  assert.equal(result.length, 1);
  assert.deepEqual(
    {
      messageId: result[0].messageId,
      message: result[0].message,
    },
    {
      messageId: "missing",
      message: `Add an explicit type argument to React.${api}.`,
    },
  );
}

const bindingForms = [
  {
    name: "an optional default-import member call",
    api: "useState",
    missing: `import React from "react"; React?.useState(0);`,
    explicit: `import React from "react"; React?.useState<number>(0);`,
  },
  {
    name: "a named import wrapped in a TypeScript assertion",
    api: "useMemo",
    missing: `import { useMemo } from "react"; (useMemo as typeof useMemo)(work, []);`,
    explicit: `import { useMemo } from "react"; (useMemo as typeof useMemo)<Result>(work, []);`,
  },
  {
    name: "a namespace import wrapped in satisfies",
    api: "useRef",
    missing: `import * as React from "react"; (React satisfies typeof React).useRef(null);`,
    explicit: `import * as React from "react"; (React satisfies typeof React).useRef<Element>(null);`,
  },
  {
    name: "a quoted named import",
    api: "useEffectEvent",
    missing: `import { "useEffectEvent" as effectEvent } from "react"; effectEvent(callback);`,
    explicit: `import { "useEffectEvent" as effectEvent } from "react"; effectEvent<(event: Event) => void>(callback);`,
  },
  {
    name: "a computed direct CommonJS member",
    api: "useActionState",
    missing: `require("react")["useActionState"](action, initialState);`,
    explicit: `require("react")["useActionState"]<State, Payload>(action, initialState);`,
  },
  {
    name: "a computed TypeScript import-equals member",
    api: "useImperativeHandle",
    missing: `import React = require("react"); React["useImperativeHandle"](ref, createHandle);`,
    explicit: `import React = require("react"); React["useImperativeHandle"]<Handle, Props>(ref, createHandle);`,
  },
  {
    name: "a defaulted destructuring alias from a React namespace",
    api: "useDeferredValue",
    missing: `import React from "react"; const { useDeferredValue: defer = fallback } = React; defer(value);`,
    explicit: `import React from "react"; const { useDeferredValue: defer = fallback } = React; defer<Value>(value);`,
  },
  {
    name: "a destructured CommonJS default namespace",
    api: "useReducer",
    missing: `const { default: React } = require("react"); React.useReducer(reducer, initialState);`,
    explicit: `const { default: React } = require("react"); React.useReducer<State, Action>(reducer, initialState);`,
  },
  {
    name: "a hook destructured from the CommonJS default export",
    api: "useOptimistic",
    missing: `const { useOptimistic } = require("react").default; useOptimistic(initialState, reducer);`,
    explicit: `const { useOptimistic } = require("react").default; useOptimistic<State, Action>(initialState, reducer);`,
  },
  {
    name: "a direct CommonJS default-export member",
    api: "useContext",
    missing: `require("react").default.useContext(ThemeContext);`,
    explicit: `require("react").default.useContext<Theme>(ThemeContext);`,
  },
  {
    name: "a computed default-export member from an ESM namespace",
    api: "useCallback",
    missing: `import * as ReactNS from "react"; ReactNS["default"][\`useCallback\`](work, []);`,
    explicit: `import * as ReactNS from "react"; ReactNS["default"][\`useCallback\`]<Callback>(work, []);`,
  },
  {
    name: "a zero-expression template member on a default import",
    api: "useSyncExternalStore",
    missing: `import React from "react"; React[\`useSyncExternalStore\`](subscribe, getSnapshot);`,
    explicit: `import React from "react"; React[\`useSyncExternalStore\`]<Snapshot>(subscribe, getSnapshot);`,
  },
];

for (const fixture of bindingForms) {
  test(`requires a type argument for ${fixture.name}`, () => {
    assertMissing(fixture.missing, fixture.api);
  });

  test(`accepts a type argument for ${fixture.name}`, () => {
    assert.deepEqual(messages(fixture.explicit), []);
  });
}

test("accepts realistic multi-parameter generic signatures", () => {
  assert.deepEqual(
    messages(`
      import {
        useActionState,
        useImperativeHandle,
        useOptimistic,
        useReducer,
      } from "react";
      useActionState<FormState, FormData>(action, initialState);
      useImperativeHandle<Handle, PublicHandle>(ref, createHandle);
      useOptimistic<TodoState, TodoAction>(initialState, reducer);
      useReducer<ReducerState, ReducerAction>(reducer, initialState);
    `),
    [],
  );
});

test("accepts a TypeScript instantiation expression before alias invocation", () => {
  assert.deepEqual(
    messages(`
      import { useState } from "react";
      const numberState = useState<number>;
      numberState(0);
    `),
    [],
  );
});

test("reports exact API identities and coordinates through wrappers and aliases", () => {
  const result = messages(`
import React, {
  useActionState as useFormActionState,
  useEffectEvent,
} from "react";
useFormActionState(action, initialState);
(React satisfies typeof React).useOptimistic(value, reducer);
(useEffectEvent as typeof useEffectEvent)(callback);
  `);

  assert.deepEqual(
    result.map(({ messageId, message, line, column }) => ({
      messageId,
      message,
      line,
      column,
    })),
    [
      {
        messageId: "missing",
        message: "Add an explicit type argument to React.useActionState.",
        line: 6,
        column: 1,
      },
      {
        messageId: "missing",
        message: "Add an explicit type argument to React.useOptimistic.",
        line: 7,
        column: 1,
      },
      {
        messageId: "missing",
        message: "Add an explicit type argument to React.useEffectEvent.",
        line: 8,
        column: 1,
      },
    ],
  );
});

test("does not exempt remaining test, story, or generated filename forms", () => {
  for (const filename of [
    "src/__stories__/State.tsx",
    "src/__generated__/state.tsx",
    "src/state.generated.tsx",
    "src/state.gen.ts",
    "src/state.test.ts",
    "src/state.spec.ts",
    "src/State.story.ts",
    "src/State.stories.ts",
  ]) {
    assertMissing(
      `import { useSyncExternalStore } from "react"; useSyncExternalStore(subscribe, getSnapshot);`,
      "useSyncExternalStore",
      filename,
    );
  }
});
