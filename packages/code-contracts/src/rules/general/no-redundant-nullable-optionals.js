import {
  architectureRuleMeta,
  createRule,
  getStaticPropertyName,
} from "../../ast.js";

const DISALLOWED_TYPES = new Map([
  ["TSNullKeyword", "null"],
  ["TSUndefinedKeyword", "undefined"],
  ["TSVoidKeyword", "void"],
  ["TSAnyKeyword", "any"],
  ["TSUnknownKeyword", "unknown"],
]);

function collectDisallowedTypes(typeNode, found = new Set()) {
  if (!typeNode) return found;

  if (
    typeNode.type === "TSTypeAnnotation" ||
    typeNode.type === "TSParenthesizedType"
  ) {
    return collectDisallowedTypes(typeNode.typeAnnotation, found);
  }

  if (typeNode.type === "TSUnionType") {
    for (const member of typeNode.types) {
      collectDisallowedTypes(member, found);
    }
    return found;
  }

  const disallowedType = DISALLOWED_TYPES.get(typeNode.type);
  if (disallowedType) found.add(disallowedType);
  return found;
}

function propertyName(node) {
  const name = getStaticPropertyName(node.key);
  return name ? `\`${name}\`` : "this property";
}

function checkOptionalProperty(context, node, typeNode, name) {
  const isOptional = node.optional === true || node.optional === "+";
  if (!isOptional) return;

  const disallowedTypes = [...collectDisallowedTypes(typeNode)];
  if (disallowedTypes.length === 0) return;

  context.report({
    node,
    messageId: "duplicateAbsence",
    data: {
      name,
      types: disallowedTypes.map((type) => `\`${type}\``).join(", "),
    },
  });
}

export default createRule(
  {
    ...architectureRuleMeta,
    docs: {
      ...architectureRuleMeta.docs,
      description:
        "Require optional properties to have an explicitly non-nullish value type.",
    },
    messages: {
      duplicateAbsence:
        "Optional property {{name}} has a value type that does not exclude {{types}}. Use optionality as the absence contract or make the property required.",
    },
  },
  (context) => ({
    TSPropertySignature(node) {
      checkOptionalProperty(
        context,
        node,
        node.typeAnnotation,
        propertyName(node),
      );
    },
    TSMappedType(node) {
      checkOptionalProperty(
        context,
        node,
        node.typeAnnotation,
        "this mapped property",
      );
    },
    PropertyDefinition(node) {
      checkOptionalProperty(
        context,
        node,
        node.typeAnnotation,
        propertyName(node),
      );
    },
    AccessorProperty(node) {
      checkOptionalProperty(
        context,
        node,
        node.typeAnnotation,
        propertyName(node),
      );
    },
    TSParameterProperty(node) {
      const parameter = node.parameter;
      if (parameter.type !== "Identifier") return;
      checkOptionalProperty(
        context,
        parameter,
        parameter.typeAnnotation,
        `\`${parameter.name}\``,
      );
    },
  }),
);
