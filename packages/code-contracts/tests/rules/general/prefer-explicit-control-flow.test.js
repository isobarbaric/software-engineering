import assert from "node:assert/strict";
import test from "node:test";
import { generalRules } from "../../../src/index.js";
import { lintRule } from "../../lint-rule.js";

const ruleName = "prefer-explicit-control-flow";

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
    name: "accepts explicit if/else control flow",
    code: `
      function label(ready: boolean) {
        if (ready) { return "ready"; } else { return "waiting"; }
      }
    `,
  },
  {
    name: "accepts a guard clause without an else",
    code: `
      function save(value?: string) {
        if (!value) return;
        persist(value);
      }
    `,
  },
  {
    name: "accepts a native switch over one subject",
    code: `
      switch (status) {
        case Status.Pending: showPending(); break;
        case Status.Complete: showComplete(); break;
        default: showUnknown();
      }
    `,
  },
  {
    name: "accepts one strict comparison because there is no chain",
    code: `if (status === Status.Pending) { showPending(); }`,
  },
  {
    name: "accepts an else-if chain over different subjects",
    code: `
      if (status === Status.Pending) { showPending(); }
      else if (mode === Mode.Compact) { showCompact(); }
    `,
  },
  {
    name: "does not guess through compound predicates",
    code: `
      if (status === Status.Pending && ready) { showPending(); }
      else if (status === Status.Complete) { showComplete(); }
    `,
  },
  {
    name: "does not classify range branches as matching",
    code: `
      if (count > 10) { showLarge(); }
      else if (count > 5) { showMedium(); }
    `,
  },
  {
    name: "does not classify inequality branches as matching",
    code: `
      if (status !== Status.Pending) { showOther(); }
      else if (status !== Status.Complete) { showPending(); }
    `,
  },
  {
    name: "does not classify loose equality branches as matching",
    code: `
      if (status == Status.Pending) { showPending(); }
      else if (status == Status.Complete) { showComplete(); }
    `,
  },
  {
    name: "does not suggest evaluating a call once with switch",
    code: `
      if (getStatus() === Status.Pending) { showPending(); }
      else if (getStatus() === Status.Complete) { showComplete(); }
    `,
  },
  {
    name: "does not suggest switch for a dynamic computed member",
    code: `
      if (record[key] === Status.Pending) { showPending(); }
      else if (record[key] === Status.Complete) { showComplete(); }
    `,
  },
  {
    name: "does not mistake a repeated enum member for the subject",
    code: `
      if (Status.Pending === status) { showStatus(); }
      else if (Status.Pending === mode) { showMode(); }
    `,
  },
  {
    name: "does not mistake a repeated constant for the subject",
    code: `
      if (PENDING === status) { showStatus(); }
      else if (PENDING === mode) { showMode(); }
    `,
  },
  {
    name: "does not mistake a repeated literal for the subject",
    code: `
      if (status === "pending") { showStatus(); }
      else if (mode === "pending") { showMode(); }
    `,
  },
  {
    name: "accepts boolean logic inside an if condition",
    code: `if (ready && enabled) { run(); }`,
  },
  {
    name: "accepts logical operators used as data expressions",
    code: `
      const enabled = ready && permitted;
      const selected = primary || secondary;
      const value = input ?? fallback;
    `,
  },
  {
    name: "accepts a logical expression passed as an argument",
    code: `render(ready && enabled);`,
  },
  {
    name: "accepts a conditional expression in an initializer",
    code: `const label = ready ? "ready" : "waiting";`,
  },
  {
    name: "accepts a conditional return expression",
    code: `function label() { return ready ? "ready" : "waiting"; }`,
  },
  {
    name: "accepts a conditional expression in JSX",
    code: `const view = <section>{ready ? <Ready /> : <Waiting />}</section>;`,
  },
  {
    name: "accepts and-based conditional JSX",
    code: `const view = <section>{ready && <Ready />}</section>;`,
  },
  {
    name: "accepts or-based fallback JSX",
    code: `const view = <section>{content || <Fallback />}</section>;`,
  },
  {
    name: "accepts nullish fallback JSX",
    code: `const view = <section>{content ?? <Fallback />}</section>;`,
  },
  {
    name: "accepts simple conditional expressions in test files",
    code: `const result = pass ? expected : actual;`,
    filename: "Example.test.tsx",
  },
  {
    name: "accepts boolean props and conditional callbacks",
    code: `const view = <Card disabled={disabled || !canComment} onDelete={canDelete ? handleDelete : undefined} />;`,
  },
  {
    name: "accepts grouped copy and nullish fallbacks",
    code: `const copy = root ? { label: "Delete Thread", description: "Deletes replies too" } : { label: "Delete Reply", description: "Deletes one reply" }; const author = name ?? "Unknown";`,
  },
  {
    name: "accepts independent decisions inside object values",
    code: `const props = enabled ? { label: compact ? "Go" : "Continue" } : {};`,
  },
  {
    name: "accepts independent decisions inside JSX children and props",
    code: `const view = ready ? <Card title={active ? "Active" : "Idle"}>{canComment && <Composer />}{empty ? <Empty /> : <List />}</Card> : <Loading />;`,
  },
  {
    name: "accepts independent decisions inside callback bodies",
    code: `const items = ready ? entries.map(entry => entry.active ? entry.name : null) : [];`,
  },
  {
    name: "accepts conditional values through TypeScript wrappers",
    code: `const label = (ready ? "ready" : "waiting") satisfies string; const content = <div>{(ready && <Ready />) as React.ReactNode}</div>;`,
  },
  {
    name: "accepts logical data expressions containing a simple conditional",
    code: `const enabled = allowed && (admin ? canAdmin : canEdit);`,
  },
  {
    name: "accepts a derived value in a non-JSX module",
    filename: "Example.ts",
    code: `const label = ready ? "Ready" : "Waiting";`,
  },
];

for (const fixture of validCases) {
  test(fixture.name, () => {
    assert.deepEqual(messages(fixture.code, fixture.filename), []);
  });
}

const invalidCases = [
  {
    name: "reports the nested conditional in an alternate",
    code: `const value = first ? one : second ? two : three;`,
    messageIds: ["conditional"],
  },
  {
    name: "rejects an and expression statement",
    code: `ready && run();`,
    messageIds: ["shortCircuit"],
  },
  {
    name: "rejects an or expression statement",
    code: `ready || run();`,
    messageIds: ["shortCircuit"],
  },
  {
    name: "rejects a nullish expression statement",
    code: `value ?? initialize();`,
    messageIds: ["shortCircuit"],
  },
  {
    name: "reports one diagnostic for a nested short-circuit statement",
    code: `(ready && enabled) || run();`,
    messageIds: ["shortCircuit"],
  },
  {
    name: "rejects a short-circuit statement through TypeScript wrappers",
    code: `(ready && run()) as unknown;`,
    messageIds: ["shortCircuit"],
  },
  {
    name: "rejects logical assignment operators",
    code: `
      ready &&= check();
      value ||= createValue();
      result ??= fallback;
    `,
    messageIds: ["shortCircuit", "shortCircuit", "shortCircuit"],
  },
  {
    name: "requires switch for two strict branches over one identifier",
    code: `
      if (status === Status.Pending) { showPending(); }
      else if (status === Status.Complete) { showComplete(); }
    `,
    messageIds: ["sameSubject"],
    message: "Use a switch on status when every branch compares the same value.",
  },
  {
    name: "recognizes a shared subject with reversed comparisons",
    code: `
      if (Status.Pending === status) { showPending(); }
      else if (status === Status.Complete) { showComplete(); }
    `,
    messageIds: ["sameSubject"],
  },
  {
    name: "requires switch for a static member subject",
    code: `
      if (result.kind === ResultKind.Success) { showValue(); }
      else if (result.kind === ResultKind.Failure) { showError(); }
    `,
    messageIds: ["sameSubject"],
    message:
      "Use a switch on result.kind when every branch compares the same value.",
  },
  {
    name: "requires switch for a member subject rooted at this",
    code: `
      if (this.status === Status.Pending) { showPending(); }
      else if (this.status === Status.Complete) { showComplete(); }
    `,
    messageIds: ["sameSubject"],
  },
  {
    name: "recognizes a quoted static member subject",
    code: `
      if (result["result-kind"] === ResultKind.Success) { showValue(); }
      else if (result["result-kind"] === ResultKind.Failure) { showError(); }
    `,
    messageIds: ["sameSubject"],
  },
  {
    name: "recognizes a static template-literal member through TypeScript wrappers",
    code: `
      if ((result[\`kind\`] as ResultKind) === ResultKind.Success) { showValue(); }
      else if (result[\`kind\`]! === ResultKind.Failure) { showError(); }
    `,
    messageIds: ["sameSubject"],
    message:
      "Use a switch on result[`kind`]! when every branch compares the same value.",
  },
  {
    name: "does not require a final else to identify the chain",
    code: `
      if (status === Status.Pending) { showPending(); }
      else if (status === Status.Complete) { showComplete(); }
    `,
    messageIds: ["sameSubject"],
  },
  {
    name: "reports a multi-branch chain once",
    code: `
      if (status === Status.Pending) { showPending(); }
      else if (status === Status.Complete) { showComplete(); }
      else if (status === Status.Failed) { showFailure(); }
      else { showUnknown(); }
    `,
    messageIds: ["sameSubject"],
  },
  {
    name: "enforces matching chains in story files",
    code: `
      if (variant === Variant.Primary) { renderPrimary(); }
      else if (variant === Variant.Secondary) { renderSecondary(); }
    `,
    filename: "Example.stories.tsx",
    messageIds: ["sameSubject"],
  },
  {
    name: "enforces short-circuit branches in generated files",
    code: `ready && renderReady();`,
    filename: "Example.generated.tsx",
    messageIds: ["shortCircuit"],
  },
  {
    name: "rejects a conditional nested in a consequent",
    code: `const value = first ? second ? one : two : three;`,
    messageIds: ["conditional"],
  },
  {
    name: "rejects a conditional nested in a condition",
    code: `const value = (first ? second : third) ? one : two;`,
    messageIds: ["conditional"],
  },
  {
    name: "reports each additional decision in a ternary chain once",
    code: `const value = first ? one : second ? two : third ? three : four;`,
    messageIds: ["conditional", "conditional"],
  },
  {
    name: "rejects nested ternaries through logical operators and casts",
    code: `const value = first ? one : allowed && ((second ? two : three) as string);`,
    messageIds: ["conditional"],
  },
  {
    name: "rejects nesting through satisfies and non-null assertions",
    code: `const value = first ? ((second ? two : three) satisfies string)! : four;`,
    messageIds: ["conditional"],
  },
  {
    name: "rejects nesting through angle-bracket type assertions",
    filename: "Example.ts",
    code: `const value = first ? <string>(second ? two : three) : four;`,
    messageIds: ["conditional"],
  },
  {
    name: "rejects a ternary chain in a JSX child",
    code: `const view = <section>{loading ? <Loading /> : error ? <Error /> : <Content />}</section>;`,
    messageIds: ["conditional"],
  },
  {
    name: "rejects nested ternaries inside a separately scoped object value",
    code: `const props = ready ? { label: first ? one : second ? two : three } : {};`,
    messageIds: ["conditional"],
  },
  {
    name: "rejects a conditional expression statement",
    code: `ready ? save() : cancel();`,
    messageIds: ["conditionalStatement"],
  },
  {
    name: "rejects a conditional statement through TypeScript wrappers",
    code: `(ready ? save() : cancel()) as unknown;`,
    messageIds: ["conditionalStatement"],
  },
  {
    name: "enforces nested decisions in test files",
    code: `const result = pass ? expected : retry ? previous : actual;`,
    filename: "Example.test.tsx",
    messageIds: ["conditional"],
  },
];

for (const fixture of invalidCases) {
  test(fixture.name, () => {
    const result = messages(fixture.code, fixture.filename);
    assert.deepEqual(
      result.map((message) => message.messageId),
      fixture.messageIds,
    );
    if (fixture.message) assert.equal(result[0].message, fixture.message);
  });
}

test("reports exact control-flow messages, order, and locations", () => {
  const result = messages(`const label = ready ? "ready" : retry ? "retry" : "waiting";
ready && render();
if (status === Status.Pending) { showPending(); }
else if (status === Status.Complete) { showComplete(); }`);

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
        messageId: "conditional",
        message:
          "Replace this nested conditional expression with named values or explicit control flow.",
        line: 1,
        column: 33,
        endLine: 1,
        endColumn: 60,
      },
      {
        messageId: "shortCircuit",
        message:
          "Replace this short-circuit branch with explicit if/else control flow.",
        line: 2,
        column: 1,
        endLine: 2,
        endColumn: 18,
      },
      {
        messageId: "sameSubject",
        message:
          "Use a switch on status when every branch compares the same value.",
        line: 3,
        column: 1,
        endLine: 4,
        endColumn: 57,
      },
    ],
  );
});
