import assert from "node:assert/strict";
import test from "node:test";
import { softwareFactoryRules } from "../src/index.js";
import { lintRule } from "./lint-rule.js";

function messages(ruleName, code, filename) {
  return lintRule({
    ruleName,
    rule: softwareFactoryRules[ruleName],
    code,
    filename,
  });
}

test("api-calls-through-api-hooks permits the API-hook boundary", () => {
  assert.equal(
    messages(
      "software-factory/api-calls-through-api-hooks",
      `export const useGetProject = () => useV2Api();`,
      "frontend/src/app/projects/hooks/api/useGetProject.ts",
    ).length,
    0,
  );
});

test("api-calls-through-api-hooks rejects transport calls in domain components", () => {
  const result = messages(
    "software-factory/api-calls-through-api-hooks",
    `export function ProjectPanel() { const api = useV2Api(); return fetch("/projects"); }`,
    "frontend/src/app/projects/components/ProjectPanel.tsx",
  );
  assert.equal(result.length, 2);
  assert.ok(result.every((message) => message.messageId === "boundary"));
});

test("document-tree traversal permits owner-provided index lookups", () => {
  assert.equal(
    messages(
      "software-factory/document-tree-traversal-only-at-owner-boundary",
      `const parent = nodesById.get(parentId);`,
      "frontend/src/app/documents/components/navigator/DocumentRow.tsx",
    ).length,
    0,
  );
});

test("document-tree traversal rejects lookup outside the owner boundary", () => {
  const result = messages(
    "software-factory/document-tree-traversal-only-at-owner-boundary",
    `import { findDocumentNodePath } from "@/lib/document_navigator/utils/treeUtils";
     const path = findDocumentNodePath(tree, (node) => node.id === nodeId);`,
    "frontend/src/app/documents/components/navigator/DocumentRow.tsx",
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].messageId, "traversal");
});
