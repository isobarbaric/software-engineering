import {
  architectureRuleMeta,
  createRule,
  getStaticPropertyName,
  unwrapExpression,
} from "../../ast.js";

const TANSTACK_PACKAGES = new Set([
  "@tanstack/query-core",
  "@tanstack/react-query",
]);
const POSITIONAL_QUERY_KEY_METHODS = new Set([
  "getQueryData",
  "getQueryDefaults",
  "getQueryState",
  "setQueryData",
  "setQueryDefaults",
]);
const FUNCTION_HELPERS = new Set(["apply", "bind", "call"]);

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

function factoryMember(node) {
  let current = unwrapExpression(node);
  let memberCount = 0;

  while (current?.type === "MemberExpression") {
    if (current.optional || staticKeyName(current.property, current.computed) === null) {
      return null;
    }
    memberCount += 1;
    current = unwrapExpression(current.object);
  }

  if (
    memberCount === 0 ||
    current?.type !== "Identifier" ||
    !/queryKeys$/i.test(current.name)
  ) {
    return null;
  }

  return node;
}

function comesDirectlyFromFactory(node) {
  const expression = unwrapExpression(node);
  if (!expression) return false;

  if (expression.type === "MemberExpression") {
    return factoryMember(expression) !== null;
  }

  if (expression.type !== "CallExpression" || expression.optional) return false;
  const callee = unwrapExpression(expression.callee);
  if (callee?.type !== "MemberExpression") return false;
  const method = staticKeyName(callee.property, callee.computed);
  if (FUNCTION_HELPERS.has(method)) return false;
  return factoryMember(callee) !== null;
}

function importedApi(sourceCode, identifiers, node) {
  const variable = resolveVariable(sourceCode, node);
  return (
    variable &&
    isBindingUnchangedAt(variable, node) &&
    variable.identifiers.some((identifier) => identifiers.has(identifier))
  );
}

export default createRule(
  {
    ...architectureRuleMeta,
    docs: {
      ...architectureRuleMeta.docs,
      description:
        "Require TanStack Query keys to come visibly from owning query-key factories.",
    },
    messages: {
      factory:
        "Build this query key directly from an owning `*QueryKeys` factory without aliases, spreads, or conditional reconstruction.",
    },
  },
  (context) => {
    const sourceCode = context.sourceCode;
    const queryClientConstructors = new Set();
    const queryClientHooks = new Set();
    const queryClientNamespaces = new Set();
    const queryClientBindings = new Set();
    const queryClientParameterPropertiesByClass = new WeakMap();

    function owningInstanceClass(node) {
      let current = node.parent;
      while (current) {
        if (current.type === "StaticBlock") return null;
        if (current.parent?.type === "ClassBody") {
          return current.static ? null : current.parent.parent;
        }
        if (
          (current.type === "FunctionDeclaration" ||
            current.type === "FunctionExpression") &&
          current.parent?.type !== "MethodDefinition"
        ) {
          return null;
        }
        current = current.parent;
      }
      return null;
    }

    function queryClientParameterProperties(classNode) {
      const cached = queryClientParameterPropertiesByClass.get(classNode);
      if (cached) return cached;

      const properties = new Set();
      for (const member of classNode.body.body) {
        if (member.type !== "MethodDefinition" || member.kind !== "constructor") {
          continue;
        }
        for (const parameter of member.value.params) {
          if (parameter.type !== "TSParameterProperty") continue;
          const wrapped = parameter.parameter;
          const target =
            wrapped.type === "AssignmentPattern" ? wrapped.left : wrapped;
          if (
            target.type === "Identifier" &&
            isQueryClientType(target.typeAnnotation)
          ) {
            properties.add(target.name);
          }
        }
      }
      queryClientParameterPropertiesByClass.set(classNode, properties);
      return properties;
    }

    function isTypedQueryClientParameterProperty(node) {
      const expression = unwrapExpression(node);
      if (expression?.type !== "MemberExpression") return false;
      const object = unwrapExpression(expression.object);
      if (object?.type !== "ThisExpression") return false;
      const property = staticKeyName(expression.property, expression.computed);
      if (property === null) return false;
      const classNode = owningInstanceClass(expression);
      return (
        classNode !== null &&
        queryClientParameterProperties(classNode).has(property)
      );
    }

    function namespaceExpression(node) {
      const expression = unwrapExpression(node);
      if (expression?.type !== "Identifier") return false;
      return importedApi(sourceCode, queryClientNamespaces, expression);
    }

    function importedMember(node, name) {
      const expression = unwrapExpression(node);
      if (expression?.type === "Identifier") {
        const identifiers =
          name === "QueryClient" ? queryClientConstructors : queryClientHooks;
        return importedApi(sourceCode, identifiers, expression);
      }
      return (
        expression?.type === "MemberExpression" &&
        staticKeyName(expression.property, expression.computed) === name &&
        namespaceExpression(expression.object)
      );
    }

    function isQueryClientType(node) {
      const type =
        node?.type === "TSTypeAnnotation" ? node.typeAnnotation : node;
      if (type?.type !== "TSTypeReference") return false;
      const name = type.typeName;
      if (name.type === "Identifier") {
        return importedApi(sourceCode, queryClientConstructors, name);
      }
      return (
        name.type === "TSQualifiedName" &&
        name.right.name === "QueryClient" &&
        namespaceExpression(name.left)
      );
    }

    function isQueryClientIdentifier(node) {
      if (/queryClient$/i.test(node.name)) return true;
      return importedApi(sourceCode, queryClientBindings, node);
    }

    function isQueryClientExpression(node) {
      const expression = unwrapExpression(node);
      if (!expression) return false;
      if (expression.type === "Identifier") {
        return isQueryClientIdentifier(expression);
      }
      if (expression.type === "MemberExpression") {
        return (
          /queryClient$/i.test(
            staticKeyName(expression.property, expression.computed) ?? "",
          ) || isTypedQueryClientParameterProperty(expression)
        );
      }
      if (expression.type === "NewExpression") {
        return importedMember(expression.callee, "QueryClient");
      }
      return (
        expression.type === "CallExpression" &&
        importedMember(expression.callee, "useQueryClient")
      );
    }

    function registerImports(program) {
      for (const statement of program.body) {
        if (
          statement.type === "ImportDeclaration" &&
          TANSTACK_PACKAGES.has(statement.source.value)
        ) {
          for (const specifier of statement.specifiers) {
            if (specifier.type === "ImportSpecifier") {
              const imported = getStaticPropertyName(specifier.imported);
              if (imported === "QueryClient") {
                queryClientConstructors.add(specifier.local);
              }
              if (
                imported === "useQueryClient" &&
                statement.importKind !== "type" &&
                specifier.importKind !== "type"
              ) {
                queryClientHooks.add(specifier.local);
              }
            } else if (
              specifier.type === "ImportNamespaceSpecifier"
            ) {
              queryClientNamespaces.add(specifier.local);
            }
          }
        }

        if (
          statement.type === "TSImportEqualsDeclaration" &&
          statement.moduleReference.type === "TSExternalModuleReference" &&
          statement.moduleReference.expression.type === "Literal" &&
          TANSTACK_PACKAGES.has(statement.moduleReference.expression.value)
        ) {
          queryClientNamespaces.add(statement.id);
        }
      }
    }

    function registerVariable(node) {
      if (node.id.type !== "Identifier") return;
      const initializer = unwrapExpression(node.init);
      const isClient =
        isQueryClientType(node.id.typeAnnotation) ||
        (initializer?.type === "NewExpression" &&
          importedMember(initializer.callee, "QueryClient")) ||
        (initializer?.type === "CallExpression" &&
          importedMember(initializer.callee, "useQueryClient")) ||
        (initializer?.type === "Identifier" &&
          isQueryClientIdentifier(initializer));
      if (isClient) queryClientBindings.add(node.id);
    }

    function registerParameters(node) {
      for (const parameter of node.params) {
        const wrapped =
          parameter.type === "TSParameterProperty"
            ? parameter.parameter
            : parameter;
        const target =
          wrapped.type === "AssignmentPattern" ? wrapped.left : wrapped;
        if (
          target.type === "Identifier" &&
          isQueryClientType(target.typeAnnotation)
        ) {
          queryClientBindings.add(target);
        }
      }
    }

    function reportIfNotFactory(node) {
      if (!comesDirectlyFromFactory(node)) {
        context.report({ node, messageId: "factory" });
      }
    }

    return {
      Program: registerImports,
      ":function": registerParameters,
      VariableDeclarator: registerVariable,
      Property(node) {
        if (node.parent.type === "ObjectPattern") return;
        if (staticKeyName(node.key, node.computed) !== "queryKey") return;
        reportIfNotFactory(node.value);
      },
      AssignmentExpression(node) {
        const target = unwrapExpression(node.left);
        if (
          target?.type !== "MemberExpression" ||
          staticKeyName(target.property, target.computed) !== "queryKey"
        ) {
          return;
        }
        reportIfNotFactory(node.right);
      },
      CallExpression(node) {
        const callee = unwrapExpression(node.callee);
        if (callee?.type !== "MemberExpression") return;
        const method = staticKeyName(callee.property, callee.computed);
        if (!POSITIONAL_QUERY_KEY_METHODS.has(method)) return;
        if (!isQueryClientExpression(callee.object)) return;
        if (node.arguments.length > 0) reportIfNotFactory(node.arguments[0]);
      },
    };
  },
);
