import oneReactComponentPerFile from "./rules/general/one-react-component-per-file.js";
import dedicatedPropsInterface from "./rules/general/dedicated-props-interface.js";
import closedDomainValuesUseEnum from "./rules/general/closed-domain-values-use-enum.js";
import explicitReactHookGenerics from "./rules/general/explicit-react-hook-generics.js";
import preferExplicitControlFlow from "./rules/general/prefer-explicit-control-flow.js";
import explicitHandlerSignatures from "./rules/general/explicit-handler-signatures.js";
import noInlineBehaviorHandlers from "./rules/general/no-inline-behavior-handlers.js";
import noMirroredDerivedState from "./rules/general/no-mirrored-derived-state.js";
import noRedundantNullableOptionals from "./rules/general/no-redundant-nullable-optionals.js";
import queryKeyParametersNonNullable from "./rules/general/query-key-parameters-non-nullable.js";
import queryKeysFromFactories from "./rules/general/query-keys-from-factories.js";
import apiCallsThroughApiHooks from "./rules/software-factory/api-calls-through-api-hooks.js";
import documentTreeTraversalOnlyAtOwnerBoundary from "./rules/software-factory/document-tree-traversal-only-at-owner-boundary.js";

const generalRules = {
  "one-react-component-per-file": oneReactComponentPerFile,
  "dedicated-props-interface": dedicatedPropsInterface,
  "closed-domain-values-use-enum": closedDomainValuesUseEnum,
  "explicit-react-hook-generics": explicitReactHookGenerics,
  "prefer-explicit-control-flow": preferExplicitControlFlow,
  "explicit-handler-signatures": explicitHandlerSignatures,
  "no-inline-behavior-handlers": noInlineBehaviorHandlers,
  "no-mirrored-derived-state": noMirroredDerivedState,
  "no-redundant-nullable-optionals": noRedundantNullableOptionals,
  "query-key-parameters-non-nullable": queryKeyParametersNonNullable,
  "query-keys-from-factories": queryKeysFromFactories,
};

const softwareFactoryRules = {
  "software-factory/api-calls-through-api-hooks": apiCallsThroughApiHooks,
  "software-factory/document-tree-traversal-only-at-owner-boundary":
    documentTreeTraversalOnlyAtOwnerBoundary,
};

const plugin = {
  meta: {
    name: "@isobarbaric/code-contracts",
    version: "0.1.0",
  },
  rules: {
    ...generalRules,
    ...softwareFactoryRules,
  },
  configs: {},
};

const enabledRules = (rules) =>
  Object.fromEntries(
    Object.keys(rules).map((name) => [`contracts/${name}`, "error"]),
  );

plugin.configs.general = [
  {
    name: "contracts/general",
    files: ["**/*.{ts,tsx}"],
    plugins: {
      contracts: plugin,
    },
    rules: enabledRules(generalRules),
  },
];

plugin.configs["software-factory"] = [
  ...plugin.configs.general,
  {
    name: "contracts/software-factory",
    files: ["frontend/src/**/*.{ts,tsx}"],
    plugins: {
      contracts: plugin,
    },
    rules: enabledRules(softwareFactoryRules),
  },
];

export { generalRules, softwareFactoryRules };
export default plugin;
