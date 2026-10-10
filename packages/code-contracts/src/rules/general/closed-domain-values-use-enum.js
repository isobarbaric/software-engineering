import {
  architectureRuleMeta,
  createRule,
  getStaticPropertyName,
  isComponentTestFile,
  isGeneratedFile,
  unwrapExpression,
} from "../../ast.js";

function stringLiteral(node) {
  const expression = unwrapExpression(node);
  const value = expression?.type === "TSLiteralType" ? expression.literal : expression;
  return value?.type === "Literal" && typeof value.value === "string"
    ? value.value
    : null;
}

function isEnumMemberType(node) {
  return (
    node?.type === "TSTypeReference" &&
    node.typeName.type === "TSQualifiedName"
  );
}

function discriminantValues(node) {
  const variants = node.types.filter((type) => type.type === "TSTypeLiteral");
  if (variants.length < 2 || variants.length !== node.types.length) return null;
  const propertiesByVariant = variants.map((variant) => {
    const properties = new Map();
    for (const member of variant.members) {
      if (member.type !== "TSPropertySignature") continue;
      const name = getStaticPropertyName(member.key);
      const type = member.typeAnnotation?.typeAnnotation;
      if (name && type) properties.set(name, type);
    }
    return properties;
  });

  for (const [name] of propertiesByVariant[0]) {
    const types = propertiesByVariant.map((properties) => properties.get(name));
    if (types.some((type) => type === undefined)) continue;
    if (!types.every((type) => stringLiteral(type) !== null || isEnumMemberType(type))) {
      continue;
    }

    const values = types.map(stringLiteral).filter((value) => value !== null);
    if (
      values.length > 0 &&
      (new Set(values).size >= 2 || types.some(isEnumMemberType))
    ) {
      return { name, values };
    }
  }
  return null;
}

function identifierBinding(sourceCode, node) {
  let scope = sourceCode.getScope(node);
  while (scope) {
    const variable = scope.set.get(node.name);
    if (variable) return variable;
    scope = scope.upper;
  }
  return `unresolved:${node.name}`;
}

function isConstAssertion(node) {
  return (
    node.typeAnnotation?.type === "TSTypeReference" &&
    node.typeAnnotation.typeName.type === "Identifier" &&
    node.typeAnnotation.typeName.name === "const"
  );
}

export default createRule(
  {
    ...architectureRuleMeta,
    docs: {
      ...architectureRuleMeta.docs,
      description: "Require enums for closed string vocabularies used as behavior selectors.",
    },
    messages: {
      union: "Replace this closed string-literal union with an enum.",
      discriminant:
        "Replace the loose {{name}} discriminants ({{values}}) with members of a dedicated enum.",
      constSet: "Replace this closed string `as const` set with an enum.",
      branch:
        "{{subject}} is compared against a closed string vocabulary ({{values}}). Use an enum instead of loose strings.",
    },
  },
  (context) => {
    if (isComponentTestFile(context.filename) || isGeneratedFile(context.filename)) {
      return {};
    }
    const comparisons = new Map();
    const sourceCode = context.sourceCode;
    return {
      TSUnionType(node) {
        const values = node.types.map(stringLiteral);
        if (
          values.every((value) => value !== null) &&
          new Set(values).size >= 2
        ) {
          context.report({ node, messageId: "union" });
          return;
        }
        const discriminant = discriminantValues(node);
        if (discriminant) {
          context.report({
            node,
            messageId: "discriminant",
            data: {
              name: discriminant.name,
              values: discriminant.values.join(", "),
            },
          });
        }
      },
      TSAsExpression(node) {
        if (
          !isConstAssertion(node) ||
          node.expression.type !== "ArrayExpression"
        ) {
          return;
        }
        const values = node.expression.elements.map(stringLiteral);
        if (
          values.every((value) => value !== null) &&
          new Set(values).size >= 2
        ) {
          context.report({ node, messageId: "constSet" });
        }
      },
      BinaryExpression(node) {
        if (!new Set(["===", "!==", "==", "!="]).has(node.operator)) return;
        const rightValue = stringLiteral(node.right);
        const leftValue = stringLiteral(node.left);
        const subject = rightValue !== null ? node.left : leftValue !== null ? node.right : null;
        const value = rightValue ?? leftValue;
        if (!subject || subject.type !== "Identifier" || value === null) return;
        const key = identifierBinding(sourceCode, subject);
        const entry = comparisons.get(key) ?? {
          node,
          subject: sourceCode.getText(subject),
          values: new Set(),
        };
        entry.values.add(value);
        comparisons.set(key, entry);
      },
      SwitchStatement(node) {
        if (node.discriminant.type !== "Identifier") return;
        const values = node.cases
          .map((branch) => stringLiteral(branch.test))
          .filter((value) => value !== null);
        if (new Set(values).size >= 2) {
          context.report({
            node: node.discriminant,
            messageId: "branch",
            data: {
              subject: sourceCode.getText(node.discriminant),
              values: [...new Set(values)].join(", "),
            },
          });
        }
      },
      "Program:exit"() {
        for (const entry of comparisons.values()) {
          if (entry.values.size < 2) continue;
          context.report({
            node: entry.node,
            messageId: "branch",
            data: {
              subject: entry.subject,
              values: [...entry.values].join(", "),
            },
          });
        }
      },
    };
  },
);
