import assert from "node:assert/strict";
import test from "node:test";
import { generalRules } from "../../../src/index.js";
import { lintRule } from "../../lint-rule.js";

const ruleName = "explicit-react-hook-generics";

function messages(code) {
  return lintRule({
    ruleName,
    rule: generalRules[ruleName],
    code,
    filename: "ImportResolution.tsx",
  });
}

function assertMissingApis(code, expectedApis) {
  const result = messages(code);
  assert.deepEqual(
    result.map((message) => ({
      messageId: message.messageId,
      message: message.message,
    })),
    expectedApis.map((api) => ({
      messageId: "missing",
      message: `Add an explicit type argument to React.${api}.`,
    })),
  );
}

const detectedBindings = [
  {
    name: "tracks a named import beside a type-only specifier",
    code: `
      import { type Dispatch, useState as state } from "react";
      state(0);
    `,
    apis: ["useState"],
  },
  {
    name: "tracks aliases of a default import",
    code: `
      import React from "react";
      const Framework = React;
      Framework.useMemo(work, []);
    `,
    apis: ["useMemo"],
  },
  {
    name: "tracks aliases of a namespace import inside a block",
    code: `
      import * as ReactNS from "react";
      {
        const Framework = ReactNS;
        Framework.useCallback(work, []);
      }
    `,
    apis: ["useCallback"],
  },
  {
    name: "tracks a computed destructuring key from a React namespace",
    code: `
      import * as ReactNS from "react";
      const { ["useDeferredValue"]: defer } = ReactNS;
      defer(value);
    `,
    apis: ["useDeferredValue"],
  },
  {
    name: "tracks a destructured binding with a default initializer",
    code: `
      import React from "react";
      const { useOptimistic: optimistic = fallback } = React;
      optimistic(value);
    `,
    apis: ["useOptimistic"],
  },
  {
    name: "unwraps TypeScript assertions around a namespace alias",
    code: `
      import React from "react";
      const Framework = React as typeof React;
      Framework.useRef(null);
    `,
    apis: ["useRef"],
  },
  {
    name: "unwraps satisfies around a namespace alias",
    code: `
      import React from "react";
      const Framework = React satisfies typeof React;
      Framework.useContext(Context);
    `,
    apis: ["useContext"],
  },
  {
    name: "unwraps a non-null assertion around a namespace alias",
    code: `
      import React from "react";
      const Framework = React!;
      Framework.useSyncExternalStore(subscribe, snapshot);
    `,
    apis: ["useSyncExternalStore"],
  },
  {
    name: "unwraps TypeScript assertions around a hook alias",
    code: `
      import { useState } from "react";
      const state = useState as typeof useState;
      state(0);
    `,
    apis: ["useState"],
  },
  {
    name: "tracks a TypeScript import-equals namespace through an alias",
    code: `
      import React = require("react");
      const Framework: typeof React = React;
      Framework.useActionState(action, initial);
    `,
    apis: ["useActionState"],
  },
  {
    name: "tracks a typed CommonJS namespace",
    code: `
      const React = require("react") as typeof import("react");
      React.useImperativeHandle(ref, createHandle);
    `,
    apis: ["useImperativeHandle"],
  },
  {
    name: "tracks CommonJS destructuring with a default initializer",
    code: `
      const { useReducer: reduce = fallback } = require("react");
      reduce(reducer, initial);
    `,
    apis: ["useReducer"],
  },
  {
    name: "tracks a quoted direct CommonJS member call",
    code: `require("react")["createContext"](null);`,
    apis: ["createContext"],
  },
  {
    name: "tracks a direct member call on the CommonJS default export",
    code: `require("react").default.useState(0);`,
    apis: ["useState"],
  },
  {
    name: "tracks destructuring from the CommonJS default export",
    code: `
      const { useState: state } = require("react").default;
      state(0);
    `,
    apis: ["useState"],
  },
  {
    name: "tracks a destructured CommonJS default namespace",
    code: `
      const { default: React } = require("react");
      React.useRef(null);
    `,
    apis: ["useRef"],
  },
  {
    name: "tracks the default export reached from an ESM namespace",
    code: `
      import * as ReactNS from "react";
      const React = ReactNS.default;
      React.useMemo(work, []);
    `,
    apis: ["useMemo"],
  },
  {
    name: "tracks the default export destructured from an ESM namespace",
    code: `
      import * as ReactNS from "react";
      const { default: React } = ReactNS;
      React.useMemo(work, []);
    `,
    apis: ["useMemo"],
  },
  {
    name: "tracks a defaulted CommonJS default namespace binding",
    code: `
      const { default: React = fallback } = require("react");
      React.useRef(null);
    `,
    apis: ["useRef"],
  },
  {
    name: "tracks a CommonJS namespace declared in a nested function",
    code: `
      function render() {
        const React = require("react");
        return React.use(value);
      }
    `,
    apis: ["use"],
  },
  {
    name: "tracks an ordered nested alias chain",
    code: `
      import React from "react";
      function render() {
        const Framework = React;
        const state = Framework.useState;
        const finalState = state;
        return finalState(0);
      }
    `,
    apis: ["useState"],
  },
  {
    name: "keeps identically named bindings in sibling scopes distinct",
    code: `
      import React from "react";
      function first() {
        const state = React.useState;
        state(0);
      }
      function second() {
        const state = React.useState;
        state(1);
      }
    `,
    apis: ["useState", "useState"],
  },
  {
    name: "tracks optional calls through named and namespace bindings",
    code: `
      import React, { useEffectEvent } from "react";
      useEffectEvent?.(handler);
      React?.["useDebugValue"](value);
    `,
    apis: ["useEffectEvent", "useDebugValue"],
  },
];

for (const fixture of detectedBindings) {
  test(fixture.name, () => {
    assertMissingApis(fixture.code, fixture.apis);
  });
}

const ignoredBindings = [
  {
    name: "ignores React API names imported from lookalike packages",
    code: `
      import { useState as fromCompat } from "preact/compat";
      import { useMemo as fromRuntime } from "react/jsx-runtime";
      import { useRef as fromTypes } from "@types/react";
      fromCompat(0);
      fromRuntime(work, []);
      fromTypes(null);
    `,
  },
  {
    name: "ignores a type-only default import",
    code: `
      import type React from "react";
      declare const React: { useState(value: number): number };
      React.useState(0);
    `,
  },
  {
    name: "ignores a type-only namespace import",
    code: `
      import type * as ReactTypes from "react";
      declare const ReactTypes: { useMemo(value: unknown): unknown };
      ReactTypes.useMemo(value);
    `,
  },
  {
    name: "ignores a type-only named specifier",
    code: `
      import { type useState as StateType } from "react";
      declare const StateType: (value: number) => number;
      StateType(0);
    `,
  },
  {
    name: "ignores a type-only TypeScript import-equals declaration",
    code: `
      import type React = require("react");
      declare const React: { useState(value: number): number };
      React.useState(0);
    `,
  },
  {
    name: "ignores a named import shadowed by a destructured parameter",
    code: `
      import { useState } from "react";
      function render({ useState }: { useState(value: number): number }) {
        return useState(0);
      }
    `,
  },
  {
    name: "ignores a namespace import shadowed in a nested block",
    code: `
      import React from "react";
      {
        const React = stateLibrary;
        React.useState(0);
      }
    `,
  },
  {
    name: "ignores an imported hook shadowed by a catch parameter",
    code: `
      import { useMemo } from "react";
      try { work(); } catch (useMemo) { useMemo(work, []); }
    `,
  },
  {
    name: "ignores a React alias shadowed by a function parameter",
    code: `
      import React from "react";
      const Framework = React;
      function render(Framework: typeof stateLibrary) {
        return Framework.useState(0);
      }
    `,
  },
  {
    name: "ignores a hook alias shadowed by a local declaration",
    code: `
      import { useState } from "react";
      const state = useState;
      function render() {
        const state = stateLibrary.useState;
        return state(0);
      }
    `,
  },
  {
    name: "ignores require shadowed by a top-level declaration",
    code: `
      declare function require(name: string): typeof stateLibrary;
      const React = require("react");
      React.useState(0);
    `,
  },
  {
    name: "ignores require shadowed in an enclosing function",
    code: `
      function load(require: (name: string) => typeof stateLibrary) {
        function render() {
          const React = require("react");
          return React.useState(0);
        }
        return render();
      }
    `,
  },
  {
    name: "ignores dynamic and non-exact CommonJS sources",
    code: `
      require(packageName).useState(0);
      require(\`react\`).useMemo(work, []);
      require("react", options).useRef(null);
      require("React").useReducer(reducer, initial);
    `,
  },
  {
    name: "ignores fake local React namespaces and their aliases",
    code: `
      const React = stateLibrary;
      const Framework = React;
      const state = Framework.useState;
      state(0);
    `,
  },
  {
    name: "ignores custom members reached through a React namespace",
    code: `
      import React from "react";
      React.useLayoutEffect(effect, []);
      React.startTransition(work);
      React.cache(work);
    `,
  },
  {
    name: "ignores an API alias after it is reassigned to a local function",
    code: `
      import React from "react";
      let state = React.useState;
      state = stateLibrary.useState;
      state(0);
    `,
  },
  {
    name: "ignores a namespace alias after it is reassigned",
    code: `
      import React from "react";
      let Framework = React;
      Framework = stateLibrary;
      Framework.useState(0);
    `,
  },
  {
    name: "ignores hook methods invoked indirectly through call and bind",
    code: `
      import { useState } from "react";
      useState.call(null, 0);
      useState.bind(null)(0);
    `,
  },
];

for (const fixture of ignoredBindings) {
  test(fixture.name, () => {
    assert.deepEqual(messages(fixture.code), []);
  });
}

test("accepts explicit generics through ESM, CommonJS, and TypeScript aliases", () => {
  assert.deepEqual(
    messages(`
      import React, { useState as state } from "react";
      import ReactEquals = require("react");
      const CommonJS = require("react") as typeof import("react");
      const memo = React.useMemo;

      state<number>(0);
      memo<unknown>(() => value, []);
      ReactEquals.useRef<HTMLDivElement>(null);
      CommonJS.useContext<ContextValue>(Context);
    `),
    [],
  );
});

test("a shadowed call does not hide a later call through the imported binding", () => {
  assertMissingApis(
    `
      import { useState } from "react";
      function local(useState: (value: number) => number) {
        useState(0);
      }
      useState(1);
    `,
    ["useState"],
  );
});

test("a shadowed namespace call does not hide a later imported namespace call", () => {
  assertMissingApis(
    `
      import React from "react";
      function local(React: typeof stateLibrary) {
        React.useMemo(work, []);
      }
      React.useMemo(work, []);
    `,
    ["useMemo"],
  );
});

test("an API alias retains its React identity after the source alias is reassigned", () => {
  assertMissingApis(
    `
      import { useState } from "react";
      let state = useState;
      const capturedState = state;
      state = stateLibrary.useState;
      capturedState(0);
    `,
    ["useState"],
  );
});

test("a destructured API retains its React identity after the namespace alias is reassigned", () => {
  assertMissingApis(
    `
      import React from "react";
      let Framework = React;
      const { useRef: capturedRef } = Framework;
      Framework = stateLibrary;
      capturedRef(null);
    `,
    ["useRef"],
  );
});
