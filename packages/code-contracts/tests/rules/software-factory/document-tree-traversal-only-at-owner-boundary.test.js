import assert from "node:assert/strict";
import test from "node:test";
import { softwareFactoryRules } from "../../../src/index.js";
import { lintRule } from "../../lint-rule.js";

const ruleName =
  "software-factory/document-tree-traversal-only-at-owner-boundary";
const treeUtilsImport =
  'import { findDocumentNodePath } from "@/lib/document_navigator/utils/treeUtils";';
const consumerFilename =
  "frontend/src/app/requirements/components/navigator/RequirementsNavigatorRow.tsx";

function messages(code, filename = consumerFilename) {
  return lintRule({
    ruleName,
    rule: softwareFactoryRules[ruleName],
    code,
    filename,
  });
}

const validCases = [
  {
    name: "accepts owner-provided map lookups",
    code: `const parent = nodesById.get(parentId);`,
  },
  {
    name: "accepts owner-provided derived paths",
    code: `renderBreadcrumbs(pathsByNodeId.get(nodeId) ?? []);`,
  },
  {
    name: "accepts direct child access without whole-tree traversal",
    code: `const child = node.children.find((item) => item.id === childId);`,
  },
  {
    name: "ignores unrelated generic-tree traversal",
    code: `const result = flattenSyntaxTree(ast);`,
  },
  {
    name: "ignores file-tree traversal",
    code: `const path = findFileTreeAncestor(files, activeFileId);`,
  },
  {
    name: "ignores DOM-node traversal",
    code: `const parent = findParentNode(selection);`,
  },
  {
    name: "ignores a lookalike traversal imported from another module",
    code: `import { findDocumentNodePath } from "@acme/document-tree";
      findDocumentNodePath(tree, predicate);`,
  },
  {
    name: "ignores a shadowed canonical import",
    code: `${treeUtilsImport}
      function render(findDocumentNodePath: (value: string) => string) {
        return findDocumentNodePath("value");
      }`,
  },
  {
    name: "ignores type-only imports",
    code: `import type { findDocumentNodePath } from "@/lib/document_navigator/utils/treeUtils";`,
  },
  {
    name: "accepts sanctioned document-tree mutation APIs",
    code: `import { moveNodeInTree } from "@/lib/document_navigator/utils/treeUtils";
      const next = moveNodeInTree({ nodes, nodeId, newParentId });`,
  },
  {
    name: "accepts O(1) methods on a visibly named document-tree index",
    code: `const node = documentTreeIndex.get(nodeId);`,
  },
  {
    name: "does not classify an untyped generic findNodePath helper",
    code: `function findNodePath(nodes, id) { return nodes[id]; }`,
  },
  {
    name: "ignores a traversal alias after it is reassigned",
    code: `${treeUtilsImport}
      let lookupPath = findDocumentNodePath;
      lookupPath = localLookup;
      lookupPath(tree, predicate);`,
  },
  {
    name: "ignores a namespace alias after it is reassigned",
    code: `import * as DocumentNavigator from "@/lib/document_navigator/utils/treeUtils";
      let treeUtilities = DocumentNavigator;
      treeUtilities = localUtilities;
      treeUtilities.findDocumentNodePath(tree, predicate);`,
  },
];

for (const fixture of validCases) {
  test(fixture.name, () => {
    assert.deepEqual(messages(fixture.code, fixture.filename), []);
  });
}

const ownerFiles = [
  "frontend/src/app/blueprints/hooks/api/node/mutation/useBlueprintNodeMoveMutation.ts",
  "frontend/src/app/blueprints/utils/blueprint-tree-utils.ts",
  "frontend/src/app/blueprints/utils/findFirstBlueprintDocumentId.ts",
  "frontend/src/app/common/document-tree/components/UnifiedTreeSection.tsx",
  "frontend/src/app/common/document-tree/util/build-document-tree-index.ts",
  "frontend/src/app/requirements/utils/findFirstDocumentId.ts",
  "frontend/src/lib/document_navigator/DocumentNavigatorTree.tsx",
  "frontend/src/lib/document_navigator/__tests__/treeUtils.test.ts",
  "frontend/src/lib/document_navigator/utils/treeUtils.ts",
];

for (const filename of ownerFiles) {
  test(`accepts document-tree traversal in approved owner ${filename}`, () => {
    assert.deepEqual(
      messages(
        `${treeUtilsImport}
         findDocumentNodePath(tree, predicate);`,
        filename,
      ),
      [],
    );
  });
}

test("normalizes Windows paths when matching an approved owner", () => {
  assert.deepEqual(
    messages(
      `${treeUtilsImport}
       findDocumentNodePath(tree, predicate);`,
      "C:\\repo\\frontend\\src\\lib\\document_navigator\\DocumentNavigatorTree.tsx",
    ),
    [],
  );
});

const invalidCases = [
  {
    name: "rejects findDocumentNodePath from the canonical utility module",
    code: `${treeUtilsImport}
      findDocumentNodePath(tree, predicate);`,
  },
  {
    name: "rejects findFirstDocumentIdInTree",
    code: `import { findFirstDocumentIdInTree } from "@/lib/document_navigator/utils/treeUtils";
      findFirstDocumentIdInTree(tree, getDocumentId);`,
  },
  {
    name: "rejects isNodeInTree",
    code: `import { isNodeInTree } from "@/lib/document_navigator/utils/treeUtils";
      isNodeInTree(tree, nodeId);`,
  },
  {
    name: "rejects treeContainsDocumentId",
    code: `import { treeContainsDocumentId } from "@/lib/document_navigator/utils/treeUtils";
      treeContainsDocumentId(tree, getDocumentId, documentId);`,
  },
  {
    name: "rejects traversal imported from the document-navigator barrel",
    code: `import { findDocumentNodePath } from "@/lib/document_navigator";
      findDocumentNodePath(tree, predicate);`,
  },
  {
    name: "rejects an aliased traversal import",
    code: `import { findDocumentNodePath as findPath } from "@/lib/document_navigator/utils/treeUtils";
      findPath(tree, predicate);`,
  },
  {
    name: "rejects a traversal binding alias",
    code: `${treeUtilsImport}
      const lookupPath = findDocumentNodePath;
      lookupPath(tree, predicate);`,
  },
  {
    name: "rejects namespace traversal",
    code: `import * as DocumentNavigator from "@/lib/document_navigator/utils/treeUtils";
      DocumentNavigator.findDocumentNodePath(tree, predicate);`,
  },
  {
    name: "rejects static computed namespace traversal",
    code: `import * as DocumentNavigator from "@/lib/document_navigator/utils/treeUtils";
      DocumentNavigator["findDocumentNodePath"](tree, predicate);`,
  },
  {
    name: "rejects traversal through a namespace alias",
    code: `import * as DocumentNavigator from "@/lib/document_navigator/utils/treeUtils";
      const treeUtilities = DocumentNavigator;
      treeUtilities.findDocumentNodePath(tree, predicate);`,
  },
  {
    name: "rejects an extracted namespace traversal",
    code: `import * as DocumentNavigator from "@/lib/document_navigator/utils/treeUtils";
      const lookupPath = DocumentNavigator.findDocumentNodePath;
      lookupPath(tree, predicate);`,
  },
  {
    name: "rejects a destructured namespace traversal",
    code: `import * as DocumentNavigator from "@/lib/document_navigator/utils/treeUtils";
      const { findDocumentNodePath: lookupPath } = DocumentNavigator;
      lookupPath(tree, predicate);`,
  },
  {
    name: "rejects a defaulted destructured namespace traversal",
    code: `import * as DocumentNavigator from "@/lib/document_navigator/utils/treeUtils";
      const { findDocumentNodePath: lookupPath = fallback } = DocumentNavigator;
      lookupPath(tree, predicate);`,
  },
  {
    name: "rejects a static template-literal namespace traversal",
    code: `import * as DocumentNavigator from "@/lib/document_navigator/utils/treeUtils";
      DocumentNavigator[\`findDocumentNodePath\`](tree, predicate);`,
  },
  {
    name: "rejects traversal through TypeScript-wrapped namespaces and callees",
    code: `import * as DocumentNavigator from "@/lib/document_navigator/utils/treeUtils";
      ((DocumentNavigator as typeof DocumentNavigator).findDocumentNodePath as Function)(tree, predicate);`,
  },
  {
    name: "rejects a dynamic document-tree namespace call",
    code: `import * as DocumentNavigator from "@/lib/document_navigator/utils/treeUtils";
      DocumentNavigator[operation](tree, predicate);`,
  },
  {
    name: "rejects indirect traversal through call",
    code: `${treeUtilsImport}
      findDocumentNodePath.call(null, tree, predicate);`,
  },
  {
    name: "rejects indirect traversal through a namespace method",
    code: `import * as DocumentNavigator from "@/lib/document_navigator/utils/treeUtils";
      DocumentNavigator.findDocumentNodePath.apply(null, [tree, predicate]);`,
  },
  {
    name: "rejects an unbound canonical traversal call",
    code: `findDocumentNodePath(tree, predicate);`,
  },
  {
    name: "rejects a local canonical traversal implementation",
    code: `function findDocumentNodePath(nodes, predicate) { return null; }`,
  },
  {
    name: "rejects a plainly named local document-tree traversal",
    code: `const flattenDocumentTree = (nodes) => nodes.flatMap((node) => [node]);`,
  },
  {
    name: "rejects a typed traversal whose shorter name omits document",
    code: `function findNodePath(nodes: DocumentTreeNodeInterface[]): string[] { return []; }`,
  },
  {
    name: "rejects traversal methods on a document-tree object",
    code: `const path = documentTree.findPath(nodeId);`,
  },
  {
    name: "rejects traversal in test files without a blanket exemption",
    code: `${treeUtilsImport}
      findDocumentNodePath(tree, predicate);`,
    filename: "frontend/src/app/documents/DocumentRow.test.tsx",
  },
  {
    name: "rejects traversal in story files without a blanket exemption",
    code: `${treeUtilsImport}
      findDocumentNodePath(tree, predicate);`,
    filename: "frontend/src/app/documents/DocumentRow.story.tsx",
  },
  {
    name: "rejects traversal in generated files without a blanket exemption",
    code: `${treeUtilsImport}
      findDocumentNodePath(tree, predicate);`,
    filename: "frontend/src/app/documents/DocumentRow.generated.tsx",
  },
];

for (const fixture of invalidCases) {
  test(fixture.name, () => {
    const result = messages(fixture.code, fixture.filename);
    assert.equal(result.length, 1);
    assert.equal(result[0].ruleId, `test/${ruleName}`);
    assert.equal(result[0].severity, 2);
    assert.equal(result[0].messageId, "traversal");
    assert.match(result[0].message, /document tree/);
  });
}

test("reports an imported traversal before but not after alias reassignment", () => {
  const result = messages(`${treeUtilsImport}
    let lookupPath = findDocumentNodePath;
    lookupPath(tree, firstPredicate);
    lookupPath = localLookup;
    lookupPath(tree, secondPredicate);`);

  assert.equal(result.length, 1);
  assert.equal(result[0].line, 3);
  assert.match(result[0].message, /^findDocumentNodePath traverses/);
});

test("reports a namespace traversal before but not after alias reassignment", () => {
  const result = messages(`
    import * as DocumentNavigator from "@/lib/document_navigator/utils/treeUtils";
    let treeUtilities = DocumentNavigator;
    treeUtilities.findDocumentNodePath(tree, firstPredicate);
    treeUtilities = localUtilities;
    treeUtilities.findDocumentNodePath(tree, secondPredicate);
  `);

  assert.equal(result.length, 1);
  assert.equal(result[0].line, 4);
  assert.match(result[0].message, /^findDocumentNodePath traverses/);
});

test("reports multiple forbidden traversals in source order", () => {
  const result = messages(`
    import {
      findDocumentNodePath,
      treeContainsDocumentId,
    } from "@/lib/document_navigator/utils/treeUtils";
    findDocumentNodePath(tree, predicate);
    treeContainsDocumentId(tree, getDocumentId, documentId);
  `);

  assert.deepEqual(
    result.map(({ messageId, line, column }) => ({ messageId, line, column })),
    [
      { messageId: "traversal", line: 6, column: 5 },
      { messageId: "traversal", line: 7, column: 5 },
    ],
  );
  assert.match(result[0].message, /^findDocumentNodePath traverses/);
  assert.match(result[1].message, /^treeContainsDocumentId traverses/);
});
