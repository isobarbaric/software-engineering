import {
  architectureRuleMeta,
  createRule,
  getStaticPropertyName,
  unwrapExpression,
  walk,
} from "../../ast.js";

const DERIVED_TYPE_UTILITIES = new Set(["Parameters", "ReturnType"]);

function isHandlerName(name, prefix) {
  return new RegExp(`^${prefix}[A-Z]`).test(name ?? "");
}

function staticPropertyName(node) {
  if (!node.computed) return getStaticPropertyName(node.key);
  if (node.key.type === "Literal") return String(node.key.value);
  if (node.key.type === "TemplateLiteral" && node.key.expressions.length === 0) {
    return node.key.quasis[0]?.value.cooked ?? node.key.quasis[0]?.value.raw;
  }
  return null;
}

function unwrapParenthesizedType(node) {
  let current = node;
  while (current?.type === "TSParenthesizedType") current = current.typeAnnotation;
  return current;
}

function typeReferenceName(node) {
  if (node.typeName.type === "Identifier") return node.typeName.name;
  return null;
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

function containsDerivedType(node, sourceCode, visitorKeys) {
  let derived = false;
  walk(node, visitorKeys, (child) => {
    if (child.type === "TSIndexedAccessType" || child.type === "TSTypeQuery") {
      derived = true;
      return false;
    }
    if (
      child.type === "TSTypeReference" &&
      DERIVED_TYPE_UTILITIES.has(typeReferenceName(child)) &&
      resolveVariable(sourceCode, child.typeName) === null
    ) {
      derived = true;
      return false;
    }
    return !derived;
  });
  return derived;
}

function parameterType(parameter) {
  let current = parameter;
  if (current.typeAnnotation?.typeAnnotation) {
    return current.typeAnnotation.typeAnnotation;
  }
  if (current.type === "TSParameterProperty") current = current.parameter;
  if (current.type === "AssignmentPattern") current = current.left;
  if (current.type === "RestElement") current = current.argument;
  return current.typeAnnotation?.typeAnnotation ?? null;
}

function explicitFunctionTypeProblem(node, sourceCode, visitorKeys) {
  const functionType = unwrapParenthesizedType(node);
  if (functionType?.type !== "TSFunctionType") return "hidden";
  if (
    functionType.params.some((parameter) => parameterType(parameter) === null) ||
    !functionType.returnType?.typeAnnotation
  ) {
    return "incomplete";
  }
  return containsDerivedType(functionType, sourceCode, visitorKeys)
    ? "derived"
    : null;
}

function implementationSignatureProblem(node, sourceCode, visitorKeys) {
  const fn = unwrapExpression(node);
  if (
    fn?.type !== "ArrowFunctionExpression" &&
    fn?.type !== "FunctionExpression" &&
    fn?.type !== "FunctionDeclaration" &&
    fn?.type !== "TSDeclareFunction"
  ) {
    return null;
  }

  for (const parameter of fn.params) {
    const type = parameterType(parameter);
    if (type && containsDerivedType(type, sourceCode, visitorKeys)) {
      return "derived";
    }
  }
  const returnType = fn.returnType?.typeAnnotation;
  return returnType && containsDerivedType(returnType, sourceCode, visitorKeys)
    ? "derived"
    : null;
}

export default createRule(
  {
    ...architectureRuleMeta,
    docs: {
      ...architectureRuleMeta.docs,
      description:
        "Require public callbacks and explicitly typed handlers to show their complete signatures.",
    },
    messages: {
      hidden:
        "Write the {{name}} callback as a fully visible function signature instead of a callback alias or method.",
      incomplete:
        "Write explicit parameter and return types in the {{name}} callback signature.",
      derived:
        "Write the {{name}} callback signature directly; do not derive it through indexed access, typeof, Parameters, or ReturnType.",
    },
  },
  (context) => {
    const sourceCode = context.sourceCode;
    const visitorKeys = sourceCode.visitorKeys;

    function report(node, name, problem) {
      if (!problem) return;
      context.report({ node, messageId: problem, data: { name } });
    }

    return {
      TSPropertySignature(node) {
        const name = staticPropertyName(node);
        if (!isHandlerName(name, "on")) return;
        report(
          node,
          name,
          explicitFunctionTypeProblem(
            node.typeAnnotation?.typeAnnotation,
            sourceCode,
            visitorKeys,
          ),
        );
      },

      TSMethodSignature(node) {
        const name = staticPropertyName(node);
        if (!isHandlerName(name, "on")) return;
        report(node, name, "hidden");
      },

      VariableDeclarator(node) {
        if (
          node.id.type !== "Identifier" ||
          !isHandlerName(node.id.name, "handle")
        ) {
          return;
        }

        const declaredType = node.id.typeAnnotation?.typeAnnotation;
        const declaredProblem = declaredType
          ? explicitFunctionTypeProblem(declaredType, sourceCode, visitorKeys)
          : null;
        report(
          node,
          node.id.name,
          declaredProblem ??
            implementationSignatureProblem(node.init, sourceCode, visitorKeys),
        );
      },

      FunctionDeclaration(node) {
        if (!isHandlerName(node.id?.name, "handle")) return;
        report(
          node,
          node.id.name,
          implementationSignatureProblem(node, sourceCode, visitorKeys),
        );
      },

      TSDeclareFunction(node) {
        if (!isHandlerName(node.id?.name, "handle")) return;
        report(
          node,
          node.id.name,
          implementationSignatureProblem(node, sourceCode, visitorKeys),
        );
      },

      FunctionExpression(node) {
        if (!isHandlerName(node.id?.name, "handle")) return;
        if (
          node.parent?.type === "VariableDeclarator" &&
          node.parent.init === node &&
          node.parent.id.type === "Identifier" &&
          isHandlerName(node.parent.id.name, "handle")
        ) {
          return;
        }
        report(
          node,
          node.id.name,
          implementationSignatureProblem(node, sourceCode, visitorKeys),
        );
      },
    };
  },
);
