import {
  architectureRuleMeta,
  createRule,
  getStaticPropertyName,
  unwrapExpression,
} from "../../ast.js";

const DOCUMENT_TREE_MODULES = new Set([
  "@/lib/document_navigator",
  "@/lib/document_navigator/utils/treeUtils",
]);

const DOCUMENT_TREE_TRAVERSAL_APIS = new Set([
  "findDocumentNodePath",
  "findFirstDocumentIdInTree",
  "isNodeInTree",
  "treeContainsDocumentId",
]);

const DOCUMENT_TREE_TRAVERSAL_NAME =
  /^(?:build|collect|find|flatten|index|resolve|scan|search|traverse|walk).*(?:DocumentTree|DocumentNode|DocumentPath)|^(?:build|collect|find|flatten|index|resolve|scan|search|traverse|walk)(?:DocumentTree|DocumentNode|DocumentPath).*/;

const DOCUMENT_TREE_OWNER_FILES = [
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

function normalizedFilename(filename) {
  return filename.replaceAll("\\", "/");
}

function isOwnerFile(filename) {
  const normalized = normalizedFilename(filename);
  return DOCUMENT_TREE_OWNER_FILES.some((owner) => normalized.endsWith(owner));
}

function resolveVariable(sourceCode, node) {
  let scope = sourceCode.getScope(node);
  while (scope) {
    const variable = scope.set.get(node.name);
    if (variable) return variable;
    scope = scope.upper;
  }
  return null;
}

function isBindingUnchangedAt(variable, node) {
  return !variable.references.some(
    (reference) =>
      reference.isWrite() &&
      reference.init !== true &&
      reference.identifier.range[0] < node.range[0],
  );
}

function staticKeyName(node, computed) {
  const key = unwrapExpression(node);
  if (!computed && key?.type === "Identifier") return key.name;
  if (key?.type === "Literal") return String(key.value);
  if (key?.type === "TemplateLiteral" && key.expressions.length === 0) {
    return key.quasis[0]?.value.cooked ?? key.quasis[0]?.value.raw ?? null;
  }
  return null;
}

function declaredFunction(node) {
  const initializer = unwrapExpression(node);
  if (
    initializer?.type === "ArrowFunctionExpression" ||
    initializer?.type === "FunctionExpression"
  ) {
    return initializer;
  }
  return null;
}

function patternIdentifier(node) {
  if (node?.type === "Identifier") return node;
  if (node?.type === "AssignmentPattern" && node.left.type === "Identifier") {
    return node.left;
  }
  return null;
}

export default createRule(
  {
    ...architectureRuleMeta,
    docs: {
      ...architectureRuleMeta.docs,
      description:
        "Confine Software Factory document-tree traversal to approved owner modules.",
    },
    messages: {
      traversal:
        "{{name}} traverses the document tree outside an approved owner module. Build the document-tree index once at the owner boundary and pass an O(1) lookup or derived result downstream.",
    },
  },
  (context) => {
    if (isOwnerFile(context.filename)) return {};

    const sourceCode = context.sourceCode;
    const traversalByIdentifier = new Map();
    const namespaceIdentifiers = new Set();

    function importedTraversal(node) {
      const variable = resolveVariable(sourceCode, node);
      if (!variable || !isBindingUnchangedAt(variable, node)) return null;
      for (const identifier of variable.identifiers) {
        const traversal = traversalByIdentifier.get(identifier);
        if (traversal) return traversal;
      }
      return null;
    }

    function isDocumentTreeNamespace(node) {
      const variable = resolveVariable(sourceCode, node);
      return (
        variable &&
        isBindingUnchangedAt(variable, node) &&
        variable.identifiers.some((identifier) =>
          namespaceIdentifiers.has(identifier),
        )
      );
    }

    function namespaceTraversal(node) {
      const expression = unwrapExpression(node);
      if (expression?.type !== "MemberExpression") return null;
      const object = unwrapExpression(expression.object);
      if (object?.type !== "Identifier" || !isDocumentTreeNamespace(object)) {
        return null;
      }
      const name = staticKeyName(expression.property, expression.computed);
      if (name === null) return "dynamic document-tree namespace call";
      return DOCUMENT_TREE_TRAVERSAL_APIS.has(name) ? name : null;
    }

    function traversalForCallee(node) {
      const callee = unwrapExpression(node);
      if (callee?.type === "Identifier") {
        const imported = importedTraversal(callee);
        if (imported) return imported;
        if (
          resolveVariable(sourceCode, callee) === null &&
          DOCUMENT_TREE_TRAVERSAL_APIS.has(callee.name)
        ) {
          return callee.name;
        }
        return null;
      }

      const fromNamespace = namespaceTraversal(callee);
      if (fromNamespace) return fromNamespace;

      if (callee?.type !== "MemberExpression") return null;
      const object = unwrapExpression(callee.object);
      const property = staticKeyName(callee.property, callee.computed);
      if (new Set(["apply", "bind", "call"]).has(property)) {
        if (object?.type === "Identifier") {
          const traversal = importedTraversal(object);
          if (traversal) return traversal;
        }
        const traversal = namespaceTraversal(object);
        if (traversal) return traversal;
      }
      if (
        object?.type === "Identifier" &&
        /documentTree/i.test(object.name) &&
        /^(?:collect|find|flatten|index|resolve|scan|search|traverse|walk)/.test(
          property ?? "",
        )
      ) {
        return `${object.name}.${property}`;
      }
      return null;
    }

    function hasDocumentTreeParameter(fn) {
      return fn.params.some((parameter) => {
        const annotation =
          parameter.type === "AssignmentPattern"
            ? parameter.left.typeAnnotation
            : parameter.typeAnnotation;
        return annotation && /DocumentTree/.test(sourceCode.getText(annotation));
      });
    }

    function isLocalTraversalDefinition(name, fn) {
      return (
        DOCUMENT_TREE_TRAVERSAL_APIS.has(name) ||
        DOCUMENT_TREE_TRAVERSAL_NAME.test(name) ||
        (/^(?:collect|find|flatten|index|resolve|scan|search|traverse|walk)/.test(
          name,
        ) &&
          hasDocumentTreeParameter(fn))
      );
    }

    function reportDefinition(node, name, fn) {
      if (!isLocalTraversalDefinition(name, fn)) return;
      context.report({ node, messageId: "traversal", data: { name } });
    }

    function registerImports(program) {
      for (const statement of program.body) {
        if (
          statement.type !== "ImportDeclaration" ||
          statement.importKind === "type" ||
          !DOCUMENT_TREE_MODULES.has(statement.source.value)
        ) {
          continue;
        }

        for (const specifier of statement.specifiers) {
          if (specifier.importKind === "type") continue;
          if (specifier.type === "ImportNamespaceSpecifier") {
            namespaceIdentifiers.add(specifier.local);
            continue;
          }
          if (specifier.type !== "ImportSpecifier") continue;
          const imported = getStaticPropertyName(specifier.imported);
          if (DOCUMENT_TREE_TRAVERSAL_APIS.has(imported)) {
            traversalByIdentifier.set(specifier.local, imported);
          }
        }
      }
    }

    return {
      Program: registerImports,
      VariableDeclarator(node) {
        const initializer = unwrapExpression(node.init);
        if (node.id.type === "ObjectPattern") {
          if (
            initializer?.type !== "Identifier" ||
            !isDocumentTreeNamespace(initializer)
          ) {
            return;
          }
          for (const property of node.id.properties) {
            if (property.type !== "Property") continue;
            const imported = staticKeyName(property.key, property.computed);
            const local = patternIdentifier(property.value);
            if (DOCUMENT_TREE_TRAVERSAL_APIS.has(imported) && local) {
              traversalByIdentifier.set(local, imported);
            }
          }
          return;
        }
        if (node.id.type !== "Identifier") return;
        if (initializer?.type === "Identifier") {
          const traversal = importedTraversal(initializer);
          if (traversal) traversalByIdentifier.set(node.id, traversal);
          if (isDocumentTreeNamespace(initializer)) {
            namespaceIdentifiers.add(node.id);
          }
        } else {
          const traversal = namespaceTraversal(initializer);
          if (traversal) traversalByIdentifier.set(node.id, traversal);
        }

        const fn = declaredFunction(initializer);
        if (fn) reportDefinition(node.id, node.id.name, fn);
      },
      FunctionDeclaration(node) {
        if (node.id) reportDefinition(node.id, node.id.name, node);
      },
      CallExpression(node) {
        const name = traversalForCallee(node.callee);
        if (name) {
          context.report({ node, messageId: "traversal", data: { name } });
        }
      },
    };
  },
);
