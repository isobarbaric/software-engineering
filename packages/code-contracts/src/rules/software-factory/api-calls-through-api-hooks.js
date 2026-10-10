import {
  architectureRuleMeta,
  createRule,
  getCalleeName,
  unwrapExpression,
} from "../../ast.js";

const DEFAULT_ALLOWED_PATHS = [
  /\/hooks\/api\//,
  /\/src\/lib\/(api|http|uploads?)\//,
];

function normalizeFilename(filename) {
  return filename.replaceAll("\\", "/");
}

function restrictedCallName(node) {
  const direct = getCalleeName(node);
  if (direct) return direct;

  const callee = unwrapExpression(node);
  if (callee?.type !== "MemberExpression" || !callee.computed) return null;
  const property = unwrapExpression(callee.property);
  if (property?.type === "Literal") return String(property.value);
  if (property?.type === "TemplateLiteral" && property.expressions.length === 0) {
    return property.quasis[0]?.value.cooked ?? property.quasis[0]?.value.raw;
  }
  return null;
}

export default createRule(
  {
    ...architectureRuleMeta,
    docs: {
      ...architectureRuleMeta.docs,
      description: "Keep Software Factory HTTP calls inside dedicated API-hook boundaries.",
    },
    messages: {
      boundary:
        "{{name}} belongs in hooks/api. Components, query hooks, managers, and contexts must consume a typed API hook instead.",
    },
  },
  (context) => {
    const filename = normalizeFilename(context.filename);
    if (DEFAULT_ALLOWED_PATHS.some((pattern) => pattern.test(filename))) return {};

    return {
      CallExpression(node) {
        const name = restrictedCallName(node.callee);
        if (name === "fetch" || name === "useV2Api") {
          context.report({ node, messageId: "boundary", data: { name } });
        }
      },
    };
  },
);
