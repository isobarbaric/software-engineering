import {
  architectureRuleMeta,
  createRule,
  unwrapExpression,
} from "../../ast.js";

const TRANSPARENT_EXPRESSIONS = new Set([
  "ChainExpression",
  "TSAsExpression",
  "TSSatisfiesExpression",
  "TSNonNullExpression",
  "TypeCastExpression",
]);

function staticMemberName(node) {
  const property = unwrapExpression(node.property);
  if (!node.computed && property?.type === "Identifier") {
    return property.name;
  }
  if (node.computed && property?.type === "Literal") {
    return String(property.value);
  }
  if (
    node.computed &&
    property?.type === "TemplateLiteral" &&
    property.expressions.length === 0
  ) {
    return property.quasis[0]?.value.cooked ?? property.quasis[0]?.value.raw;
  }
  return null;
}

function stableSubjectKey(node) {
  const expression = unwrapExpression(node);
  if (expression?.type === "Identifier") return `identifier:${expression.name}`;
  if (expression?.type === "ThisExpression") return "this";
  if (expression?.type !== "MemberExpression") return null;

  const object = stableSubjectKey(expression.object);
  const property = staticMemberName(expression);
  if (object === null || property === null) return null;
  return `member:${object}:${JSON.stringify(property)}`;
}

function rootIdentifier(node) {
  const expression = unwrapExpression(node);
  if (expression?.type === "Identifier") return expression.name;
  if (expression?.type === "ThisExpression") return "this";
  if (expression?.type === "MemberExpression") {
    return rootIdentifier(expression.object);
  }
  return null;
}

function isStableSubject(node) {
  const expression = unwrapExpression(node);
  if (expression?.type === "ThisExpression") return true;
  const root = rootIdentifier(expression);
  if (root === null) return false;
  return !/^[A-Z]/.test(root);
}

function comparableKey(node) {
  const expression = unwrapExpression(node);
  const subject = stableSubjectKey(expression);
  if (subject !== null) return subject;
  if (expression?.type === "Literal") {
    return `literal:${typeof expression.value}:${JSON.stringify(expression.value)}`;
  }
  if (
    expression?.type === "TemplateLiteral" &&
    expression.expressions.length === 0
  ) {
    const value = expression.quasis[0]?.value.cooked ?? expression.quasis[0]?.value.raw;
    return `literal:string:${JSON.stringify(value)}`;
  }
  return null;
}

function rootOfElseIfChain(node) {
  return !(
    node.parent?.type === "IfStatement" && node.parent.alternate === node
  );
}

function sameSubject(node) {
  const conditions = [];
  let current = node;
  while (current?.type === "IfStatement") {
    const condition = unwrapExpression(current.test);
    if (condition?.type !== "BinaryExpression" || condition.operator !== "===") {
      return null;
    }
    conditions.push(condition);
    current = current.alternate;
  }

  if (conditions.length < 2) return null;

  let sharedKeys = null;
  const nodesByKey = new Map();
  for (const condition of conditions) {
    const operands = [condition.left, condition.right]
      .map((operand) => ({ key: comparableKey(operand), node: operand }))
      .filter(({ key }) => key !== null);
    const keys = new Set(operands.map(({ key }) => key));
    for (const operand of operands) nodesByKey.set(operand.key, operand.node);
    sharedKeys =
      sharedKeys === null
        ? keys
        : new Set([...sharedKeys].filter((key) => keys.has(key)));
  }

  if (sharedKeys.size !== 1) return null;
  const [key] = sharedKeys;
  const subject = nodesByKey.get(key);
  return stableSubjectKey(subject) === key && isStableSubject(subject)
    ? subject
    : null;
}

function outerLogicalExpression(node) {
  let current = node;
  while (current.parent?.type === "LogicalExpression") {
    current = current.parent;
  }
  while (
    TRANSPARENT_EXPRESSIONS.has(current.parent?.type) &&
    current.parent.expression === current
  ) {
    current = current.parent;
  }
  return current;
}

export default createRule(
  {
    ...architectureRuleMeta,
    docs: {
      ...architectureRuleMeta.docs,
      description:
        "Prefer explicit control flow and switches over expression-level branching.",
    },
    messages: {
      conditional:
        "Replace this conditional expression with explicit if/else control flow.",
      shortCircuit:
        "Replace this short-circuit branch with explicit if/else control flow.",
      sameSubject:
        "Use a switch on {{subject}} when every branch compares the same value.",
    },
  },
  (context) => ({
    ConditionalExpression(node) {
      context.report({ node, messageId: "conditional" });
    },

    LogicalExpression(node) {
      if (node.parent?.type === "LogicalExpression") return;
      const expression = outerLogicalExpression(node);
      if (
        expression.parent?.type !== "ExpressionStatement" &&
        expression.parent?.type !== "JSXExpressionContainer"
      ) {
        return;
      }
      context.report({ node, messageId: "shortCircuit" });
    },

    AssignmentExpression(node) {
      if (!["&&=", "||=", "??="].includes(node.operator)) return;
      context.report({ node, messageId: "shortCircuit" });
    },

    IfStatement(node) {
      if (!rootOfElseIfChain(node)) return;
      const subject = sameSubject(node);
      if (!subject) return;
      context.report({
        node,
        messageId: "sameSubject",
        data: { subject: context.sourceCode.getText(subject) },
      });
    },
  }),
);
