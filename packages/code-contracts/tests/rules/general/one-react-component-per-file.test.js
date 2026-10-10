import assert from "node:assert/strict";
import test from "node:test";
import { generalRules } from "../../../src/index.js";
import { lintRule } from "../../lint-rule.js";

const ruleName = "one-react-component-per-file";

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
    name: "allows one function component",
    code: `export function AccountCard() { return <article />; }`,
  },
  {
    name: "allows one arrow component",
    code: `export const AccountCard = () => <article />;`,
  },
  {
    name: "allows one memo component",
    code: `export const AccountCard = memo(() => <article />);`,
  },
  {
    name: "allows one forwardRef component",
    code: `export const AccountInput = forwardRef((props, ref) => <input ref={ref} />);`,
  },
  {
    name: "allows one named function expression component returning a fragment",
    code: `export const AccountCard = function AccountCard() { return <><article /></>; };`,
  },
  {
    name: "allows one async generic function component",
    code: `export async function AccountCard<T extends object>(props: T) { return <article />; }`,
  },
  {
    name: "allows one class component",
    code: `export class AccountCard extends React.Component { render() { return <article />; } }`,
  },
  {
    name: "recognizes createElement components",
    code: `export function AccountCard() { return React.createElement("article"); }`,
  },
  {
    name: "ignores lowercase render helpers",
    code: `
      function renderTitle() { return <h1 />; }
      export function AccountCard() { return <article>{renderTitle()}</article>; }
    `,
  },
  {
    name: "ignores PascalCase functions without React output",
    code: `
      function BuildAccountRecord() { return { id: "account-1" }; }
      export function AccountCard() { return <article />; }
    `,
  },
  {
    name: "ignores classes that do not extend a React component base",
    code: `
      class AccountRecord extends Map {}
      export function AccountCard() { return <article />; }
    `,
  },
  {
    name: "ignores component-like functions passed to unsupported wrappers",
    code: `
      const ObservedCard = observer(() => <article />);
      export function AccountCard() { return <article />; }
    `,
  },
  {
    name: "allows attaching an imported compound component",
    code: `
      import { DialogHeader } from "./DialogHeader";
      export function Dialog() { return <dialog />; }
      Dialog.Header = DialogHeader;
    `,
  },
  {
    name: "allows attaching an imported component through a quoted static property",
    code: `
      import { DialogHeader } from "./DialogHeader";
      export function Dialog() { return <dialog />; }
      Dialog["Header"] = DialogHeader;
    `,
  },
  {
    name: "does not classify a dynamic computed property as a component declaration",
    code: `
      export function Dialog() { return <dialog />; }
      const slotName = getSlotName();
      Dialog[slotName] = () => <header />;
    `,
  },
];

for (const fixture of validCases) {
  test(fixture.name, () => {
    assert.deepEqual(messages(fixture.code), []);
  });
}

const exemptFiles = [
  ...["test", "spec", "story", "stories"].flatMap((suffix) =>
    ["ts", "tsx"].map(
      (extension) => `AccountCard.${suffix}.${extension}`,
    ),
  ),
  "src/__tests__/AccountCard.tsx",
  "src/__stories__/AccountCard.tsx",
  "src\\__tests__\\AccountCard.tsx",
  "src\\__stories__\\AccountCard.tsx",
];

for (const filename of exemptFiles) {
  test(`exempts ${filename}`, () => {
    const componentBody = filename.endsWith(".tsx")
      ? [`return <div />;`, `return <span />;`]
      : [`return createElement("div");`, `return createElement("span");`];

    assert.deepEqual(
      messages(
        `
          function First() { ${componentBody[0]} }
          function Second() { ${componentBody[1]} }
        `,
        filename,
      ),
      [],
    );
  });
}

test("does not exempt a misspelled story suffix", () => {
  const result = messages(
    `
      function First() { return <div />; }
      function Second() { return <span />; }
    `,
    "AccountCard.storie.tsx",
  );

  assert.deepEqual(
    result.map(({ messageId, message }) => ({ messageId, message })),
    [
      {
        messageId: "extraComponent",
        message:
          "Move Second to its own file. First is already the component owned by this module.",
      },
    ],
  );
});

for (const filename of [
  "AccountCard.generated.tsx",
  "src/__generated__/AccountCard.tsx",
]) {
  test(`does not exempt ${filename}`, () => {
    const result = messages(
      `
        function First() { return <div />; }
        function Second() { return <span />; }
      `,
      filename,
    );

    assert.deepEqual(
      result.map(({ messageId, message }) => ({ messageId, message })),
      [
        {
          messageId: "extraComponent",
          message:
            "Move Second to its own file. First is already the component owned by this module.",
        },
      ],
    );
  });
}

const invalidCases = [
  {
    name: "rejects a second function component",
    code: `
      function First() { return <div />; }
      function Second() { return <span />; }
    `,
    expected: [{ name: "Second", first: "First" }],
  },
  {
    name: "recognizes a named default function export",
    code: `
      export default function First() { return <div />; }
      export const Second = () => <span />;
    `,
    expected: [{ name: "Second", first: "First" }],
  },
  {
    name: "recognizes a component exported through a separate export list",
    code: `
      const First = () => <div />;
      export { First };
      export function Second() { return <span />; }
    `,
    expected: [{ name: "Second", first: "First" }],
  },
  {
    name: "recognizes a component exported as the default identifier",
    code: `
      const First = () => <div />;
      export default First;
      export function Second() { return <span />; }
    `,
    expected: [{ name: "Second", first: "First" }],
  },
  {
    name: "rejects a second arrow component",
    code: `
      const First = () => <div />;
      const Second = () => <span />;
    `,
    expected: [{ name: "Second", first: "First" }],
  },
  {
    name: "recognizes function expressions and JSX fragments",
    code: `
      const First = function First() { return <><div /></>; };
      function Second() { return <span />; }
    `,
    expected: [{ name: "Second", first: "First" }],
  },
  {
    name: "checks every declarator in one variable statement",
    code: `
      const First = () => <div />, Second = () => <span />;
    `,
    expected: [{ name: "Second", first: "First" }],
  },
  {
    name: "recognizes React namespace memo and forwardRef wrappers",
    code: `
      const First = React.memo(() => <div />);
      const Second = React.forwardRef((props, ref) => <span ref={ref} />);
    `,
    expected: [{ name: "Second", first: "First" }],
  },
  {
    name: "recognizes nested memo and forwardRef wrappers",
    code: `
      const First = memo(forwardRef((props, ref) => <div ref={ref} />));
      function Second() { return <span />; }
    `,
    expected: [{ name: "Second", first: "First" }],
  },
  {
    name: "recognizes typed and optional React wrappers",
    code: `
      const First = React.memo?.<FirstProps>(() => <div />);
      const Second = forwardRef<Element, SecondProps>((props, ref) => <span ref={ref} />);
    `,
    expected: [{ name: "Second", first: "First" }],
  },
  {
    name: "rejects a nested component",
    code: `
      function First() {
        function Nested() { return <span />; }
        return <Nested />;
      }
    `,
    expected: [{ name: "Nested", first: "First" }],
  },
  {
    name: "rejects a mixed class and function component",
    code: `
      class First extends React.Component { render() { return <div />; } }
      function Second() { return <span />; }
    `,
    expected: [{ name: "Second", first: "First" }],
  },
  {
    name: "recognizes imported PureComponent subclasses",
    code: `
      class First extends PureComponent { render() { return <div />; } }
      function Second() { return <span />; }
    `,
    expected: [{ name: "Second", first: "First" }],
  },
  {
    name: "recognizes TypeScript-wrapped function initializers",
    code: `
      const First = (() => <div />) satisfies React.FC;
      function Second() { return <span />; }
    `,
    expected: [{ name: "Second", first: "First" }],
  },
  {
    name: "rejects a local function attached as a compound component",
    code: `
      function Dialog() { return <dialog />; }
      Dialog.Header = function DialogHeader() { return <header />; };
    `,
    expected: [{ name: "Header", first: "Dialog" }],
  },
  {
    name: "rejects a local arrow attached as a compound component",
    code: `
      function Dialog() { return <dialog />; }
      Dialog.Header = () => <header />;
    `,
    expected: [{ name: "Header", first: "Dialog" }],
  },
  {
    name: "rejects a local component on a quoted static property",
    code: `
      function Dialog() { return <dialog />; }
      Dialog["Header"] = () => <header />;
    `,
    expected: [{ name: "Header", first: "Dialog" }],
  },
  {
    name: "recognizes wrapped components on static properties",
    code: `
      function Dialog() { return <dialog />; }
      Dialog.Body = React.memo(() => <main />);
    `,
    expected: [{ name: "Body", first: "Dialog" }],
  },
  {
    name: "counts createElement and JSX components together",
    code: `
      function First() { return createElement("div"); }
      function Second() { return <span />; }
    `,
    expected: [{ name: "Second", first: "First" }],
  },
  {
    name: "reports every component after the first in source order",
    code: `
      function First() { return <div />; }
      const Second = () => <span />;
      class Third extends React.PureComponent { render() { return <p />; } }
    `,
    expected: [
      { name: "Second", first: "First" },
      { name: "Third", first: "First" },
    ],
  },
];

for (const fixture of invalidCases) {
  test(fixture.name, () => {
    const result = messages(fixture.code);
    assert.deepEqual(
      result.map(({ messageId, message }) => ({ messageId, message })),
      fixture.expected.map(({ name, first }) => ({
        messageId: "extraComponent",
        message: `Move ${name} to its own file. ${first} is already the component owned by this module.`,
      })),
    );
  });
}

test("reports complete diagnostics in component source order", () => {
  const result = messages(`function First() { return <div />; }\nconst Second = React.memo(() => <span />);\nclass Third extends React.PureComponent { render() { return <p />; } }`);

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
        ruleId: "test/one-react-component-per-file",
        severity: 2,
        messageId: "extraComponent",
        message:
          "Move Second to its own file. First is already the component owned by this module.",
        line: 2,
        column: 7,
        endLine: 2,
        endColumn: 42,
      },
      {
        ruleId: "test/one-react-component-per-file",
        severity: 2,
        messageId: "extraComponent",
        message:
          "Move Third to its own file. First is already the component owned by this module.",
        line: 3,
        column: 1,
        endLine: 3,
        endColumn: 71,
      },
    ],
  );
});

for (const fixture of [
  {
    name: "an anonymous default arrow export",
    first: `export default () => <main />;`,
  },
  {
    name: "an anonymous default memo export",
    first: `export default memo(() => <main />);`,
  },
]) {
  test(`counts ${fixture.name} as a component declaration`, () => {
    const result = messages(
      `${fixture.first}\nexport function Second() { return <aside />; }`,
    );

    assert.equal(result.length, 1);
    assert.equal(result[0].messageId, "extraComponent");
    assert.equal(result[0].line, 2);
  });
}

test("counts class expressions as component declarations", () => {
  const result = messages(`
    const First = class extends React.Component {
      render() { return <main />; }
    };
    function Second() { return <aside />; }
  `);

  assert.equal(result.length, 1);
  assert.equal(result[0].messageId, "extraComponent");
  assert.match(result[0].message, /First is already the component/);
});

test("recognizes statically computed React wrappers", () => {
  const result = messages(`
    const First = React["memo"](() => <main />);
    const Second = React[\`forwardRef\`]((props, ref) => <aside ref={ref} />);
  `);

  assert.equal(result.length, 1);
  assert.equal(result[0].messageId, "extraComponent");
  assert.equal(
    result[0].message,
    "Move Second to its own file. First is already the component owned by this module.",
  );
});

test("ignores lookalike wrapper methods on unrelated objects", () => {
  assert.deepEqual(
    messages(`
      const CachedValue = cache.memo(() => <main />);
      function AccountCard() { return <article />; }
    `),
    [],
  );
});
