import {
  architectureRuleMeta,
  containsJsx,
  createRule,
  getComponentDefinition,
  getTopLevelComponent,
  getCalleeName,
  getStaticPropertyName,
  isComponentTestFile,
  isPascalCase,
  unwrapExpression,
} from "../../ast.js";

const COMPONENT_WRAPPERS = new Set(["forwardRef", "memo"]);

function typeNameFromAnnotation(annotation) {
  const typeNode = annotation?.typeAnnotation ?? annotation;
  if (typeNode?.type === "TSTypeReference" && typeNode.typeName.type === "Identifier") {
    return typeNode.typeName.name;
  }
  return null;
}

function functionComponentAnnotation(component) {
  const annotation = component.node.id.typeAnnotation?.typeAnnotation;
  if (annotation?.type !== "TSTypeReference") return null;
  const typeName = annotation.typeName;
  const reactType =
    typeName.type === "Identifier"
      ? typeName.name
      : typeName.type === "TSQualifiedName"
        ? typeName.right.name
        : null;
  if (!new Set(["FC", "FunctionComponent"]).has(reactType)) return null;
  return annotation;
}

function propsTypeFromVariable(component) {
  const annotation = functionComponentAnnotation(component);
  return typeNameFromAnnotation(annotation?.typeArguments?.params[0]);
}

function variableHasProps(component) {
  const annotation = functionComponentAnnotation(component);
  return (annotation?.typeArguments?.params?.length ?? 0) > 0;
}

function staticMemberName(node) {
  const expression = unwrapExpression(node);
  if (expression?.type !== "MemberExpression") return null;
  if (!expression.computed) return getStaticPropertyName(expression.property);
  if (expression.property.type === "Literal") {
    return String(expression.property.value);
  }
  if (
    expression.property.type === "TemplateLiteral" &&
    expression.property.expressions.length === 0
  ) {
    return (
      expression.property.quasis[0]?.value.cooked ??
      expression.property.quasis[0]?.value.raw
    );
  }
  return null;
}

function wrapperName(node, aliases) {
  const name = getCalleeName(node) ?? staticMemberName(node);
  return aliases.get(name) ?? name;
}

function propsTypeFromWrapper(node, aliases) {
  const expression = unwrapExpression(node);
  if (expression?.type !== "CallExpression") return null;
  const name = wrapperName(expression.callee, aliases);
  const typeArguments = expression.typeArguments ?? expression.typeParameters;
  if (name === "forwardRef") {
    return typeNameFromAnnotation(typeArguments?.params?.[1]);
  }
  if (name === "memo") {
    return (
      typeNameFromAnnotation(typeArguments?.params?.[0]) ??
      propsTypeFromWrapper(expression.arguments[0], aliases)
    );
  }
  return null;
}

function wrapperHasProps(node, aliases) {
  const expression = unwrapExpression(node);
  if (expression?.type !== "CallExpression") return false;
  const name = wrapperName(expression.callee, aliases);
  const typeArguments = expression.typeArguments ?? expression.typeParameters;
  if (name === "forwardRef") {
    return (typeArguments?.params?.length ?? 0) >= 2;
  }
  if (name === "memo") {
    return (
      (typeArguments?.params?.length ?? 0) > 0 ||
      wrapperHasProps(expression.arguments[0], aliases)
    );
  }
  return false;
}

function propsTypeFromClass(component) {
  if (component.node.type !== "ClassDeclaration") return null;
  const typeArguments =
    component.node.superTypeArguments ?? component.node.superTypeParameters;
  return typeNameFromAnnotation(typeArguments?.params?.[0]);
}

function classHasProps(component) {
  if (component.node.type !== "ClassDeclaration") return false;
  const typeArguments =
    component.node.superTypeArguments ?? component.node.superTypeParameters;
  return (typeArguments?.params?.length ?? 0) > 0;
}

function propsTypeFromParameter(parameter) {
  const node = unwrapExpression(parameter);
  if (node?.type === "AssignmentPattern") {
    return typeNameFromAnnotation(node.left.typeAnnotation);
  }
  return typeNameFromAnnotation(node?.typeAnnotation);
}

function propsTypeName(component, aliases) {
  if (!component.fn) return propsTypeFromClass(component);
  return (
    propsTypeFromParameter(component.fn.params[0]) ??
    propsTypeFromVariable(component) ??
    propsTypeFromWrapper(component.initializer, aliases)
  );
}

function interfaceName(statement) {
  const declaration =
    statement.type === "ExportNamedDeclaration" ||
    statement.type === "ExportDefaultDeclaration"
      ? statement.declaration
      : statement;
  return declaration?.type === "TSInterfaceDeclaration"
    ? declaration.id.name
    : null;
}

function aliasedComponentDefinition(node, visitorKeys, aliases) {
  if (
    node.type !== "VariableDeclarator" ||
    node.id.type !== "Identifier" ||
    !isPascalCase(node.id.name)
  ) {
    return null;
  }

  function componentFunction(candidate) {
    const expression = unwrapExpression(candidate);
    if (
      expression?.type === "ArrowFunctionExpression" ||
      expression?.type === "FunctionExpression"
    ) {
      return expression;
    }
    if (
      expression?.type !== "CallExpression" ||
      !COMPONENT_WRAPPERS.has(wrapperName(expression.callee, aliases))
    ) {
      return null;
    }
    return componentFunction(expression.arguments[0]);
  }

  const fn = componentFunction(node.init);
  if (!fn || !containsJsx(fn.body, visitorKeys)) return null;
  return { name: node.id.name, node, fn, initializer: node.init };
}

function topLevelComponents(statement, visitorKeys, aliases) {
  const declaration =
    statement.type === "ExportNamedDeclaration" ||
    statement.type === "ExportDefaultDeclaration"
      ? statement.declaration
      : statement;
  if (!declaration) return [];
  if (declaration.type === "VariableDeclaration") {
    return declaration.declarations
      .map(
        (candidate) =>
          getComponentDefinition(candidate, visitorKeys) ??
          aliasedComponentDefinition(candidate, visitorKeys, aliases),
      )
      .filter(Boolean);
  }
  const component =
    getComponentDefinition(declaration, visitorKeys) ??
    getTopLevelComponent(statement, visitorKeys);
  return component ? [component] : [];
}

function componentWrapperAliases(program) {
  const aliases = new Map();
  const namespaces = new Set();

  for (const statement of program.body) {
    if (
      statement.type !== "ImportDeclaration" ||
      statement.source.value !== "react" ||
      statement.importKind === "type"
    ) {
      continue;
    }
    for (const specifier of statement.specifiers) {
      if (specifier.type === "ImportSpecifier") {
        if (specifier.importKind === "type") continue;
        const imported = getStaticPropertyName(specifier.imported);
        if (COMPONENT_WRAPPERS.has(imported)) {
          aliases.set(specifier.local.name, imported);
        }
      } else {
        namespaces.add(specifier.local.name);
      }
    }
  }

  const declarations = program.body.flatMap((statement) => {
    const declaration =
      statement.type === "ExportNamedDeclaration" ||
      statement.type === "ExportDefaultDeclaration"
        ? statement.declaration
        : statement;
    return declaration?.type === "VariableDeclaration"
      ? declaration.declarations
      : [];
  });
  let changed = true;
  while (changed) {
    changed = false;
    for (const declaration of declarations) {
      if (declaration.id.type !== "Identifier") continue;
      const initializer = unwrapExpression(declaration.init);
      if (initializer?.type === "Identifier") {
        const wrapper = aliases.get(initializer.name);
        if (wrapper && !aliases.has(declaration.id.name)) {
          aliases.set(declaration.id.name, wrapper);
          changed = true;
        }
        if (
          namespaces.has(initializer.name) &&
          !namespaces.has(declaration.id.name)
        ) {
          namespaces.add(declaration.id.name);
          changed = true;
        }
        continue;
      }
      if (
        initializer?.type !== "MemberExpression" ||
        initializer.object.type !== "Identifier" ||
        !namespaces.has(initializer.object.name)
      ) {
        continue;
      }
      const wrapper = staticMemberName(initializer);
      if (COMPONENT_WRAPPERS.has(wrapper) && !aliases.has(declaration.id.name)) {
        aliases.set(declaration.id.name, wrapper);
        changed = true;
      }
    }
  }
  return aliases;
}

export default createRule(
  {
    ...architectureRuleMeta,
    docs: {
      ...architectureRuleMeta.docs,
      description: "Require a same-file ComponentNameProps interface for component props.",
    },
    messages: {
      missing:
        "{{name}} must use a dedicated same-file interface named {{expected}} for its props.",
    },
  },
  (context) => {
    if (isComponentTestFile(context.filename)) return {};
    const sourceCode = context.sourceCode;
    return {
      Program(node) {
        const aliases = componentWrapperAliases(node);
        const interfaces = new Set(
          node.body
            .map(interfaceName)
            .filter(Boolean),
        );

        for (const statement of node.body) {
          for (const component of topLevelComponents(
            statement,
            sourceCode.visitorKeys,
            aliases,
          )) {
            const hasFunctionProps = component.fn?.params.length > 0;
            const hasClassProps = classHasProps(component);
            const hasVariableProps = variableHasProps(component);
            const hasWrapperProps = wrapperHasProps(
              component.initializer,
              aliases,
            );
            if (
              !hasFunctionProps &&
              !hasClassProps &&
              !hasVariableProps &&
              !hasWrapperProps
            ) {
              continue;
            }
            const expected = `${component.name}Props`;
            if (
              propsTypeName(component, aliases) !== expected ||
              !interfaces.has(expected)
            ) {
              context.report({
                node: component.node,
                messageId: "missing",
                data: { name: component.name, expected },
              });
            }
          }
        }
      },
    };
  },
);
