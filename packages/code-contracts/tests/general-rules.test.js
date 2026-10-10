import assert from "node:assert/strict";
import test from "node:test";
import { generalRules } from "../src/index.js";
import { lintRule } from "./lint-rule.js";

function messages(ruleName, code, filename) {
  return lintRule({
    ruleName,
    rule: generalRules[ruleName],
    code,
    filename,
  });
}

test("one-react-component-per-file allows one component", () => {
  assert.equal(
    messages(
      "one-react-component-per-file",
      `export function AccountCard() { return <article />; }`,
    ).length,
    0,
  );
});

test("one-react-component-per-file rejects a second component", () => {
  const result = messages(
    "one-react-component-per-file",
    `
      export function AccountCard() { return <article />; }
      function AccountMenu() { return <nav />; }
    `,
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].messageId, "extraComponent");
});

test("dedicated-props-interface accepts a matching same-file interface", () => {
  assert.equal(
    messages(
      "dedicated-props-interface",
      `
        interface AccountCardProps { name: string }
        export function AccountCard({ name }: AccountCardProps) {
          return <article>{name}</article>;
        }
      `,
    ).length,
    0,
  );
});

test("dedicated-props-interface rejects inline prop types", () => {
  const result = messages(
    "dedicated-props-interface",
    `export const AccountCard = ({ name }: { name: string }) => <article>{name}</article>;`,
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].messageId, "missing");
});

test("closed-domain-values-use-enum accepts open strings and enums", () => {
  assert.equal(
    messages(
      "closed-domain-values-use-enum",
      `
        enum ViewMode { Grid = "grid", List = "list" }
        const title = "Projects";
        const isGrid = mode === ViewMode.Grid;
      `,
    ).length,
    0,
  );
});

test("closed-domain-values-use-enum rejects string unions and loose branch vocabularies", () => {
  const result = messages(
    "closed-domain-values-use-enum",
    `
      type ViewMode = "grid" | "list";
      const compact = mode === "grid" || mode === "list";
    `,
  );
  assert.deepEqual(
    result.map((message) => message.messageId).sort(),
    ["branch", "union"],
  );
});

test("explicit-react-hook-generics accepts explicit type arguments", () => {
  assert.equal(
    messages(
      "explicit-react-hook-generics",
      `
        import { useRef, useState } from "react";
        const [count] = useState<number>(0);
        const ref = useRef<HTMLDivElement>(null);
      `,
    ).length,
    0,
  );
});

test("explicit-react-hook-generics rejects inferred stateful primitives", () => {
  const result = messages(
    "explicit-react-hook-generics",
    `
      import React, { useState } from "react";
      const [count] = useState(0);
      const ref = React.useRef(null);
    `,
  );
  assert.equal(result.length, 2);
  assert.ok(result.every((message) => message.messageId === "missing"));
});

test("explicit-handler-signatures accepts direct callback contracts", () => {
  assert.equal(
    messages(
      "explicit-handler-signatures",
      `interface FormProps { onSave: (value: string) => Promise<void> }`,
    ).length,
    0,
  );
});

test("explicit-handler-signatures rejects borrowed handler contracts", () => {
  const result = messages(
    "explicit-handler-signatures",
    `
      interface FormProps { onSave: DialogProps["onSave"] }
      const handleSave: Parameters<typeof save>[0] = (value) => value;
    `,
  );
  assert.equal(result.length, 2);
  assert.deepEqual(
    result.map((message) => message.messageId),
    ["hidden", "hidden"],
  );
});

test("no-inline-behavior-handlers allows trivial local UI setters", () => {
  assert.equal(
    messages(
      "no-inline-behavior-handlers",
      `const button = <button onClick={() => setOpen(true)}>Open</button>;`,
    ).length,
    0,
  );
});

test("no-inline-behavior-handlers rejects hidden navigation and multi-step behavior", () => {
  const result = messages(
    "no-inline-behavior-handlers",
    `
      const first = <button onClick={() => navigate("/projects")}>Go</button>;
      const second = <button onClick={() => { saveDraft(); closeDialog(); }}>Save</button>;
    `,
  );
  assert.equal(result.length, 2);
  assert.ok(result.every((message) => message.messageId === "name"));
});

test("no-mirrored-derived-state allows external synchronization", () => {
  assert.equal(
    messages(
      "no-mirrored-derived-state",
      `
        import { useEffect, useState } from "react";
        const [width, setWidth] = useState<number>(0);
        useEffect(() => setWidth(window.innerWidth), []);
      `,
    ).length,
    0,
  );
});

test("no-mirrored-derived-state rejects effects that copy pure derived values", () => {
  const result = messages(
    "no-mirrored-derived-state",
    `
      import { useEffect, useState } from "react";
      const [fullName, setFullName] = useState<string>("");
      useEffect(() => { setFullName(firstName + " " + lastName); }, [firstName, lastName]);
    `,
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].messageId, "derived");
});

test("no-redundant-nullable-optionals accepts one absence representation", () => {
  assert.equal(
    messages(
      "no-redundant-nullable-optionals",
      `interface Selection { selectedId?: string; parentId: string | null }`,
    ).length,
    0,
  );
});

test("no-redundant-nullable-optionals rejects optional nullable properties", () => {
  const result = messages(
    "no-redundant-nullable-optionals",
    `interface Selection { selectedId?: string | null }`,
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].messageId, "duplicateAbsence");
});

test("query-keys-from-factories accepts factory keys", () => {
  assert.equal(
    messages(
      "query-keys-from-factories",
      `useQuery({ queryKey: projectQueryKeys.detail(projectId), queryFn });`,
    ).length,
    0,
  );
});

test("query-keys-from-factories rejects inline keys in queries and invalidations", () => {
  const result = messages(
    "query-keys-from-factories",
    `
      useQuery({ queryKey: ["project", projectId], queryFn });
      queryClient.invalidateQueries({ queryKey: ["project"] });
    `,
  );
  assert.equal(result.length, 2);
  assert.ok(result.every((message) => message.messageId === "factory"));
});
