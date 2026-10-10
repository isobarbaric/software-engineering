import {
  architectureRuleMeta,
  createRule,
  getStaticPropertyName,
  unwrapExpression,
} from "../../ast.js";

const GENERIC_REACT_APIS = new Set([
  "createContext",
  "use",
  "useActionState",
  "useCallback",
  "useContext",
  "useDebugValue",
  "useDeferredValue",
  "useEffectEvent",
  "useImperativeHandle",
  "useMemo",
  "useOptimistic",
  "useReducer",
  "useRef",
  "useState",
  "useSyncExternalStore",
]);

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

function isReactRequire(sourceCode, node) {
  const expression = unwrapExpression(node);
  return (
    expression?.type === "CallExpression" &&
    expression.callee.type === "Identifier" &&
    expression.callee.name === "require" &&
    resolveVariable(sourceCode, expression.callee) === null &&
    expression.arguments.length === 1 &&
    expression.arguments[0].type === "Literal" &&
    expression.arguments[0].value === "react"
  );
}

function patternIdentifier(node) {
  if (node?.type === "Identifier") return node;
  if (node?.type === "AssignmentPattern" && node.left.type === "Identifier") {
    return node.left;
  }
  return null;
}

export default createRule(
  {
    ...architectureRuleMeta,
    docs: {
      ...architectureRuleMeta.docs,
      description: "Require explicit type arguments on generic React APIs.",
    },
    messages: {
      missing: "Add an explicit type argument to React.{{name}}.",
    },
  },
  (context) => {
    const sourceCode = context.sourceCode;
    const apiByIdentifier = new Map();
    const namespaceIdentifiers = new Set();

    function apiForIdentifier(node) {
      const variable = resolveVariable(sourceCode, node);
      if (!variable || !isBindingUnchangedAt(variable, node)) return null;
      for (const identifier of variable.identifiers) {
        const api = apiByIdentifier.get(identifier);
        if (api) return api;
      }
      return null;
    }

    function isReactNamespace(node) {
      const variable = resolveVariable(sourceCode, node);
      if (!variable || !isBindingUnchangedAt(variable, node)) return false;
      return variable.identifiers.some((identifier) =>
        namespaceIdentifiers.has(identifier),
      );
    }

    function isReactDefaultInterop(node) {
      const expression = unwrapExpression(node);
      if (
        expression?.type !== "MemberExpression" ||
        staticKeyName(expression.property, expression.computed) !== "default"
      ) {
        return false;
      }

      const object = unwrapExpression(expression.object);
      return (
        isReactRequire(sourceCode, object) ||
        (object?.type === "Identifier" && isReactNamespace(object))
      );
    }

    function isReactNamespaceExpression(node) {
      const expression = unwrapExpression(node);
      return (
        isReactRequire(sourceCode, expression) ||
        isReactDefaultInterop(expression) ||
        (expression?.type === "Identifier" && isReactNamespace(expression))
      );
    }

    function memberApi(node) {
      const expression = unwrapExpression(node);
      if (expression?.type !== "MemberExpression") return null;
      const name = staticKeyName(expression.property, expression.computed);
      if (!GENERIC_REACT_APIS.has(name)) return null;
      const object = unwrapExpression(expression.object);
      if (isReactNamespaceExpression(object)) return name;
      return null;
    }

    function apiForCallee(node) {
      const callee = unwrapExpression(node);
      if (callee?.type === "Identifier") return apiForIdentifier(callee);
      return memberApi(callee);
    }

    function registerImports(program) {
      for (const statement of program.body) {
        if (
          statement.type === "ImportDeclaration" &&
          statement.source.value === "react" &&
          statement.importKind !== "type"
        ) {
          for (const specifier of statement.specifiers) {
            if (specifier.importKind === "type") continue;
            if (specifier.type === "ImportSpecifier") {
              const imported = getStaticPropertyName(specifier.imported);
              if (GENERIC_REACT_APIS.has(imported)) {
                apiByIdentifier.set(specifier.local, imported);
              }
            } else {
              namespaceIdentifiers.add(specifier.local);
            }
          }
        }

        if (
          statement.type === "TSImportEqualsDeclaration" &&
          statement.importKind !== "type" &&
          statement.moduleReference.type === "TSExternalModuleReference" &&
          statement.moduleReference.expression.type === "Literal" &&
          statement.moduleReference.expression.value === "react"
        ) {
          namespaceIdentifiers.add(statement.id);
        }
      }
    }

    function registerObjectPattern(pattern, source) {
      const expression = unwrapExpression(source);
      if (!isReactNamespaceExpression(expression)) return false;

      let changed = false;
      for (const property of pattern.properties) {
        if (property.type !== "Property") continue;
        const imported = staticKeyName(property.key, property.computed);
        const local = patternIdentifier(property.value);
        if (!local) continue;
        if (
          imported === "default" &&
          (isReactRequire(sourceCode, expression) ||
            (expression?.type === "Identifier" &&
              isReactNamespace(expression)))
        ) {
          if (!namespaceIdentifiers.has(local)) changed = true;
          namespaceIdentifiers.add(local);
          continue;
        }
        if (!GENERIC_REACT_APIS.has(imported)) continue;
        if (!apiByIdentifier.has(local)) changed = true;
        apiByIdentifier.set(local, imported);
      }
      return changed;
    }

    function registerVariable(declaration) {
      const initializer = unwrapExpression(declaration.init);
      if (!initializer) return false;

      if (declaration.id.type === "ObjectPattern") {
        return registerObjectPattern(declaration.id, initializer);
      }
      if (declaration.id.type !== "Identifier") return false;

      if (
        isReactRequire(sourceCode, initializer) ||
        isReactDefaultInterop(initializer)
      ) {
        if (namespaceIdentifiers.has(declaration.id)) return false;
        namespaceIdentifiers.add(declaration.id);
        return true;
      }

      if (initializer.type === "Identifier") {
        const api = apiForIdentifier(initializer);
        if (api) {
          if (apiByIdentifier.has(declaration.id)) return false;
          apiByIdentifier.set(declaration.id, api);
          return true;
        }
        if (isReactNamespace(initializer)) {
          if (namespaceIdentifiers.has(declaration.id)) return false;
          namespaceIdentifiers.add(declaration.id);
          return true;
        }
      }

      const api = memberApi(initializer);
      if (!api || apiByIdentifier.has(declaration.id)) return false;
      apiByIdentifier.set(declaration.id, api);
      return true;
    }

    function registerAliases(program) {
      const declarations = program.body.flatMap((statement) =>
        statement.type === "VariableDeclaration" ? statement.declarations : [],
      );
      let changed = true;
      while (changed) {
        changed = false;
        for (const declaration of declarations) {
          changed = registerVariable(declaration) || changed;
        }
      }
    }

    return {
      Program(node) {
        registerImports(node);
        registerAliases(node);
      },
      VariableDeclarator: registerVariable,
      CallExpression(node) {
        const name = apiForCallee(node.callee);
        if (!name) return;
        const typeArguments = node.typeArguments ?? node.typeParameters;
        if (!typeArguments?.params?.length) {
          context.report({ node, messageId: "missing", data: { name } });
        }
      },
    };
  },
);
