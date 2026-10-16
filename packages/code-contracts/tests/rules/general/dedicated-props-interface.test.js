import assert from "node:assert/strict";
import test from "node:test";
import { generalRules } from "../../../src/index.js";
import { lintRule } from "../../lint-rule.js";

const ruleName = "dedicated-props-interface";

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
    name: "accepts a discriminated union intersected with common props",
    code: `
      interface BaseProps { title: string }
      type PreviewProps = BaseProps & (
        | { isPreviewUrlUnavailable: false; src: string }
        | { isPreviewUrlUnavailable: true; src?: never }
      );
      export function Preview(props: PreviewProps) {
        return <div>{props.isPreviewUrlUnavailable ? props.title : props.src}</div>;
      }
    `,
  },
  {
    name: "accepts a discriminated union of interface alternatives",
    code: `
      interface Available { unavailable: false; src: string }
      interface Unavailable { unavailable: true; src?: never }
      type PreviewProps = Available | Unavailable;
      export function Preview(props: PreviewProps) { return <div>{props.src}</div>; }
    `,
  },
  {
    name: "accepts an exported generic alias declared after the component",
    code: `
      export function List<T>({ items }: ListProps<T>) { return <div>{items.length}</div>; }
      export type ListProps<T> = { items: T[] };
    `,
  },
  {
    name: "accepts a dedicated alias of an imported shared contract",
    code: `
      import type { SharedProps } from "./types";
      type CardProps = SharedProps;
      export function Card(props: CardProps) { return <div>{props.label}</div>; }
    `,
  },
  {
    name: "accepts a dedicated alias of utility-derived props",
    code: `
      type CardProps = React.ComponentProps<"div">;
      export function Card(props: CardProps) { return <div {...props} />; }
    `,
  },
  {
    name: "accepts React.FC with a matching alias",
    code: `
      type CardProps = { label: string };
      export const Card: React.FC<CardProps> = ({ label }) => <div>{label}</div>;
    `,
  },
  {
    name: "accepts memo around forwardRef with a matching alias",
    code: `
      import { memo as stableMemo, forwardRef as withRef } from "react";
      type InputProps = { value: string };
      export const Input = stableMemo(withRef<HTMLInputElement, InputProps>(
        ({ value }, ref) => <input ref={ref} value={value} />,
      ));
    `,
  },
  {
    name: "accepts a class component with a matching alias",
    code: `
      type CardProps = { label: string };
      export class Card extends React.Component<CardProps> {
        render() { return <div>{this.props.label}</div>; }
      }
    `,
  },
  {
    name: "accepts memo using a type alias",
    code: `
      type CardProps = { label: string };
      export const Card = memo(({ label }: CardProps) => <div>{label}</div>);
    `,
  },
  {
    name: "accepts a same-file named type alias",
    code: `
      type CardProps = { label: string };
      export const Card = ({ label }: CardProps) => <div>{label}</div>;
    `,
  },
  {
    name: "accepts a same-file named interface",
    code: `
      interface AccountCardProps { name: string }
      export function AccountCard({ name }: AccountCardProps) { return <div>{name}</div>; }
    `,
  },
  {
    name: "accepts an exported props interface",
    code: `
      export interface AccountCardProps { name: string }
      export function AccountCard({ name }: AccountCardProps) { return <div>{name}</div>; }
    `,
  },
  {
    name: "accepts a props interface declared after the component",
    code: `
      export function AccountCard({ name }: AccountCardProps) { return <div>{name}</div>; }
      interface AccountCardProps { name: string }
    `,
  },
  {
    name: "accepts a function expression with a matching interface",
    code: `
      interface AccountCardProps { name: string }
      export const AccountCard = function ({ name }: AccountCardProps) {
        return <div>{name}</div>;
      };
    `,
  },
  {
    name: "accepts a TypeScript-wrapped component with a matching interface",
    code: `
      interface AccountCardProps { name: string }
      export const AccountCard = (({ name }: AccountCardProps) => (
        <div>{name}</div>
      )) satisfies React.FC<AccountCardProps>;
    `,
  },
  {
    name: "accepts a defaulted parameter with a matching interface",
    code: `
      interface AccountCardProps { name: string }
      export function AccountCard(
        { name }: AccountCardProps = { name: "Anonymous" },
      ) {
        return <div>{name}</div>;
      }
    `,
  },
  {
    name: "accepts a named default-exported function",
    code: `
      interface AccountCardProps { name: string }
      export default function AccountCard({ name }: AccountCardProps) {
        return <div>{name}</div>;
      }
    `,
  },
  {
    name: "allows a component with no props",
    code: `export function AccountCard() { return <div />; }`,
  },
  {
    name: "ignores a PascalCase function that does not render",
    code: `export function BuildAccount(name: string) { return name.toUpperCase(); }`,
  },
  {
    name: "accepts a generic props interface",
    code: `
      interface ListProps<T> { items: T[] }
      export function List<T>({ items }: ListProps<T>) { return <div>{items.length}</div>; }
    `,
  },
  {
    name: "accepts an interface extending a platform contract",
    code: `
      interface SaveButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> { busy: boolean }
      export function SaveButton(props: SaveButtonProps) { return <button {...props} />; }
    `,
  },
  {
    name: "accepts React.FC with a matching interface",
    code: `
      interface AccountCardProps { name: string }
      export const AccountCard: React.FC<AccountCardProps> = ({ name }) => <div>{name}</div>;
    `,
  },
  {
    name: "accepts React.FC props without a parameter when the interface is dedicated",
    code: `
      interface AccountCardProps { name: string }
      export const AccountCard: React.FC<AccountCardProps> = () => <div />;
    `,
  },
  {
    name: "accepts React.FunctionComponent with a matching interface",
    code: `
      interface AccountCardProps { name: string }
      export const AccountCard: React.FunctionComponent<AccountCardProps> = ({ name }) => (
        <div>{name}</div>
      );
    `,
  },
  {
    name: "accepts an unqualified FC with a matching interface",
    code: `
      interface AccountCardProps { name: string }
      export const AccountCard: FC<AccountCardProps> = ({ name }) => <div>{name}</div>;
    `,
  },
  {
    name: "accepts memo with a matching parameter interface",
    code: `
      interface AccountCardProps { name: string }
      export const AccountCard = React.memo(
        ({ name }: AccountCardProps) => <div>{name}</div>,
      );
    `,
  },
  {
    name: "accepts statically aliased memo and forwardRef wrappers",
    code: `
      import React, {
        forwardRef as withRef,
        memo as stableMemo,
      } from "react";
      interface SearchInputProps { query: string }
      const memoAlias = stableMemo;
      const refAlias = React.forwardRef;
      export const SearchInput = memoAlias(refAlias<HTMLInputElement, SearchInputProps>(
        ({ query }, ref) => <input ref={ref} value={query} />,
      ));
      interface LabelProps { text: string }
      export const Label = stableMemo(
        ({ text }: LabelProps) => <span>{text}</span>,
      );
      void withRef;
    `,
  },
  {
    name: "accepts an exported static memo alias and generic props without a parameter",
    code: `
      import React from "react";
      export const stableMemo = React.memo;
      interface CardProps { label: string }
      export const Card = stableMemo<CardProps>(() => <div />);
    `,
  },
  {
    name: "accepts forwardRef with a matching interface",
    code: `
      interface SearchInputProps { query: string }
      export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
        ({ query }, ref) => <input ref={ref} value={query} />,
      );
    `,
  },
  {
    name: "accepts forwardRef props typed directly on the parameter",
    code: `
      interface SearchInputProps { query: string }
      export const SearchInput = forwardRef(
        ({ query }: SearchInputProps, ref) => <input ref={ref} value={query} />,
      );
    `,
  },
  {
    name: "accepts qualified forwardRef with a matching interface",
    code: `
      interface SearchInputProps { query: string }
      export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
        ({ query }, ref) => <input ref={ref} value={query} />,
      );
    `,
  },
  {
    name: "accepts memo around a typed forwardRef",
    code: `
      interface SearchInputProps { query: string }
      export const SearchInput = memo(forwardRef<HTMLInputElement, SearchInputProps>(
        ({ query }, ref) => <input ref={ref} value={query} />,
      ));
    `,
  },
  {
    name: "accepts a class component with a matching interface",
    code: `
      interface AccountCardProps { name: string }
      export class AccountCard extends React.Component<AccountCardProps> {
        render() { return <div>{this.props.name}</div>; }
      }
    `,
  },
  {
    name: "accepts a pure class component with a matching interface",
    code: `
      interface AccountCardProps { name: string }
      export class AccountCard extends React.PureComponent<AccountCardProps> {
        render() { return <div>{this.props.name}</div>; }
      }
    `,
  },
  {
    name: "accepts a named default-exported class",
    code: `
      interface AccountCardProps { name: string }
      export default class AccountCard extends Component<AccountCardProps> {
        render() { return <div>{this.props.name}</div>; }
      }
    `,
  },
  {
    name: "accepts a createElement component with a matching interface",
    code: `
      interface AccountCardProps { name: string }
      export function AccountCard({ name }: AccountCardProps) {
        return React.createElement("div", null, name);
      }
    `,
  },
];

for (const fixture of validCases) {
  test(fixture.name, () => {
    assert.deepEqual(messages(fixture.code), []);
  });
}

test("exempts test, spec, story, and stories files", () => {
  for (const filename of [
    "Card.test.tsx",
    "Card.spec.tsx",
    "Card.story.tsx",
    "Card.stories.tsx",
    "src/__tests__/Card.tsx",
    "src/__stories__/Card.tsx",
    "C:\\src\\__tests__\\Card.tsx",
  ]) {
    assert.deepEqual(
      messages(
        `export const Card = ({ label }: { label: string }) => <div>{label}</div>;`,
        filename,
      ),
      [],
    );
  }
});

const invalidCases = [
  {
    name: "rejects a borrowed alias even when a dedicated alias exists",
    code: `
      type SharedProps = { label: string };
      type CardProps = SharedProps;
      export function Card(props: SharedProps) { return <div>{props.label}</div>; }
    `,
  },
  {
    name: "rejects inline object props",
    code: `export const Card = ({ label }: { label: string }) => <div>{label}</div>;`,
  },
  {
    name: "rejects a borrowed props interface",
    code: `
      interface SharedProps { label: string }
      export const Card = ({ label }: SharedProps) => <div>{label}</div>;
    `,
  },
  {
    name: "rejects borrowed props even when the matching interface also exists",
    code: `
      interface CardProps { label: string }
      interface SharedProps { label: string }
      export const Card = ({ label }: SharedProps) => <div>{label}</div>;
    `,
  },
  {
    name: "rejects an untyped props parameter",
    code: `export const Card = (props) => <div>{props.label}</div>;`,
  },
  {
    name: "rejects an imported matching props contract",
    code: `
      import type { CardProps } from "./types";
      export const Card = ({ label }: CardProps) => <div>{label}</div>;
    `,
  },
  {
    name: "rejects utility-derived props",
    code: `
      export const Card = (props: React.ComponentProps<"div">) => <div {...props} />;
    `,
  },
  {
    name: "rejects React.FC using the wrong interface",
    code: `
      interface SharedProps { label: string }
      export const Card: React.FC<SharedProps> = ({ label }) => <div>{label}</div>;
    `,
  },
  {
    name: "rejects zero-parameter React.FC components with inline props",
    code: `export const Card: React.FC<{ label: string }> = () => <div />;`,
  },
  {
    name: "rejects zero-parameter memo components with inline generic props",
    code: `export const Card = memo<{ label: string }>(() => <div />);`,
  },
  {
    name: "rejects a mismatched parameter even when React.FC names the expected interface",
    code: `
      interface CardProps { label: string }
      interface SharedProps { label: string }
      export const Card: React.FC<CardProps> = ({ label }: SharedProps) => (
        <div>{label}</div>
      );
    `,
  },
  {
    name: "rejects React.FunctionComponent without a props type",
    code: `
      interface CardProps { label: string }
      export const Card: React.FunctionComponent = ({ label }) => <div>{label}</div>;
    `,
  },
  {
    name: "rejects inline props behind aliased memo and forwardRef wrappers",
    code: `
      import React, { forwardRef as withRef, memo as stableMemo } from "react";
      const memoAlias = stableMemo;
      const refAlias = React.forwardRef;
      export const Card = memoAlias(
        (props: { label: string }) => <div>{props.label}</div>,
      );
      export const Input = stableMemo(withRef<HTMLInputElement, { value: string }>(
        ({ value }, ref) => <input ref={ref} value={value} />,
      ));
      void refAlias;
    `,
    messageCount: 2,
  },
  {
    name: "rejects forwardRef using the wrong interface",
    code: `
      interface SharedProps { label: string }
      export const Card = forwardRef<HTMLDivElement, SharedProps>(
        ({ label }, ref) => <div ref={ref}>{label}</div>,
      );
    `,
  },
  {
    name: "rejects mismatched forwardRef parameter and generic contracts",
    code: `
      interface SearchInputProps { query: string }
      interface SharedProps { query: string }
      export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
        ({ query }: SharedProps, ref) => <input ref={ref} value={query} />,
      );
    `,
  },
  {
    name: "rejects a class using the wrong interface",
    code: `
      interface SharedProps { label: string }
      export class Card extends React.Component<SharedProps> {
        render() { return <div>{this.props.label}</div>; }
      }
    `,
  },
  {
    name: "rejects a pure class using an inline props type",
    code: `
      export class Card extends React.PureComponent<{ label: string }> {
        render() { return <div>{this.props.label}</div>; }
      }
    `,
  },
];

for (const fixture of invalidCases) {
  test(fixture.name, () => {
    const result = messages(fixture.code);
    assert.equal(result.length, fixture.messageCount ?? 1);
    assert.ok(result.every((message) => message.messageId === "missing"));
  });
}

test("checks every component in a multi-declarator statement", () => {
  const result = messages(`
    const First = (props: { first: string }) => <div>{props.first}</div>,
      Second = (props: { second: string }) => <div>{props.second}</div>;
  `);
  assert.equal(result.length, 2);
  assert.ok(result.every((message) => message.messageId === "missing"));
});

test("reports multiple components in source order with their exact required names", () => {
  const result = messages(`const First = (props: { first: string }) => <div>{props.first}</div>,
  Second = (props: { second: string }) => <div>{props.second}</div>;`);

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
        message:
          "First must use a dedicated same-file interface or type alias named FirstProps for its props.",
        line: 1,
        column: 7,
      },
      {
        messageId: "missing",
        message:
          "Second must use a dedicated same-file interface or type alias named SecondProps for its props.",
        line: 2,
        column: 3,
      },
    ],
  );
});

test("reports the component and required props declaration names", () => {
  const [result] = messages(
    `export const AccountCard = ({ name }: { name: string }) => <div>{name}</div>;`,
  );
  assert.equal(
    result.message,
    "AccountCard must use a dedicated same-file interface or type alias named AccountCardProps for its props.",
  );
});

test("does not exempt filenames that only resemble test or story conventions", () => {
  for (const filename of [
    "Card.test-helper.tsx",
    "Card.stories-helper.tsx",
    "src/__tests__-helpers/Card.tsx",
    "src/component-stories/Card.tsx",
  ]) {
    const result = messages(
      `export const Card = ({ label }: { label: string }) => <div>{label}</div>;`,
      filename,
    );
    assert.equal(result.length, 1, filename);
    assert.equal(result[0].messageId, "missing", filename);
  }
});

test("does not exempt generated files", () => {
  for (const filename of [
    "Card.generated.tsx",
    "Card.gen.tsx",
    "src/generated/Card.tsx",
    "src/__generated__/Card.tsx",
  ]) {
    const result = messages(
      `export const Card = ({ label }: { label: string }) => <div>{label}</div>;`,
      filename,
    );
    assert.equal(result.length, 1, filename);
    assert.equal(result[0].messageId, "missing", filename);
  }
});
