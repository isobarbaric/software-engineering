import {
  architectureRuleMeta,
  createRule,
  unwrapExpression,
} from "../../ast.js";

const TYPE_WRAPPERS = new Set([
  "TSParenthesizedType",
  "TSOptionalType",
]);

function queryKeyFactoryName(node) {
  let current = node;

  while (current?.parent) {
    const parent = current.parent;
    if (
      [
        "TSAsExpression",
        "TSSatisfiesExpression",
        "TSNonNullExpression",
        "TypeCastExpression",
      ].includes(parent.type) &&
      parent.expression === current
    ) {
      current = parent;
      continue;
    }
    if (parent.type === "Property" && parent.value === current) {
      current = parent.parent;
      continue;
    }
    if (
      parent.type === "CallExpression" &&
      parent.arguments.includes(current)
    ) {
      current = parent;
      continue;
    }
    if (
      parent.type === "VariableDeclarator" &&
      parent.init === current &&
      parent.id.type === "Identifier" &&
      /queryKeys$/i.test(parent.id.name)
    ) {
      return parent.id.name;
    }
    return null;
  }

  return null;
}

function parameterParts(parameter) {
  if (parameter.type === "AssignmentPattern") {
    return {
      target: parameter.left,
      defaultValue: unwrapExpression(parameter.right),
      hasDefault: true,
    };
  }
  if (parameter.type === "RestElement") {
    return {
      target: parameter.argument,
      defaultValue: null,
      hasDefault: false,
      annotation: parameter.typeAnnotation,
    };
  }
  return {
    target: parameter,
    defaultValue: null,
    hasDefault: false,
  };
}

function typeContainsAbsence(node, hasDefault) {
  if (!node) return false;
  if (TYPE_WRAPPERS.has(node.type)) {
    return typeContainsAbsence(node.typeAnnotation, hasDefault);
  }
  if (node.type === "TSUnionType") {
    return node.types.some((type) => typeContainsAbsence(type, hasDefault));
  }
  if (node.type === "TSNullKeyword") return true;
  if (node.type === "TSUndefinedKeyword" || node.type === "TSVoidKeyword") {
    return !hasDefault;
  }
  return node.type === "TSAnyKeyword" || node.type === "TSUnknownKeyword";
}

function defaultIntroducesAbsence(node) {
  return (
    (node?.type === "Literal" && node.value === null) ||
    (node?.type === "Identifier" && node.name === "undefined") ||
    (node?.type === "UnaryExpression" && node.operator === "void")
  );
}

function parameterName(node) {
  if (node.type === "Identifier") return node.name;
  return "this parameter";
}

export default createRule(
  {
    ...architectureRuleMeta,
    docs: {
      ...architectureRuleMeta.docs,
      description:
        "Require query-key factory parameters to exclude null and undefined.",
    },
    messages: {
      nullable:
        "Query-key factory parameter {{name}} must be required and exclude null and undefined. Normalize or gate the value before building the key.",
    },
  },
  (context) => ({
    ":function"(node) {
      if (!queryKeyFactoryName(node)) return;

      for (const parameter of node.params) {
        const parts = parameterParts(parameter);
        const annotation =
          parts.annotation ??
          parts.target.typeAnnotation ??
          parameter.typeAnnotation;
        const type = annotation?.typeAnnotation;
        const invalid =
          (!parts.hasDefault &&
            (parameter.optional === true || parts.target.optional === true)) ||
          typeContainsAbsence(type, parts.hasDefault) ||
          defaultIntroducesAbsence(parts.defaultValue);

        if (invalid) {
          context.report({
            node: parameter,
            messageId: "nullable",
            data: { name: parameterName(parts.target) },
          });
        }
      }
    },
  }),
);
