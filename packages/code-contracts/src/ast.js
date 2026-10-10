const COMPONENT_NAME = /^[A-Z][A-Za-z0-9]*$/;

export function isPascalCase(name) {
  return COMPONENT_NAME.test(name ?? "");
}

export function unwrapExpression(node) {
  let current = node;
  while (
    current &&
    [
      "ChainExpression",
      "TSAsExpression",
      "TSSatisfiesExpression",
      "TSNonNullExpression",
      "TypeCastExpression",
    ].includes(current.type)
  ) {
    current = current.expression;
  }
  return current;
}

export function walk(node, visitorKeys, visit) {
  if (!node || typeof node.type !== "string") return;
  if (visit(node) === false) return;

  for (const key of visitorKeys[node.type] ?? []) {
    const value = node[key];
    if (Array.isArray(value)) {
      for (const child of value) walk(child, visitorKeys, visit);
    } else {
      walk(value, visitorKeys, visit);
    }
  }
}

export function containsJsx(node, visitorKeys) {
  let found = false;
  walk(node, visitorKeys, (child) => {
    const isCreateElement =
      child.type === "CallExpression" &&
      (child.callee.type === "Identifier"
        ? child.callee.name === "createElement"
        : child.callee.type === "MemberExpression" &&
          !child.callee.computed &&
          child.callee.property.type === "Identifier" &&
          child.callee.property.name === "createElement");
    if (
      child.type === "JSXElement" ||
      child.type === "JSXFragment" ||
      isCreateElement
    ) {
      found = true;
      return false;
    }
    return !found;
  });
  return found;
}

function unwrapComponentFunction(node) {
  const expression = unwrapExpression(node);
  if (
    expression?.type === "ArrowFunctionExpression" ||
    expression?.type === "FunctionExpression"
  ) {
    return expression;
  }

  if (expression?.type !== "CallExpression") return null;
  const callee = unwrapExpression(expression.callee);
  const wrapperName =
    callee?.type === "Identifier"
      ? callee.name
      : callee?.type === "MemberExpression" &&
          !callee.computed &&
          callee.property.type === "Identifier"
        ? callee.property.name
        : null;

  if (!new Set(["memo", "forwardRef"]).has(wrapperName)) return null;
  return unwrapComponentFunction(expression.arguments[0]);
}

export function getTopLevelComponent(node, visitorKeys) {
  if (
    (node.type === "ExportNamedDeclaration" || node.type === "ExportDefaultDeclaration") &&
    node.declaration
  ) {
    return getTopLevelComponent(node.declaration, visitorKeys);
  }

  if (
    node.type === "FunctionDeclaration" &&
    isPascalCase(node.id?.name) &&
    containsJsx(node.body, visitorKeys)
  ) {
    return { name: node.id.name, node, fn: node };
  }

  if (node.type === "VariableDeclaration") {
    for (const declaration of node.declarations) {
      if (declaration.id.type !== "Identifier" || !isPascalCase(declaration.id.name)) {
        continue;
      }
      const fn = unwrapComponentFunction(declaration.init);
      if (fn && containsJsx(fn.body, visitorKeys)) {
        return {
          name: declaration.id.name,
          node: declaration,
          fn,
          initializer: declaration.init,
        };
      }
    }
  }

  if (
    node.type === "ClassDeclaration" &&
    isPascalCase(node.id?.name) &&
    node.superClass
  ) {
    const superclass = unwrapExpression(node.superClass);
    const superclassName =
      superclass.type === "Identifier"
        ? superclass.name
        : superclass.type === "MemberExpression" &&
            !superclass.computed &&
            superclass.property.type === "Identifier"
          ? superclass.property.name
          : null;
    if (superclassName === "Component" || superclassName === "PureComponent") {
      return { name: node.id.name, node, fn: null, initializer: null };
    }
  }

  return null;
}

export function getComponentDefinition(node, visitorKeys) {
  if (
    node.type === "FunctionDeclaration" &&
    isPascalCase(node.id?.name) &&
    containsJsx(node.body, visitorKeys)
  ) {
    return { name: node.id.name, node, fn: node, initializer: node };
  }

  if (
    node.type === "VariableDeclarator" &&
    node.id.type === "Identifier" &&
    isPascalCase(node.id.name)
  ) {
    const fn = unwrapComponentFunction(node.init);
    if (fn && containsJsx(fn.body, visitorKeys)) {
      return { name: node.id.name, node, fn, initializer: node.init };
    }
  }

  if (
    node.type === "ClassDeclaration" &&
    isPascalCase(node.id?.name) &&
    node.superClass
  ) {
    const superclassName = getCalleeName(node.superClass);
    if (superclassName === "Component" || superclassName === "PureComponent") {
      return { name: node.id.name, node, fn: null, initializer: null };
    }
  }

  if (
    node.type === "AssignmentExpression" &&
    node.left.type === "MemberExpression" &&
    isPascalCase(
      node.left.computed
        ? node.left.property.type === "Literal"
          ? String(node.left.property.value)
          : null
        : getStaticPropertyName(node.left.property),
    )
  ) {
    const fn = unwrapComponentFunction(node.right);
    if (fn && containsJsx(fn.body, visitorKeys)) {
      return {
        name: getStaticPropertyName(node.left.property),
        node,
        fn,
        initializer: node.right,
      };
    }
  }

  return null;
}

export function isComponentTestFile(filename) {
  const normalized = filename.replaceAll("\\", "/");
  return (
    /\/(?:__tests__|__stories__)\//.test(normalized) ||
    /\.(?:test|spec|stor(?:y|ies))\.[jt]sx?$/.test(normalized)
  );
}

export function isGeneratedFile(filename) {
  const normalized = filename.replaceAll("\\", "/");
  return (
    /\/(?:__generated__|generated)\//.test(normalized) ||
    /\.(?:generated|gen)\.[jt]sx?$/.test(normalized)
  );
}

export function getStaticPropertyName(node) {
  if (!node) return null;
  if (node.type === "Identifier" || node.type === "JSXIdentifier") return node.name;
  if (node.type === "Literal") return String(node.value);
  return null;
}

export function getCalleeName(node) {
  const callee = unwrapExpression(node);
  if (callee?.type === "Identifier") return callee.name;
  if (
    callee?.type === "MemberExpression" &&
    !callee.computed &&
    callee.property.type === "Identifier"
  ) {
    return callee.property.name;
  }
  return null;
}

export function createRule(meta, create) {
  return { meta, create };
}

export const architectureRuleMeta = {
  type: "problem",
  docs: {
    recommended: true,
  },
  schema: [],
};
