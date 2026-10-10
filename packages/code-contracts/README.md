# `@isobarbaric/code-contracts`

Deterministic code contracts extracted from recurring review feedback.
The plugin deliberately separates portable React/TypeScript contracts from
Software Factory repository contracts.

## Presets

```js
import codeContracts from "@isobarbaric/code-contracts";

export default [
  ...codeContracts.configs.general,
  // Or, only inside sf-platform:
  // ...codeContracts.configs["software-factory"],
];
```

`general` contains no Software Factory paths, imports, or vocabulary.
`software-factory` includes `general` and adds checks whose meaning depends on
the `sf-platform` architecture.

Rules are exposed under the `contracts` ESLint namespace, for example
`contracts/dedicated-props-interface`.

Run the local CLI against another checkout without installing or publishing the
package:

```sh
pnpm contracts:check \
  --repo /path/to/sf-platform \
  --changed-since origin/main \
  --profile software-factory
```

`--changed-since` checks committed branch changes plus staged, unstaged, and
untracked files since the merge base. `--staged` reads the exact blobs in Git's
index, so a partially staged file is checked as it will be committed. `--all`
checks every tracked or untracked TypeScript and Python source file. Exactly one
scope is required. The CLI loads ESLint and Python AST contracts directly from
this checkout; it does not modify the target repository or require a published
package.

Python contracts use Python's own AST rather than pretending backend contracts
are ESLint rules. The lower-level Python entrypoint remains available for a
file or directory:

```sh
PYTHONPATH=packages/code-contracts/python \
  python3 -m code_contracts backend/software_factory
```

## General rules

| Rule | Deterministic contract |
| --- | --- |
| `one-react-component-per-file` | A production module declares at most one React component, including nested and locally attached compound components. |
| `dedicated-props-interface` | A component with props uses a same-file `interface ComponentNameProps`; aliases, inline objects, borrowed props, and inferred utility types do not satisfy the contract. |
| `closed-domain-values-use-enum` | Client-owned closed string vocabularies use enums, including scalar unions, discriminated unions, `as const` sets, and multi-value branches. |
| `explicit-react-hook-generics` | Generic React APIs provide an explicit type argument; coverage includes every current generic built-in hook plus `createContext`. |
| `prefer-explicit-control-flow` | Branching is expressed with `if`/`else`, and strict equality chains over one stable subject use `switch`. |
| `explicit-handler-signatures` | Public `onX` callbacks show the complete function signature; explicitly typed `handleX` implementations do not borrow or derive it. |
| `no-inline-behavior-handlers` | JSX `onX` props receive a function reference or a zero-parameter `() => setX(...)` state update. |
| `no-mirrored-derived-state` | A React effect does not copy a structurally pure expression of its dependencies into state. |
| `no-redundant-nullable-optionals` | A property does not encode absence as both optional and nullable. |
| `query-key-parameters-non-nullable` | Query-key factory parameters are required and exclude `null` and `undefined`. |
| `query-keys-from-factories` | Query keys originate visibly and directly from owning `*QueryKeys` factories. |

### Locked general-rule behavior

`one-react-component-per-file` recognizes function, arrow, `memo`,
`forwardRef`, class, JSX, and `createElement` component definitions. It rejects
components declared inside other components and components defined directly on
a static property. Attaching an imported component to a namespace is assembly,
not a second declaration, and remains valid. Test, spec, and story files are
exempt.

`dedicated-props-interface` requires the interface to be declared in the same
module and named after the component. The interface may be exported, generic,
or extend native/platform contracts. `React.FC<ComponentProps>`,
`forwardRef<Element, ComponentProps>`, and class components are supported.
Components without props and test, spec, or story files are exempt.

`closed-domain-values-use-enum` rejects string-literal unions, string
discriminants shared by object-union variants, closed string arrays asserted
with `as const`, and comparisons or switches that branch on two or more string
values of the same bare identifier. Enum members are valid discriminants. The
rule does not classify member expressions such as external response fields as
client-owned domains. Ordinary copy, JSX attributes, style values, import
paths, URLs, single strings, tests, stories, and generated files are outside
the rule's scope.

`explicit-react-hook-generics` resolves actual bindings from the `react`
package, including named-import aliases, default and namespace imports,
TypeScript import-equals declarations, CommonJS requires, and static aliases.
It covers `createContext`, `use`, `useActionState`, `useCallback`, `useContext`,
`useDebugValue`, `useDeferredValue`, `useEffectEvent`, `useImperativeHandle`,
`useMemo`, `useOptimistic`, `useReducer`, `useRef`, `useState`, and
`useSyncExternalStore`. There are no filename exemptions. Unrelated functions
with the same names and React APIs that do not accept type arguments are not
reported.

`prefer-explicit-control-flow` rejects conditional expressions, logical
assignment, and short-circuit expressions used directly as statements or JSX
branches. Boolean logic in conditions and ordinary data expressions remains
valid. An `if`/`else if` chain with two or more strict-equality comparisons on
the same variable-like identifier or static member must use `switch`;
enum/constant-shaped operands are treated as values rather than subjects.
Compound predicates, ranges, calls, dynamic properties, and mixed subjects are
not inferred. Guard clauses remain valid, and there are no filename exemptions.

`explicit-handler-signatures` requires an `onX` property to contain a complete
function type, including explicit parameter and return types. Callback aliases,
React handler aliases, method syntax, union wrappers, indexed access, `typeof`,
`Parameters`, and `ReturnType` do not satisfy the contract. Local `handleX`
implementations may rely on inference; when they include type annotations,
those annotations must be direct. There are no filename exemptions.

`no-inline-behavior-handlers` uses a closed allowlist. An `onX` JSX prop may
receive an identifier or member function reference, or a synchronous,
zero-parameter arrow whose entire body is one direct call to an identifier
named `setX`. Setter arguments may contain data expressions, but not functions,
nested calls, construction, mutation, assignment, sequencing, or awaiting.
Event-parameter arrows, functional updaters, handler factories, `.bind`, async
functions, and multi-step procedures must be extracted. There are no filename
exemptions.

`no-mirrored-derived-state` resolves actual `useState`, `useEffect`, and
`useLayoutEffect` bindings from React, including supported import, require, and
static-alias forms. It rejects direct copies and structurally pure projections
such as member reads, templates, objects, arrays, arithmetic, conditionals,
and nullish fallbacks when every reactive input is covered by the dependency
array. A root dependency covers its static member reads. Pure `const` aliases
inside the effect are expanded. Function calls, construction, awaiting,
functional state updaters, nested subscription callbacks, constant resets,
external browser reads, dynamic properties, and incomplete dependency sets are
not classified as mirrored derived state. There are no filename exemptions.

`no-redundant-nullable-optionals` requires every optional property to have an
explicitly non-nullish value type. It rejects top-level `null`, `undefined`,
`void`, `any`, and `unknown` in interface and type-literal properties, mapped
properties, class fields, accessor properties, and constructor parameter
properties. Nullable nested data and nullable callback return values remain
valid because the property value itself is present. The syntax-only rule does
not expand named type aliases. Patch and update names receive no implicit
exemption: an intentional three-state wire field must use a line-level ESLint
suppression explaining that omission preserves the value and `null` clears it.
There are no filename exemptions.

`query-key-parameters-non-nullable` checks function-valued properties anywhere
inside object trees whose root variable name ends in `queryKeys`, including
objects passed through a factory builder. Optional parameters and explicit
top-level `null`, `undefined`, `void`, `any`, or `unknown` types are rejected. A
required filter object may contain nullable or optional fields because the
object itself remains a present cache-identity segment. A default may normalize
`undefined` to a concrete value, but may not introduce or preserve `null`.
Named type aliases are not expanded; type-aware enforcement is outside this
syntax-only rule's contract. There are no filename exemptions.

`query-keys-from-factories` requires each `queryKey` property to be a direct
call or static member rooted at an owning `*QueryKeys` object. It rejects inline
arrays, local aliases, spreads, dynamic member access, optional access,
conditional selection, unrelated builders, and post-processing of returned
keys. Destructuring is not construction, while later assignment to a
`queryKey` property remains governed. The same contract applies to the first
argument of TanStack Query v5's
`getQueryData`, `getQueryState`, `setQueryData`, `getQueryDefaults`, and
`setQueryDefaults` methods when the receiver is demonstrably a QueryClient.
QueryClient bindings are recognized through `useQueryClient()`, `new
QueryClient()`, explicit QueryClient parameter types, binding aliases, and
conventional names ending in `queryClient`. There are no filename exemptions.

## Software Factory rules

| Rule | Repository contract |
| --- | --- |
| `software-factory/api-calls-through-api-hooks` | `fetch` and `useV2Api` stay in `hooks/api` or approved transport infrastructure. |
| `software-factory/document-tree-traversal-only-at-owner-boundary` | Document-tree traversal stays in approved owner modules; downstream consumers use owner-built indexes or derived results. |

`software-factory/document-tree-traversal-only-at-owner-boundary` applies only
to Software Factory's document-tree domain. It recognizes the canonical
read-traversal APIs from `@/lib/document_navigator`, their aliases and namespace
access, explicit document-tree traversal declarations, and traversal methods on
objects visibly named as document trees. Approved owner modules are listed
explicitly in the rule. Adding another owner is therefore an architecture
change that must update the contract rather than relying on component names or
directory folklore. Tests and stories are not generally exempt; the canonical
tree-utility test is an owner-boundary test and is listed explicitly.

## General Python rules

| Rule | Deterministic contract |
| --- | --- |
| `no-tuple-service-results` | Public service methods do not return positional tuple products; named multi-value result envelopes are Pydantic models. |
| `no-generic-domain-exceptions` | Services and repositories raise domain-specific failures instead of `ValueError`, `RuntimeError`, or `Exception`. |
| `repositories-do-not-control-transactions` | Repositories may flush work but may not begin, commit, or roll back SQLAlchemy transactions. |
| `sqlalchemy-query-columns-use-model-attributes` | SQLAlchemy column-selection APIs receive symbolic model attributes rather than string column names. |

`no-tuple-service-results` applies to public methods on classes whose names end
in `Service`, including classes that inherit a locally declared service class.
It rejects tuple annotations recursively, direct and locally propagated tuple
values, and local `*Result` classes that do not inherit Pydantic's `BaseModel`.
This includes dataclasses, `NamedTuple`, `TypedDict`, plain result classes, and
their functional declaration forms. Private helpers remain implementation
details. Single entities, scalar values, collections, `None`, and Pydantic
result models remain valid. There are no filename exemptions. A required
framework override must be exempted by its exact `Class.method` identity.

`no-generic-domain-exceptions` covers sync, async, public, private, static, and
class methods on service and repository implementations, including local and
imported boundary subclasses. It resolves builtin namespaces and aliases while
respecting lexical shadowing. Bare re-raises, `NotImplementedError`, specific
domain/library exceptions, Pydantic validators, and explicitly configured CLI
or configuration parsing paths remain valid. Test files are not exempt.

`repositories-do-not-control-transactions` follows actual `Session` and
`AsyncSession` annotations into repository attributes and local aliases. It
rejects `begin`, `begin_nested`, `commit`, and `rollback`, including awaited
calls and context managers. `add`, `delete`, `merge`, `flush`, `refresh`,
`expire`, queries, and statement execution remain valid. Objects that merely
have similarly named methods are not treated as SQLAlchemy sessions. Unit of
work and transaction-manager boundaries are explicit owners, not suppressions.

`sqlalchemy-query-columns-use-model-attributes` resolves SQLAlchemy imports,
aliases, namespaces, statement chains, legacy `Session.query` calls, and loader
options. It rejects strings in configured column-selection functions and
methods while allowing foreign-key targets, relationship forward references,
explicit `text` and `literal_column` boundaries, labels, defaults, predicate
values, and update values.

## Software Factory Python rules

| Rule | Repository contract |
| --- | --- |
| `scoped-responses-include-scope-ids` | Explicitly organization-scoped responses serialize a required `organization_id: UUID`; explicitly project-scoped responses serialize both `organization_id: UUID` and `project_id: UUID`. |

`scoped-responses-include-scope-ids` never infers scope from a suggestive class
or field name. Scope is selected explicitly by canonical base, exact model
identity, or response package. Fields may be direct or locally inherited, but
must be required, non-null UUIDs serialized under their exact snake-case names.
Aliases, exclusions, defaults, factories, nullable unions, `ClassVar`, private
attributes, and computed properties do not satisfy the wire contract. Generic
wrappers and abstract response bases are exempt; concrete scoped collection
responses are not. The Software Factory CLI profile recognizes
`OrganizationScopedResponse` and `ProjectScopedResponse` as its canonical
scope-marker bases.

## Adoption

Do not enable the full preset and wave through thousands of suppressions. Run
it against the target repository, classify existing failures, and either fix a
bounded baseline or enable rules incrementally. A suppression must name a real
exception to the architecture contract; “legacy code” is not a contract.
