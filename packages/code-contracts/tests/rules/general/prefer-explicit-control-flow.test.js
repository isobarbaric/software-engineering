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
];

for (const fixture of validCases) {
  test(fixture.name, () => {
    assert.deepEqual(messages(fixture.code), []);
  });
}

const invalidCases = [
  {
    name: "rejects a conditional expression in an initializer",
    code: `const label = ready ? "ready" : "waiting";`,
    messageIds: ["conditional"],
  },
  {
    name: "rejects a conditional return expression",
    code: `function label() { return ready ? "ready" : "waiting"; }`,
    messageIds: ["conditional"],
  },
  {
    name: "rejects a conditional expression in JSX",
    code: `const view = <section>{ready ? <Ready /> : <Waiting />}</section>;`,
    messageIds: ["conditional"],
  },
  {
    name: "reports every nested conditional expression",
    code: `const value = first ? one : second ? two : three;`,
    messageIds: ["conditional", "conditional"],
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
    name: "rejects and-based conditional JSX",
    code: `const view = <section>{ready && <Ready />}</section>;`,
    messageIds: ["shortCircuit"],
  },
  {
    name: "rejects or-based fallback JSX",
    code: `const view = <section>{content || <Fallback />}</section>;`,
    messageIds: ["shortCircuit"],
  },
  {
    name: "rejects nullish fallback JSX",
    code: `const view = <section>{content ?? <Fallback />}</section>;`,
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
    name: "enforces conditional expressions in test files",
    code: `const result = pass ? expected : actual;`,
    filename: "Example.test.tsx",
    messageIds: ["conditional"],
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
  const result = messages(`const label = ready ? "ready" : "waiting";
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
          "Replace this conditional expression with explicit if/else control flow.",
        line: 1,
        column: 15,
        endLine: 1,
        endColumn: 42,
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
