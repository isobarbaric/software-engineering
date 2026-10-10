import {
  architectureRuleMeta,
  containsJsx,
  createRule,
  getCalleeName,
  getComponentDefinition,
  isComponentTestFile,
  isPascalCase,
  unwrapExpression,
} from "../../ast.js";

const COMPONENT_WRAPPERS = new Set(["memo", "forwardRef"]);
const COMPONENT_BASE_CLASSES = new Set(["Component", "PureComponent"]);

function staticMemberName(node) {
  const member = unwrapExpression(node);
  if (member?.type !== "MemberExpression") return null;

  const property = unwrapExpression(member.property);
  if (!member.computed && property?.type === "Identifier") {
    return property.name;
  }
  if (property?.type === "Literal") return String(property.value);
  if (property?.type === "TemplateLiteral" && property.expressions.length === 0) {
    return property.quasis[0]?.value.cooked ?? property.quasis[0]?.value.raw ?? null;
  }
  return null;
}

function wrapperCalleeKind(node) {
  const callee = unwrapExpression(node);
  if (callee?.type === "Identifier" && COMPONENT_WRAPPERS.has(callee.name)) {
    return "direct";
  }
  if (callee?.type !== "MemberExpression") return null;

  const object = unwrapExpression(callee.object);
  const name = staticMemberName(callee);
  if (!COMPONENT_WRAPPERS.has(name)) return null;
  return object?.type === "Identifier" && object.name === "React"
    ? "react-member"
    : "unrelated-member";
}

function unwrapRuleComponentFunction(node) {
  const expression = unwrapExpression(node);
  if (
    expression?.type === "ArrowFunctionExpression" ||
    expression?.type === "FunctionExpression"
  ) {
    return expression;
  }
  if (expression?.type !== "CallExpression") {
    return null;
  }
  const calleeKind = wrapperCalleeKind(expression.callee);
  if (calleeKind !== "direct" && calleeKind !== "react-member") return null;
  return unwrapRuleComponentFunction(expression.arguments[0]);
}

function isUnrelatedMemberWrapper(node) {
  const expression = unwrapExpression(node);
  return (
    expression?.type === "CallExpression" &&
    wrapperCalleeKind(expression.callee) === "unrelated-member"
  );
}

function isClassComponentExpression(node) {
  const expression = unwrapExpression(node);
  if (expression?.type !== "ClassExpression" || !expression.superClass) {
    return false;
  }
  return COMPONENT_BASE_CLASSES.has(getCalleeName(expression.superClass));
}

function ruleComponentDefinition(node, visitorKeys) {
  if (node.type === "ExportDefaultDeclaration") {
    const declaration = unwrapExpression(node.declaration);
    if (
      declaration?.type === "FunctionDeclaration" &&
      !declaration.id &&
      containsJsx(declaration.body, visitorKeys)
    ) {
      return { name: "the default export", node: declaration };
    }
    if (
      declaration?.type === "ClassDeclaration" &&
      !declaration.id &&
      declaration.superClass &&
      COMPONENT_BASE_CLASSES.has(getCalleeName(declaration.superClass))
    ) {
      return { name: "the default export", node: declaration };
    }
    const fn = unwrapRuleComponentFunction(declaration);
    return fn && containsJsx(fn.body, visitorKeys)
      ? { name: "the default export", node: declaration }
      : null;
  }

  if (
    node.type === "VariableDeclarator" &&
    node.id.type === "Identifier" &&
    isPascalCase(node.id.name)
  ) {
    if (isUnrelatedMemberWrapper(node.init)) return null;
    if (isClassComponentExpression(node.init)) {
      return { name: node.id.name, node };
    }
    const fn = unwrapRuleComponentFunction(node.init);
    if (fn && containsJsx(fn.body, visitorKeys)) {
      return { name: node.id.name, node };
    }
    const initializer = unwrapExpression(node.init);
    if (
      initializer?.type === "CallExpression" &&
      wrapperCalleeKind(initializer.callee)
    ) {
      return null;
    }
  }

  if (node.type === "AssignmentExpression") {
    if (isUnrelatedMemberWrapper(node.right)) return null;
    const fn = unwrapRuleComponentFunction(node.right);
    const name = staticMemberName(node.left);
    if (isPascalCase(name) && fn && containsJsx(fn.body, visitorKeys)) {
      return { name, node };
    }
    const value = unwrapExpression(node.right);
    if (
      value?.type === "CallExpression" &&
      wrapperCalleeKind(value.callee)
    ) {
      return null;
    }
  }

  return getComponentDefinition(node, visitorKeys);
}

export default createRule(
  {
    ...architectureRuleMeta,
    docs: {
      ...architectureRuleMeta.docs,
      description: "Require each production module to declare at most one React component.",
    },
    messages: {
      extraComponent:
        "Move {{name}} to its own file. {{first}} is already the component owned by this module.",
    },
  },
  (context) => {
    if (isComponentTestFile(context.filename)) return {};
    const visitorKeys = context.sourceCode.visitorKeys;
    let firstComponent = null;

    function check(node) {
      const component = ruleComponentDefinition(node, visitorKeys);
      if (!component) return;
      if (!firstComponent) {
        firstComponent = component;
        return;
      }
      context.report({
        node: component.node,
        messageId: "extraComponent",
        data: { name: component.name, first: firstComponent.name },
      });
    }

    return {
      ExportDefaultDeclaration: check,
      FunctionDeclaration: check,
      VariableDeclarator: check,
      ClassDeclaration: check,
      AssignmentExpression: check,
    };
  },
);
