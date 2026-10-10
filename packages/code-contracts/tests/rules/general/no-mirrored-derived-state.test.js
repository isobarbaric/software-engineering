import assert from "node:assert/strict";
import test from "node:test";
import { generalRules } from "../../../src/index.js";
import { lintRule } from "../../lint-rule.js";

const ruleName = "no-mirrored-derived-state";

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
    name: "allows synchronization with an external browser source",
    code: `
      import { useEffect, useState } from "react";
      const [width, setWidth] = useState(0);
      useEffect(() => setWidth(window.innerWidth), []);
    `,
  },
  {
    name: "allows synchronization with unqualified browser measurements",
    code: `
      import { useEffect, useState } from "react";
      const [viewport, setViewport] = useState(0);
      useEffect(() => setViewport(innerWidth + screen.width), [innerWidth, screen.width]);
    `,
  },
  {
    name: "allows a transformation through an arbitrary function call",
    code: `
      import { useEffect, useState } from "react";
      const [label, setLabel] = useState("");
      useEffect(() => setLabel(format(value)), [value]);
    `,
  },
  {
    name: "allows construction because it is not structurally pure",
    code: `
      import { useEffect, useState } from "react";
      const [model, setModel] = useState<Model>();
      useEffect(() => setModel(new Model(value)), [value]);
    `,
  },
  {
    name: "allows state updates inside subscription callbacks",
    code: `
      import { useEffect, useState } from "react";
      const [value, setValue] = useState("");
      useEffect(() => subscribe((next) => setValue(next)), []);
    `,
  },
  {
    name: "allows functional state updaters",
    code: `
      import { useEffect, useState } from "react";
      const [count, setCount] = useState(0);
      useEffect(() => setCount((current) => current + delta), [delta]);
    `,
  },
  {
    name: "allows constant resets with no reactive input",
    code: `
      import { useEffect, useState } from "react";
      const [selected, setSelected] = useState<string | null>(null);
      useEffect(() => setSelected(null), [projectId]);
    `,
  },
  {
    name: "allows expressions not fully represented by the dependencies",
    code: `
      import { useEffect, useState } from "react";
      const [name, setName] = useState("");
      useEffect(() => setName(first + last), [first]);
    `,
  },
  {
    name: "allows expressions derived from a different dependency",
    code: `
      import { useEffect, useState } from "react";
      const [label, setLabel] = useState("");
      useEffect(() => setLabel(project.name), [selectedProject]);
    `,
  },
  {
    name: "allows effects without a dependency array",
    code: `
      import { useEffect, useState } from "react";
      const [label, setLabel] = useState("");
      useEffect(() => setLabel(project.name));
    `,
  },
  {
    name: "ignores unrelated functions with React hook names",
    code: `
      function useState(value: string) { return [value, (next: string) => next] as const; }
      function useEffect(callback: () => void, dependencies: unknown[]) { callback(); }
      const [label, setLabel] = useState("");
      useEffect(() => setLabel(project.name), [project]);
    `,
  },
  {
    name: "ignores hook names imported from a lookalike package",
    code: `
      import { useEffect, useState } from "preact/hooks";
      const [label, setLabel] = useState("");
      useEffect(() => setLabel(project.name), [project]);
    `,
  },
  {
    name: "respects local shadows of imported React hooks",
    code: `
      import { useEffect, useState } from "react";
      function Example(useEffect: Function, useState: Function) {
        const [label, setLabel] = useState("");
        useEffect(() => setLabel(project.name), [project]);
      }
    `,
  },
  {
    name: "respects local shadows of imported React namespaces",
    code: `
      import * as React from "react";
      function Example(React: typeof import("react")) {
        const [label, setLabel] = React.useState("");
        React.useEffect(() => setLabel(project.name), [project]);
      }
    `,
  },
  {
    name: "ignores CommonJS React detection when require is shadowed",
    code: `
      function Example(require: (name: string) => any) {
        const { useEffect, useState } = require("react");
        const [label, setLabel] = useState("");
        useEffect(() => setLabel(project.name), [project]);
      }
    `,
  },
  {
    name: "does not infer dynamic dependency expressions",
    code: `
      import { useEffect, useState } from "react";
      const [label, setLabel] = useState("");
      useEffect(() => setLabel(project.name), [projects[index]]);
    `,
  },
  {
    name: "does not infer dynamic property reads",
    code: `
      import { useEffect, useState } from "react";
      const [label, setLabel] = useState("");
      useEffect(() => setLabel(project[field]), [project, field]);
    `,
  },
  {
    name: "ignores imported effect callbacks whose behavior is unavailable",
    code: `
      import { useEffect } from "react";
      import { synchronize } from "./synchronize";
      useEffect(synchronize, [project]);
    `,
  },
  {
    name: "ignores state setter calls outside effects",
    code: `
      import { useState } from "react";
      const [label, setLabel] = useState("");
      setLabel(project.name);
    `,
  },
  {
    name: "ignores a React hook alias reassigned before use",
    code: `
      import { useEffect, useState } from "react";
      let effect = useEffect;
      effect = customEffect;
      const [label, setLabel] = useState("");
      effect(() => setLabel(project.name), [project]);
    `,
  },
  {
    name: "ignores a React namespace alias reassigned before use",
    code: `
      import * as React from "react";
      let Hooks = React;
      Hooks = customHooks;
      const [label, setLabel] = Hooks.useState("");
      Hooks.useEffect(() => setLabel(project.name), [project]);
    `,
  },
  {
    name: "ignores a state setter alias reassigned before the effect",
    code: `
      import { useEffect, useState } from "react";
      const [label, setLabel] = useState("");
      let update = setLabel;
      update = logLabel;
      useEffect(() => update(project.name), [project]);
    `,
  },
  {
    name: "allows async-derived values",
    code: `
      import { useEffect, useState } from "react";
      const [label, setLabel] = useState("");
      useEffect(async () => setLabel(await loadLabel(project)), [project]);
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
    name: "rejects a direct dependency copy through named React imports",
    code: `
      import { useEffect, useState } from "react";
      const [selection, setSelection] = useState("");
      useEffect(() => setSelection(projectId), [projectId]);
    `,
    messageIds: ["derived"],
  },
  {
    name: "tracks component parameter bindings in production-shaped code",
    code: `
      import { useEffect, useState } from "react";
      interface Project { name: string }
      interface ExampleProps { project: Project }
      function Example({ project }: ExampleProps) {
        const [label, setLabel] = useState("");
        useEffect(() => setLabel(project.name), [project]);
        return label;
      }
    `,
    messageIds: ["derived"],
  },
  {
    name: "recognizes aliased named React imports",
    code: `
      import { useEffect as effect, useState as state } from "react";
      const [label, setLabel] = state("");
      effect(() => setLabel(project.name), [project]);
    `,
    messageIds: ["derived"],
  },
  {
    name: "recognizes React namespace imports",
    code: `
      import * as React from "react";
      const [label, setLabel] = React.useState("");
      React.useEffect(() => setLabel(project.name), [project]);
    `,
    messageIds: ["derived"],
  },
  {
    name: "recognizes React default imports",
    code: `
      import React from "react";
      const [label, setLabel] = React.useState("");
      React.useEffect(() => setLabel(project.name), [project]);
    `,
    messageIds: ["derived"],
  },
  {
    name: "recognizes TypeScript import-equals React namespaces",
    code: `
      import React = require("react");
      const [label, setLabel] = React.useState("");
      React.useEffect(() => setLabel(project.name), [project]);
    `,
    messageIds: ["derived"],
  },
  {
    name: "recognizes CommonJS React destructuring",
    code: `
      const { useEffect, useState } = require("react");
      const [label, setLabel] = useState("");
      useEffect(() => setLabel(project.name), [project]);
    `,
    messageIds: ["derived"],
  },
  {
    name: "recognizes CommonJS default interop and static computed hook members",
    code: `
      const React = require("react").default;
      const [label, setLabel] = React["useState"]("");
      React[\`useEffect\`](() => setLabel(project.name), [project]);
    `,
    messageIds: ["derived"],
  },
  {
    name: "recognizes static aliases of React hook members",
    code: `
      import React from "react";
      const state = React.useState;
      const effect = React.useEffect;
      const [label, setLabel] = state("");
      effect(() => setLabel(project.name), [project]);
    `,
    messageIds: ["derived"],
  },
  {
    name: "enforces the contract for useLayoutEffect",
    code: `
      import { useLayoutEffect, useState } from "react";
      const [width, setWidth] = useState(0);
      useLayoutEffect(() => setWidth(container.width), [container]);
    `,
    messageIds: ["derived"],
  },
  {
    name: "rejects template-derived state",
    code: `
      import { useEffect, useState } from "react";
      const [name, setName] = useState("");
      useEffect(() => setName(\`${"${first}"} ${"${last}"}\`), [first, last]);
    `,
    messageIds: ["derived"],
  },
  {
    name: "rejects object and array projections",
    code: `
      import { useEffect, useState } from "react";
      const [summary, setSummary] = useState({});
      const [items, setItems] = useState([]);
      useEffect(() => {
        setSummary({ id: project.id, active: enabled });
        setItems([project.id, ...relatedIds]);
      }, [project, enabled, relatedIds]);
    `,
    messageIds: ["derived", "derived"],
  },
  {
    name: "rejects arithmetic projections",
    code: `
      import { useEffect, useState } from "react";
      const [total, setTotal] = useState(0);
      useEffect(() => setTotal(price * quantity + tax), [price, quantity, tax]);
    `,
    messageIds: ["derived"],
  },
  {
    name: "rejects logical and nullish fallback projections",
    code: `
      import { useEffect, useState } from "react";
      const [first, setFirst] = useState("");
      const [second, setSecond] = useState("");
      useEffect(() => {
        setFirst(primary || fallback);
        setSecond(optional ?? fallback);
      }, [primary, optional, fallback]);
    `,
    messageIds: ["derived", "derived"],
  },
  {
    name: "rejects conditional projections",
    code: `
      import { useEffect, useState } from "react";
      const [label, setLabel] = useState("");
      useEffect(() => setLabel(enabled ? activeLabel : idleLabel), [enabled, activeLabel, idleLabel]);
    `,
    messageIds: ["derived"],
  },
  {
    name: "rejects unary and sequence projections",
    code: `
      import { useEffect, useState } from "react";
      const [active, setActive] = useState(false);
      const [selection, setSelection] = useState("");
      useEffect(() => {
        setActive(!project.disabled);
        setSelection((project.id, fallbackId));
      }, [project, fallbackId]);
    `,
    messageIds: ["derived", "derived"],
  },
  {
    name: "rejects a mirror covered by an exact member dependency",
    code: `
      import { useEffect, useState } from "react";
      const [label, setLabel] = useState("");
      useEffect(() => setLabel(project.name), [project.name]);
    `,
    messageIds: ["derived"],
  },
  {
    name: "ignores stable module dependencies while checking reactive ones",
    code: `
      import { useEffect, useState } from "react";
      import { FALLBACK_LABEL } from "./labels";
      const [label, setLabel] = useState("");
      useEffect(() => setLabel(project.name ?? FALLBACK_LABEL), [project, FALLBACK_LABEL]);
    `,
    messageIds: ["derived"],
  },
  {
    name: "treats a root dependency as covering a static member read",
    code: `
      import { useEffect, useState } from "react";
      const [label, setLabel] = useState("");
      useEffect(() => setLabel(project.owner.name), [project]);
    `,
    messageIds: ["derived"],
  },
  {
    name: "allows extra dependencies while rejecting the mirrored value",
    code: `
      import { useEffect, useState } from "react";
      const [label, setLabel] = useState("");
      useEffect(() => setLabel(project.name), [project, locale]);
    `,
    messageIds: ["derived"],
  },
  {
    name: "expands pure const aliases declared inside the effect",
    code: `
      import { useEffect, useState } from "react";
      const [name, setName] = useState("");
      useEffect(() => {
        const fullName = first + " " + last;
        setName(fullName);
      }, [first, last]);
    `,
    messageIds: ["derived"],
  },
  {
    name: "recognizes an unchanged local alias of a state setter",
    code: `
      import { useEffect, useState } from "react";
      const [label, setLabel] = useState("");
      const updateLabel = setLabel;
      useEffect(() => updateLabel(project.name), [project]);
    `,
    messageIds: ["derived"],
  },
  {
    name: "recognizes transitive aliases of a state setter",
    code: `
      import { useEffect, useState } from "react";
      const [label, setLabel] = useState("");
      const updateLabel = setLabel;
      const synchronizeLabel = updateLabel;
      useEffect(() => synchronizeLabel(project.name), [project]);
    `,
    messageIds: ["derived"],
  },
  {
    name: "resolves a named function effect callback",
    code: `
      import { useEffect, useState } from "react";
      const [label, setLabel] = useState("");
      function synchronizeLabel() { setLabel(project.name); }
      useEffect(synchronizeLabel, [project]);
    `,
    messageIds: ["derived"],
  },
  {
    name: "resolves a named const effect callback through an alias",
    code: `
      import { useEffect, useState } from "react";
      const [label, setLabel] = useState("");
      const synchronizeLabel = () => setLabel(project.name);
      const callback = synchronizeLabel;
      useEffect(callback, [project]);
    `,
    messageIds: ["derived"],
  },
  {
    name: "handles TypeScript wrappers around a derived expression",
    code: `
      import { useEffect, useState } from "react";
      const [label, setLabel] = useState("");
      useEffect(() => setLabel(project.name! as string), [project]);
    `,
    messageIds: ["derived"],
  },
  {
    name: "reports multiple mirrored setters in source order",
    code: `
      import { useEffect, useState } from "react";
      const [name, setName] = useState("");
      const [count, setCount] = useState(0);
      useEffect(() => {
        setName(project.name);
        setCount(items.length);
      }, [project, items]);
    `,
    messageIds: ["derived", "derived"],
  },
  {
    name: "enforces the rule in test files",
    code: `
      import { useEffect, useState } from "react";
      const [label, setLabel] = useState("");
      useEffect(() => setLabel(project.name), [project]);
    `,
    filename: "Example.test.tsx",
    messageIds: ["derived"],
  },
  {
    name: "enforces the rule in story files",
    code: `
      import { useEffect, useState } from "react";
      const [label, setLabel] = useState("");
      useEffect(() => setLabel(project.name), [project]);
    `,
    filename: "Example.stories.tsx",
    messageIds: ["derived"],
  },
  {
    name: "enforces the rule in generated files",
    code: `
      import { useEffect, useState } from "react";
      const [label, setLabel] = useState("");
      useEffect(() => setLabel(project.name), [project]);
    `,
    filename: "Example.generated.tsx",
    messageIds: ["derived"],
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

test("reports the exact mirrored-state diagnostic, data interpolation, order, and locations", () => {
  const result = messages(`import { useEffect, useState } from "react";
const [name, setName] = useState("");
const [count, setCount] = useState(0);
useEffect(() => {
  setName(project.name);
  setCount(items.length);
}, [project, items]);`);

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
        messageId: "derived",
        message:
          "name is derived from this effect's dependencies. Compute it during render instead of synchronizing duplicate state.",
        line: 5,
        column: 3,
        endLine: 5,
        endColumn: 24,
      },
      {
        messageId: "derived",
        message:
          "count is derived from this effect's dependencies. Compute it during render instead of synchronizing duplicate state.",
        line: 6,
        column: 3,
        endLine: 6,
        endColumn: 25,
      },
    ],
  );
});
