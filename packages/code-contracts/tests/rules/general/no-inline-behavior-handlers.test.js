import assert from "node:assert/strict";
import test from "node:test";
import { generalRules } from "../../../src/index.js";
import { lintRule } from "../../lint-rule.js";

const ruleName = "no-inline-behavior-handlers";

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
    name: "accepts a named function reference",
    code: `const view = <button onClick={handleClick}>Save</button>;`,
  },
  {
    name: "accepts a member function reference",
    code: `const view = <button onClick={handlers.handleClick}>Save</button>;`,
  },
  {
    name: "accepts computed and this-bound function references",
    code: `
      const first = <button onClick={handlers[action]}>Run</button>;
      const second = <button onClick={this.handleClick}>Run</button>;
    `,
  },
  {
    name: "accepts a TypeScript-wrapped function reference",
    code: `const view = <button onClick={handleClick!}>Save</button>;`,
  },
  {
    name: "accepts asserted and satisfies-wrapped function references",
    code: `
      const first = <button onClick={handleClick as () => void}>Save</button>;
      const second = <button onClick={handleClick satisfies () => void}>Save</button>;
    `,
  },
  {
    name: "accepts a concise zero-parameter setter",
    code: `const view = <button onClick={() => setOpen(true)}>Open</button>;`,
  },
  {
    name: "accepts one setter expression in a block",
    code: `const view = <button onClick={() => { setOpen(true); }}>Open</button>;`,
  },
  {
    name: "accepts captured data passed directly to a setter",
    code: `const view = <button onClick={() => setSelectedId(project.id)}>Select</button>;`,
  },
  {
    name: "accepts object and array state values without behavior",
    code: `
      const first = <button onClick={() => setState({ open: true, id })}>Set</button>;
      const second = <button onClick={() => setItems([...items, item])}>Add</button>;
    `,
  },
  {
    name: "accepts pure conditional, binary, template, and member setter data",
    code: `
      const first = <button onClick={() => setOpen(ready ? true : false)}>Set</button>;
      const second = <button onClick={() => setCount(count + 1)}>Set</button>;
      const third = <button onClick={() => setLabel(\`item-\${id}\`)}>Set</button>;
      const fourth = <button onClick={() => setValue(source.current.value)}>Set</button>;
    `,
  },
  {
    name: "accepts a TypeScript-wrapped direct setter arrow",
    code: `const view = <button onClick={(() => setOpen(true)) as () => void}>Open</button>;`,
  },
  {
    name: "accepts the contract on custom component callbacks",
    code: `const view = <Dialog onDismiss={() => setOpen(false)} />;`,
  },
  {
    name: "accepts allowed handlers in statically analyzable JSX spread objects",
    code: `
      const first = <button {...{ onClick: handleClick }} />;
      const second = <Dialog {...({ onDismiss: () => setOpen(false) } satisfies DialogProps)} />;
    `,
  },
  {
    name: "ignores dynamic JSX spreads whose handler keys cannot be resolved",
    code: `
      const first = <button {...handlers} />;
      const second = <button {...{ [eventName]: () => save() }} />;
      const third = <button {...{ onClick: () => save(), ...handlers }} />;
    `,
  },
  {
    name: "ignores attributes that are not on-prefixed callbacks",
    code: `const view = <Widget renderItem={() => save()} onchange={() => save()} />;`,
  },
];

for (const fixture of validCases) {
  test(fixture.name, () => {
    assert.deepEqual(messages(fixture.code), []);
  });
}

const invalidCases = [
  {
    name: "rejects an event-parameter setter",
    code: `
      const view = <input onChange={(event) => setValue(event.currentTarget.value)} />;
    `,
    messageIds: ["name"],
  },
  {
    name: "rejects a functional updater",
    code: `const view = <button onClick={() => setCount((count) => count + 1)}>+</button>;`,
    messageIds: ["name"],
  },
  {
    name: "rejects an inline callback invocation",
    code: `const view = <button onClick={() => onSelect(id)}>Select</button>;`,
    messageIds: ["name"],
  },
  {
    name: "rejects inline navigation",
    code: `const view = <button onClick={() => navigate("/projects")}>Go</button>;`,
    messageIds: ["name"],
  },
  {
    name: "rejects an async inline setter",
    code: `const view = <button onClick={async () => setOpen(true)}>Open</button>;`,
    messageIds: ["name"],
  },
  {
    name: "rejects an inline function expression",
    code: `const view = <button onClick={function () { setOpen(true); }}>Open</button>;`,
    messageIds: ["name"],
  },
  {
    name: "rejects an empty inline function",
    code: `const view = <button onClick={() => {}}>No-op</button>;`,
    messageIds: ["name"],
  },
  {
    name: "rejects multiple inline statements",
    code: `
      const view = <button onClick={() => { setSaving(true); save(); }}>Save</button>;
    `,
    messageIds: ["name"],
  },
  {
    name: "rejects a conditional inline procedure",
    code: `
      const view = <button onClick={() => { if (ready) setOpen(true); }}>Open</button>;
    `,
    messageIds: ["name"],
  },
  {
    name: "rejects a return-wrapped setter",
    code: `const view = <button onClick={() => { return setOpen(true); }}>Open</button>;`,
    messageIds: ["name"],
  },
  {
    name: "rejects a member setter call",
    code: `const view = <button onClick={() => state.setOpen(true)}>Open</button>;`,
    messageIds: ["name"],
  },
  {
    name: "rejects lower-case setter names",
    code: `const view = <button onClick={() => setopen(true)}>Open</button>;`,
    messageIds: ["name"],
  },
  {
    name: "does not confuse timer globals with state setters",
    code: `const view = <button onClick={() => setTimeout(run, 10)}>Later</button>;`,
    messageIds: ["name"],
  },
  {
    name: "rejects every non-state set-prefixed timer global",
    code: `
      const first = <button onClick={() => setImmediate(run)}>Later</button>;
      const second = <button onClick={() => setInterval(run, 10)}>Later</button>;
      const third = <button onClick={() => setTimeout(run, 10)}>Later</button>;
    `,
    messageIds: ["name", "name", "name"],
  },
  {
    name: "rejects an optional direct setter call",
    code: `const view = <button onClick={() => setOpen?.(true)}>Open</button>;`,
    messageIds: ["name"],
  },
  {
    name: "rejects setter aliases that hide the state-update contract",
    code: `const view = <button onClick={() => updateOpen(true)}>Open</button>;`,
    messageIds: ["name"],
  },
  {
    name: "rejects behavior hidden inside a setter argument",
    code: `const view = <button onClick={() => setValue(loadValue())}>Load</button>;`,
    messageIds: ["name"],
  },
  {
    name: "rejects calls inside a state updater",
    code: `
      const view = <button onClick={() => setItems((items) => items.filter(keep))}>Filter</button>;
    `,
    messageIds: ["name"],
  },
  {
    name: "rejects mutation inside a setter argument",
    code: `const view = <button onClick={() => setValue(value++)}>Increment</button>;`,
    messageIds: ["name"],
  },
  {
    name: "rejects assignment, deletion, sequencing, and tagged templates in setter data",
    code: `
      const first = <button onClick={() => setValue(value = next)}>Assign</button>;
      const second = <button onClick={() => setValue(delete source.value)}>Delete</button>;
      const third = <button onClick={() => setValue((first, second))}>Sequence</button>;
      const fourth = <button onClick={() => setValue(tag\`value\`)}>Tag</button>;
    `,
    messageIds: ["name", "name", "name", "name"],
  },
  {
    name: "rejects a call hidden inside a spread setter argument",
    code: `const view = <button onClick={() => setItems(...loadItems())}>Load</button>;`,
    messageIds: ["name"],
  },
  {
    name: "rejects construction inside a setter argument",
    code: `const view = <button onClick={() => setDate(new Date())}>Today</button>;`,
    messageIds: ["name"],
  },
  {
    name: "rejects a handler factory call",
    code: `const view = <button onClick={makeHandler(id)}>Run</button>;`,
    messageIds: ["name"],
  },
  {
    name: "rejects inline behavior in statically analyzable JSX spread objects",
    code: `
      const first = <button {...{ onClick: () => save() }} />;
      const second = <Dialog {...({ ["onDismiss"]: makeHandler(id) } as DialogProps)} />;
      const third = <button {...{ ...handlers, onClick: () => save() }} />;
    `,
    messageIds: ["name", "name", "name"],
  },
  {
    name: "rejects a member read from a factory call",
    code: `const view = <button onClick={getHandlers().handleClick}>Run</button>;`,
    messageIds: ["name"],
  },
  {
    name: "rejects a computed member whose key executes behavior",
    code: `const view = <button onClick={handlers[getAction()]}>Run</button>;`,
    messageIds: ["name"],
  },
  {
    name: "rejects bind expressions",
    code: `const view = <button onClick={handleClick.bind(null, id)}>Run</button>;`,
    messageIds: ["name"],
  },
  {
    name: "rejects conditional handler selection",
    code: `const view = <button onClick={ready ? handleReady : handleWaiting}>Run</button>;`,
    messageIds: ["name"],
  },
  {
    name: "rejects logical handler selection",
    code: `const view = <button onClick={ready && handleReady}>Run</button>;`,
    messageIds: ["name"],
  },
  {
    name: "rejects null and undefined handler values",
    code: `
      const first = <button onClick={null}>Run</button>;
      const second = <button onClick={undefined}>Run</button>;
    `,
    messageIds: ["name", "name"],
  },
  {
    name: "rejects string and shorthand handler attributes",
    code: `
      const first = <Widget onAction="run" />;
      const second = <Widget onAction />;
    `,
    messageIds: ["name", "name"],
  },
  {
    name: "reports invalid handlers in source order",
    code: `
      const first = <button onClick={() => save()}>Save</button>;
      const second = <input onChange={makeHandler(id)} />;
    `,
    messageIds: ["name", "name"],
  },
  {
    name: "enforces the rule in test files",
    code: `const view = <button onClick={() => save()}>Save</button>;`,
    filename: "Example.test.tsx",
    messageIds: ["name"],
  },
  {
    name: "enforces the rule in story files",
    code: `const view = <Button onPress={() => save()} />;`,
    filename: "Example.stories.tsx",
    messageIds: ["name"],
  },
  {
    name: "enforces the rule in generated files",
    code: `const view = <button onClick={() => save()}>Save</button>;`,
    filename: "Example.generated.tsx",
    messageIds: ["name"],
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

test("reports exact attribute diagnostics in source order and at attribute coordinates", () => {
  const result = messages(`const first = <button onClick={() => save()}>Save</button>;
const second = <input onChange={makeHandler(id)} />;`);

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
        ruleId: "test/no-inline-behavior-handlers",
        severity: 2,
        messageId: "name",
        message:
          "Pass a named function to onClick; the only permitted inline handler is () => setX(...).",
        line: 1,
        column: 23,
      },
      {
        ruleId: "test/no-inline-behavior-handlers",
        severity: 2,
        messageId: "name",
        message:
          "Pass a named function to onChange; the only permitted inline handler is () => setX(...).",
        line: 2,
        column: 23,
      },
    ],
  );
});
