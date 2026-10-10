import {
  architectureRuleMeta,
  createRule,
  getStaticPropertyName,
  unwrapExpression,
} from "../../ast.js";

const REACT_APIS = new Set(["useEffect", "useLayoutEffect", "useState"]);
const EFFECT_APIS = new Set(["useEffect", "useLayoutEffect"]);
const STABLE_GLOBALS = new Set([
  "BigInt",
  "Boolean",
  "Infinity",
  "Intl",
  "JSON",
  "Math",
  "NaN",
  "Number",
  "String",
  "Symbol",
  "undefined",
]);
const EXTERNAL_GLOBALS = new Set([
  "caches",
  "crypto",
  "devicePixelRatio",
  "document",
  "globalThis",
  "history",
  "indexedDB",
  "innerHeight",
  "innerWidth",
  "localStorage",
  "location",
  "navigator",
  "outerHeight",
  "outerWidth",
  "performance",
  "screen",
  "scrollX",
  "scrollY",
  "sessionStorage",
  "visualViewport",
  "window",
]);
const FUNCTION_NODES = new Set([
  "ArrowFunctionExpression",
  "FunctionDeclaration",
  "FunctionExpression",
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

function isStableVariable(variable) {
  return (
    variable.scope.type === "global" ||
    variable.scope.type === "module" ||
    variable.defs.some((definition) => definition.type === "ImportBinding")
  );
}

function isInside(node, container) {
  return (
    node.range[0] >= container.range[0] && node.range[1] <= container.range[1]
  );
}

function constInitializerInside(variable, callback, useNode) {
  if (!isBindingUnchangedAt(variable, useNode)) return null;

  for (const definition of variable.defs) {
    const declaration = definition.node;
    if (
      definition.type === "Variable" &&
      declaration?.type === "VariableDeclarator" &&
      declaration.init &&
      declaration.parent?.type === "VariableDeclaration" &&
      declaration.parent.kind === "const" &&
      declaration.range[0] < useNode.range[0] &&
      isInside(declaration, callback)
    ) {
      return declaration.init;
    }
  }
  return null;
}

function dependencyCovers(reference, dependency) {
  return (
    reference.variable === dependency.variable &&
    dependency.path.length <= reference.path.length &&
    dependency.path.every((part, index) => reference.path[index] === part)
  );
}

export default createRule(
  {
    ...architectureRuleMeta,
    docs: {
      ...architectureRuleMeta.docs,
      description:
        "Reject React effects that mirror structurally pure dependency-derived values into state.",
    },
    messages: {
      derived:
        "{{state}} is derived from this effect's dependencies. Compute it during render instead of synchronizing duplicate state.",
    },
  },
  (context) => {
    const sourceCode = context.sourceCode;
    const visitorKeys = sourceCode.visitorKeys;
    const apiByIdentifier = new Map();
    const namespaceIdentifiers = new Set();
    const stateSetterByVariable = new Map();

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
      if (!REACT_APIS.has(name)) return null;
      return isReactNamespaceExpression(expression.object) ? name : null;
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
              if (REACT_APIS.has(imported)) {
                apiByIdentifier.set(specifier.local, imported);
              }
            } else {
              namespaceIdentifiers.add(specifier.local);
            }
          }
        }

        if (
          statement.type === "TSImportEqualsDeclaration" &&
          statement.moduleReference.type === "TSExternalModuleReference" &&
          statement.moduleReference.expression.type === "Literal" &&
          statement.moduleReference.expression.value === "react"
        ) {
          namespaceIdentifiers.add(statement.id);
        }
      }
    }

    function registerObjectPattern(pattern, source) {
      if (!isReactNamespaceExpression(source)) return false;

      let changed = false;
      for (const property of pattern.properties) {
        if (property.type !== "Property") continue;
        const imported = staticKeyName(property.key, property.computed);
        const local = patternIdentifier(property.value);
        if (!local) continue;
        if (imported === "default" && isReactRequire(sourceCode, source)) {
          if (!namespaceIdentifiers.has(local)) changed = true;
          namespaceIdentifiers.add(local);
          continue;
        }
        if (!REACT_APIS.has(imported)) continue;
        if (!apiByIdentifier.has(local)) changed = true;
        apiByIdentifier.set(local, imported);
      }
      return changed;
    }

    function registerReactAlias(declaration) {
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

    function registerTopLevelAliases(program) {
      const declarations = program.body.flatMap((statement) =>
        statement.type === "VariableDeclaration" ? statement.declarations : [],
      );
      let changed = true;
      while (changed) {
        changed = false;
        for (const declaration of declarations) {
          changed = registerReactAlias(declaration) || changed;
        }
      }
    }

    function setterForIdentifier(node) {
      const variable = resolveVariable(sourceCode, node);
      if (!variable || !isBindingUnchangedAt(variable, node)) return null;
      return stateSetterByVariable.get(variable) ?? null;
    }

    function registerStateSetter(declaration) {
      if (
        declaration.id.type !== "ArrayPattern" ||
        declaration.id.elements[0]?.type !== "Identifier" ||
        declaration.id.elements[1]?.type !== "Identifier"
      ) {
        return;
      }
      const initializer = unwrapExpression(declaration.init);
      if (
        initializer?.type !== "CallExpression" ||
        apiForCallee(initializer.callee) !== "useState"
      ) {
        return;
      }
      const setter = resolveVariable(sourceCode, declaration.id.elements[1]);
      if (setter) {
        stateSetterByVariable.set(setter, {
          state: declaration.id.elements[0].name,
        });
      }
    }

    function registerSetterAlias(declaration) {
      if (
        declaration.id.type !== "Identifier" ||
        unwrapExpression(declaration.init)?.type !== "Identifier"
      ) {
        return;
      }
      const initializer = unwrapExpression(declaration.init);
      const setter = setterForIdentifier(initializer);
      const alias = resolveVariable(sourceCode, declaration.id);
      if (setter && alias) stateSetterByVariable.set(alias, setter);
    }

    function resolveEffectCallback(node, seen = new Set()) {
      const expression = unwrapExpression(node);
      if (
        expression?.type === "ArrowFunctionExpression" ||
        expression?.type === "FunctionExpression"
      ) {
        return expression;
      }
      if (expression?.type !== "Identifier") return null;

      const variable = resolveVariable(sourceCode, expression);
      if (
        !variable ||
        seen.has(variable) ||
        !isBindingUnchangedAt(variable, expression)
      ) {
        return null;
      }
      seen.add(variable);

      for (const definition of variable.defs) {
        if (
          definition.type === "FunctionName" &&
          definition.node?.type === "FunctionDeclaration"
        ) {
          return definition.node;
        }
        if (definition.type === "Variable") {
          const initializer = definition.node?.init;
          const callback = resolveEffectCallback(initializer, seen);
          if (callback) return callback;
        }
      }
      return null;
    }

    function analyzeReference(node, callback, useNode, seenVariables) {
      const expression = unwrapExpression(node);
      if (expression?.type === "Identifier") {
        const variable = resolveVariable(sourceCode, expression);
        if (!variable) {
          if (STABLE_GLOBALS.has(expression.name)) {
            return { pure: true, references: [] };
          }
          if (EXTERNAL_GLOBALS.has(expression.name)) {
            return { pure: false, references: [] };
          }
          return {
            pure: true,
            references: [{ variable: `unresolved:${expression.name}`, path: [] }],
          };
        }
        if (isStableVariable(variable)) {
          return { pure: true, references: [] };
        }

        const initializer = constInitializerInside(variable, callback, useNode);
        if (initializer) {
          if (seenVariables.has(variable)) {
            return { pure: false, references: [] };
          }
          const nextSeen = new Set(seenVariables);
          nextSeen.add(variable);
          return analyzeExpression(initializer, callback, useNode, nextSeen);
        }

        return {
          pure: true,
          references: [{ variable, path: [] }],
        };
      }

      if (expression?.type !== "MemberExpression") {
        return { pure: false, references: [] };
      }
      const property = staticKeyName(expression.property, expression.computed);
      if (property === null) return { pure: false, references: [] };
      const object = analyzeReference(
        expression.object,
        callback,
        useNode,
        seenVariables,
      );
      if (!object.pure) return object;
      return {
        pure: true,
        references: object.references.map((reference) => ({
          variable: reference.variable,
          path: [...reference.path, property],
        })),
      };
    }

    function mergeAnalyses(analyses) {
      if (analyses.some((analysis) => !analysis.pure)) {
        return { pure: false, references: [] };
      }
      return {
        pure: true,
        references: analyses.flatMap((analysis) => analysis.references),
      };
    }

    function analyzeExpression(node, callback, useNode, seenVariables = new Set()) {
      const expression = unwrapExpression(node);
      if (!expression) return { pure: false, references: [] };

      if (expression.type === "Identifier" || expression.type === "MemberExpression") {
        return analyzeReference(expression, callback, useNode, seenVariables);
      }
      if (expression.type === "Literal" || expression.type === "MetaProperty") {
        return { pure: true, references: [] };
      }
      if (expression.type === "TemplateLiteral") {
        return mergeAnalyses(
          expression.expressions.map((child) =>
            analyzeExpression(child, callback, useNode, seenVariables),
          ),
        );
      }
      if (expression.type === "ArrayExpression") {
        return mergeAnalyses(
          expression.elements
            .filter(Boolean)
            .map((element) =>
              analyzeExpression(
                element.type === "SpreadElement" ? element.argument : element,
                callback,
                useNode,
                seenVariables,
              ),
            ),
        );
      }
      if (expression.type === "ObjectExpression") {
        const analyses = [];
        for (const property of expression.properties) {
          if (property.type === "SpreadElement") {
            analyses.push(
              analyzeExpression(property.argument, callback, useNode, seenVariables),
            );
            continue;
          }
          if (property.type !== "Property" || property.kind !== "init" || property.method) {
            return { pure: false, references: [] };
          }
          if (property.computed) {
            analyses.push(
              analyzeExpression(property.key, callback, useNode, seenVariables),
            );
          }
          analyses.push(
            analyzeExpression(property.value, callback, useNode, seenVariables),
          );
        }
        return mergeAnalyses(analyses);
      }
      if (
        expression.type === "BinaryExpression" ||
        expression.type === "LogicalExpression"
      ) {
        return mergeAnalyses([
          analyzeExpression(expression.left, callback, useNode, seenVariables),
          analyzeExpression(expression.right, callback, useNode, seenVariables),
        ]);
      }
      if (expression.type === "ConditionalExpression") {
        return mergeAnalyses([
          analyzeExpression(expression.test, callback, useNode, seenVariables),
          analyzeExpression(expression.consequent, callback, useNode, seenVariables),
          analyzeExpression(expression.alternate, callback, useNode, seenVariables),
        ]);
      }
      if (expression.type === "SequenceExpression") {
        return mergeAnalyses(
          expression.expressions.map((child) =>
            analyzeExpression(child, callback, useNode, seenVariables),
          ),
        );
      }
      if (expression.type === "UnaryExpression" && expression.operator !== "delete") {
        return analyzeExpression(
          expression.argument,
          callback,
          useNode,
          seenVariables,
        );
      }

      return { pure: false, references: [] };
    }

    function dependencyReference(node, callback, useNode) {
      const analysis = analyzeReference(node, callback, useNode, new Set());
      if (!analysis.pure || analysis.references.length > 1) return undefined;
      return analysis.references[0] ?? null;
    }

    function dependenciesFor(node, callback, useNode) {
      const expression = unwrapExpression(node);
      if (expression?.type !== "ArrayExpression") return null;
      const dependencies = [];
      for (const element of expression.elements) {
        if (!element || element.type === "SpreadElement") return null;
        const dependency = dependencyReference(element, callback, useNode);
        if (dependency === undefined) return null;
        if (dependency) dependencies.push(dependency);
      }
      return dependencies;
    }

    function inspectEffect(effectCall, callback) {
      const dependencies = dependenciesFor(
        effectCall.arguments[1],
        callback,
        effectCall,
      );
      if (!dependencies) return;

      function visit(node) {
        if (!node || typeof node.type !== "string") return;
        if (node !== callback && FUNCTION_NODES.has(node.type)) return;

        if (node.type === "CallExpression") {
          const callee = unwrapExpression(node.callee);
          if (callee?.type === "Identifier") {
            const setter = setterForIdentifier(callee);
            if (setter && node.arguments.length === 1) {
              const analysis = analyzeExpression(
                node.arguments[0],
                callback,
                node,
              );
              if (
                analysis.pure &&
                analysis.references.length > 0 &&
                analysis.references.every((reference) =>
                  dependencies.some((dependency) =>
                    dependencyCovers(reference, dependency),
                  ),
                )
              ) {
                context.report({
                  node,
                  messageId: "derived",
                  data: { state: setter.state },
                });
              }
            }
          }
        }

        for (const key of visitorKeys[node.type] ?? []) {
          const value = node[key];
          if (Array.isArray(value)) {
            for (const child of value) visit(child);
          } else {
            visit(value);
          }
        }
      }

      visit(callback.body);
    }

    return {
      Program(node) {
        registerImports(node);
        registerTopLevelAliases(node);
      },
      VariableDeclarator(node) {
        registerReactAlias(node);
        registerStateSetter(node);
        registerSetterAlias(node);
      },
      CallExpression(node) {
        if (!EFFECT_APIS.has(apiForCallee(node.callee)) || node.arguments.length < 2) {
          return;
        }
        const callback = resolveEffectCallback(node.arguments[0]);
        if (callback) inspectEffect(node, callback);
      },
    };
  },
);
