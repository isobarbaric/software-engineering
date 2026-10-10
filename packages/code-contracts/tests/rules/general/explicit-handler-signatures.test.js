import assert from "node:assert/strict";
import test from "node:test";
import { generalRules } from "../../../src/index.js";
import { lintRule } from "../../lint-rule.js";

const ruleName = "explicit-handler-signatures";

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
    name: "accepts a fully visible callback property",
    code: `interface FormProps { onSave: (input: SaveInput) => Promise<void>; }`,
  },
  {
    name: "accepts an optional callback property",
    code: `interface FormProps { onCancel?: () => void; }`,
  },
  {
    name: "accepts explicit React event and element types",
    code: `
      interface ButtonProps {
        onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
      }
    `,
  },
  {
    name: "accepts a generic callback signature",
    code: `interface ListProps { onSelect: <T extends Item>(item: T) => T; }`,
  },
  {
    name: "accepts quoted and computed static callback names",
    code: `
      interface FormProps {
        "onSave": (input: SaveInput) => void;
        ["onCancel"]?: () => void;
      }
    `,
  },
  {
    name: "accepts a parenthesized visible signature",
    code: `interface FormProps { onSave: ((input: SaveInput) => void); }`,
  },
  {
    name: "accepts a TypeScript-wrapped local implementation with direct types",
    code: `
      const handleSave = ((input: SaveInput): void => save(input)) satisfies (
        (input: SaveInput) => void
      );
    `,
  },
  {
    name: "accepts typed rest and optional parameters",
    code: `
      interface ListProps {
        onSelect: (first: Item, next?: Item, ...remaining: Item[]) => void;
      }
    `,
  },
  {
    name: "allows local handler inference",
    code: `const handleSave = async (input: SaveInput) => save(input);`,
  },
  {
    name: "allows a direct local handler annotation",
    code: `
      const handleSave: (input: SaveInput) => Promise<void> = async (input) => {
        await save(input);
      };
    `,
  },
  {
    name: "allows a directly typed handler declaration",
    code: `function handleSave(input: SaveInput): Promise<void> { return save(input); }`,
  },
  {
    name: "allows an inferred return type on a local handler declaration",
    code: `function handleSave(input: SaveInput) { return save(input); }`,
  },
  {
    name: "allows named implementation expressions to use direct types",
    code: `consume(function handleSave(input: SaveInput): void { save(input); });`,
  },
  {
    name: "ignores non-handler properties",
    code: `interface Data { callback: FormProps["onSave"]; onchange: typeof save; }`,
  },
  {
    name: "ignores variables without the handle naming contract",
    code: `const saveCallback: typeof save = save;`,
  },
  {
    name: "ignores dynamic property names",
    code: `interface Handlers { [handlerName]: typeof save; }`,
  },
  {
    name: "does not confuse a symbol key with an on-prefixed property name",
    code: `
      declare const onSave: unique symbol;
      interface Handlers { [onSave]: typeof save; }
    `,
  },
  {
    name: "ignores names that only resemble handler conventions",
    code: `
      interface Data {
        onsave: SaveHandler;
        on_save: SaveHandler;
        on2Save: SaveHandler;
      }
      const handlesave: typeof save = save;
      const handle_save: typeof save = save;
      const handle2Save: typeof save = save;
    `,
  },
  {
    name: "does not mistake locally shadowed utility names for built-ins",
    code: `
      type Parameters<T> = T;
      type ReturnType<T> = T;
      interface FormProps {
        onSave: (input: Parameters<SaveInput>) => ReturnType<SaveResult>;
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
    name: "rejects a named callback alias on a public prop",
    code: `interface FormProps { onSave: SaveHandler; }`,
    messageIds: ["hidden"],
  },
  {
    name: "rejects a React callback alias",
    code: `interface ButtonProps { onClick: React.MouseEventHandler<HTMLButtonElement>; }`,
    messageIds: ["hidden"],
  },
  {
    name: "rejects an indexed callback type",
    code: `interface FormProps { onSave: FormActions["onSubmit"]; }`,
    messageIds: ["hidden"],
  },
  {
    name: "rejects a typeof callback type",
    code: `interface FormProps { onSave: typeof save; }`,
    messageIds: ["hidden"],
  },
  {
    name: "rejects Parameters at any depth in a visible signature",
    code: `
      interface FormProps {
        onSave: (input: Parameters<typeof save>[0]) => Promise<void>;
      }
    `,
    messageIds: ["derived"],
  },
  {
    name: "rejects ReturnType at any depth in a visible signature",
    code: `interface FormProps { onSave: (input: SaveInput) => ReturnType<typeof save>; }`,
    messageIds: ["derived"],
  },
  {
    name: "rejects indexed parameter data in a visible signature",
    code: `interface FormProps { onSave: (input: Request["payload"]) => void; }`,
    messageIds: ["derived"],
  },
  {
    name: "rejects callback method syntax",
    code: `interface FormProps { onSave(input: SaveInput): void; }`,
    messageIds: ["hidden"],
  },
  {
    name: "rejects a static template-literal callback property",
    code: "interface FormProps { [`onSave`]: SaveHandler; }",
    messageIds: ["hidden"],
  },
  {
    name: "rejects a union-wrapped callback",
    code: `interface FormProps { onSave: ((input: SaveInput) => void) | undefined; }`,
    messageIds: ["hidden"],
  },
  {
    name: "rejects an object call signature",
    code: `interface FormProps { onSave: { (input: SaveInput): void }; }`,
    messageIds: ["hidden"],
  },
  {
    name: "requires parameter types in a public callback",
    code: `interface FormProps { onSave: (input) => void; }`,
    messageIds: ["incomplete"],
  },
  {
    name: "requires a type for every public callback parameter",
    code: `interface FormProps { onSave: (input: SaveInput, options) => void; }`,
    messageIds: ["incomplete"],
  },
  {
    name: "rejects an explicit alias on a local handler",
    code: `const handleSave: SaveHandler = save;`,
    messageIds: ["hidden"],
  },
  {
    name: "rejects typeof on a local handler",
    code: `const handleSave: typeof save = save;`,
    messageIds: ["hidden"],
  },
  {
    name: "rejects an indexed arrow-function parameter",
    code: `const handleSave = (input: FormProps["value"]) => save(input);`,
    messageIds: ["derived"],
  },
  {
    name: "rejects a TypeScript-wrapped handler with a derived parameter",
    code: `
      const handleSave = ((input: FormProps["value"]): void => save(input)) as (
        (input: SaveInput) => void
      );
    `,
    messageIds: ["derived"],
  },
  {
    name: "rejects derived types nested inside generic wrappers",
    code: `
      interface FormProps {
        onSave: (input: Readonly<Parameters<typeof save>[0]>) => void;
      }
    `,
    messageIds: ["derived"],
  },
  {
    name: "rejects Parameters on a local rest parameter",
    code: `const handleSave = (...args: Parameters<typeof save>): void => save(...args);`,
    messageIds: ["derived"],
  },
  {
    name: "rejects Parameters in a handler declaration",
    code: `function handleSave(input: Parameters<typeof save>[0]): void { save(input); }`,
    messageIds: ["derived"],
  },
  {
    name: "rejects ReturnType in a handler declaration",
    code: `function handleSave(input: SaveInput): ReturnType<typeof save> { return save(input); }`,
    messageIds: ["derived"],
  },
  {
    name: "rejects derived types on a named handler expression",
    code: `
      consume(function handleSave(input: Request["payload"]): void {
        save(input);
      });
    `,
    messageIds: ["derived"],
  },
  {
    name: "rejects a named handle expression assigned to a differently named variable",
    code: `
      const callback = function handleSave(input: Request["payload"]): void {
        save(input);
      };
    `,
    messageIds: ["derived"],
  },
  {
    name: "reports multiple callback properties in source order",
    code: `
      interface FormProps {
        onSave: SaveHandler;
        onCancel(): void;
      }
    `,
    messageIds: ["hidden", "hidden"],
  },
  {
    name: "enforces public signatures in test files",
    code: `interface HarnessProps { onRun: RunHandler; }`,
    filename: "Harness.test.tsx",
    messageIds: ["hidden"],
  },
  {
    name: "enforces public signatures in generated files",
    code: `interface GeneratedProps { onLoad: typeof load; }`,
    filename: "Generated.generated.ts",
    messageIds: ["hidden"],
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

test("reports exact diagnostics in source order without filename exemptions", () => {
  const result = messages(`interface FormProps {
  onSave: SaveHandler;
  onCancel: (reason) => void;
  onReset: (value: Parameters<typeof reset>[0]) => void;
}`);

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
        ruleId: "test/explicit-handler-signatures",
        severity: 2,
        messageId: "hidden",
        message:
          "Write the onSave callback as a fully visible function signature instead of a callback alias or method.",
        line: 2,
        column: 3,
      },
      {
        ruleId: "test/explicit-handler-signatures",
        severity: 2,
        messageId: "incomplete",
        message:
          "Write explicit parameter and return types in the onCancel callback signature.",
        line: 3,
        column: 3,
      },
      {
        ruleId: "test/explicit-handler-signatures",
        severity: 2,
        messageId: "derived",
        message:
          "Write the onReset callback signature directly; do not derive it through indexed access, typeof, Parameters, or ReturnType.",
        line: 4,
        column: 3,
      },
    ],
  );
});
