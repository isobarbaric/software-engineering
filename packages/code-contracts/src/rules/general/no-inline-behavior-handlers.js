import {
  architectureRuleMeta,
  createRule,
  getStaticPropertyName,
  unwrapExpression,
  walk,
} from "../../ast.js";

const NON_STATE_SETTERS = new Set(["setImmediate", "setInterval", "setTimeout"]);
const NON_FUNCTION_IDENTIFIERS = new Set(["Infinity", "NaN", "undefined"]);
const HIDDEN_BEHAVIOR_NODES = new Set([
  "ArrowFunctionExpression",
  "AssignmentExpression",
  "AwaitExpression",
  "CallExpression",
  "FunctionExpression",
  "NewExpression",
  "SequenceExpression",
  "TaggedTemplateExpression",
  "UpdateExpression",
  "YieldExpression",
]);

function isFunctionReference(node, visitorKeys) {
  const expression = unwrapExpression(node);
  if (expression?.type === "Identifier") {
    return !NON_FUNCTION_IDENTIFIERS.has(expression.name);
  }
  return (
    expression?.type === "MemberExpression" &&
    !hasHiddenBehavior([expression], visitorKeys)
  );
}

function singleExpression(body) {
  if (body.type !== "BlockStatement") return body;
  if (body.body.length !== 1 || body.body[0].type !== "ExpressionStatement") {
    return null;
  }
  return body.body[0].expression;
}

function hasHiddenBehavior(arguments_, visitorKeys) {
  let hidden = false;
  for (const argument of arguments_) {
    const value = argument.type === "SpreadElement" ? argument.argument : argument;
    walk(value, visitorKeys, (node) => {
      if (
        HIDDEN_BEHAVIOR_NODES.has(node.type) ||
        (node.type === "UnaryExpression" && node.operator === "delete")
      ) {
        hidden = true;
        return false;
      }
      return !hidden;
    });
    if (hidden) return true;
  }
  return false;
}

function isDirectSetterArrow(node, visitorKeys) {
  const fn = unwrapExpression(node);
  if (
    fn?.type !== "ArrowFunctionExpression" ||
    fn.async ||
    fn.params.length !== 0
  ) {
    return false;
  }

  const expression = unwrapExpression(singleExpression(fn.body));
  if (
    expression?.type !== "CallExpression" ||
    expression.optional ||
    expression.callee.type !== "Identifier" ||
    !/^set[A-Z]/.test(expression.callee.name) ||
    NON_STATE_SETTERS.has(expression.callee.name)
  ) {
    return false;
  }

  return !hasHiddenBehavior(expression.arguments, visitorKeys);
}

function isAllowedHandler(node, visitorKeys) {
  return (
    isFunctionReference(node, visitorKeys) ||
    isDirectSetterArrow(node, visitorKeys)
  );
}

function staticObjectPropertyName(node) {
  if (!node.computed) return getStaticPropertyName(node.key);
  if (node.key.type === "Literal") return String(node.key.value);
  if (node.key.type === "TemplateLiteral" && node.key.expressions.length === 0) {
    return node.key.quasis[0]?.value.cooked ?? node.key.quasis[0]?.value.raw;
  }
  return null;
}

export default createRule(
  {
    ...architectureRuleMeta,
    docs: {
      ...architectureRuleMeta.docs,
      description:
        "Allow JSX event props to receive only function references or zero-parameter inline state setters.",
    },
    messages: {
      name:
        "Pass a named function to {{attribute}}; the only permitted inline handler is () => setX(...).",
    },
  },
  (context) => {
    const visitorKeys = context.sourceCode.visitorKeys;

    function reportInvalidHandler(node, attribute, value) {
      if (isAllowedHandler(value, visitorKeys)) return;
      context.report({ node, messageId: "name", data: { attribute } });
    }

    return {
      JSXAttribute(node) {
        const attribute = getStaticPropertyName(node.name);
        if (!/^on[A-Z]/.test(attribute ?? "")) return;

        const expression =
          node.value?.type === "JSXExpressionContainer"
            ? node.value.expression
            : null;
        reportInvalidHandler(node, attribute, expression);
      },

      JSXSpreadAttribute(node) {
        const expression = unwrapExpression(node.argument);
        if (expression?.type !== "ObjectExpression") return;

        const seen = new Set();
        const effectiveProperties = [];
        let unknownOverride = false;
        for (const property of expression.properties.toReversed()) {
          const name =
            property.type === "Property"
              ? staticObjectPropertyName(property)
              : null;
          if (name === null) {
            unknownOverride = true;
            continue;
          }
          const entry = { property, name };
          if (seen.has(entry.name)) continue;
          seen.add(entry.name);
          if (unknownOverride) continue;
          effectiveProperties.push(entry);
        }

        for (const { property, name } of effectiveProperties.toReversed()) {
          if (!/^on[A-Z]/.test(name)) continue;
          reportInvalidHandler(property, name, property.value);
        }
      },
    };
  },
);
