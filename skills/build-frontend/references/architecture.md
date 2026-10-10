# Frontend Architecture

Read this reference for frontend changes that cross component, hook, route, cache,
provider, or module boundaries. It decides _which layer owns a behavior_ and
whether a new mechanism is justified. The other references in this skill own
the concrete React, routing, cache, component, layout, and package mechanics.

## Before Editing

Classify the change as one or more of:

- routing or project identity
- server data or cache
- derived or ephemeral state
- external synchronization
- shared component composition
- module/package structure
- layout/provider ownership
- type or API contract

For every changed behavior, identify:

1. the fixed decisions, exclusions, and public/API contracts to preserve;
2. the single owner that should make the decision;
3. the canonical source of the value;
4. the narrowest public boundary required by consumers;
5. the existing neighboring implementation to follow.

If the owner or source of truth cannot be named, stop and inspect the render,
route, provider, and query chain before adding glue.

Search neighboring modules and shared `lib` for existing hooks, primitives,
query-key factories, route helpers, and tests before inventing a mechanism.

## Tradeoffs And Feedback

When asked to compare options, assess ownership, hidden inputs, cache and
debugging semantics, migration cost, and what each option sacrifices. State
the recommendation and implement once the direction is settled.

Feedback about unnecessary or duplicated mechanisms calls for reassessing the
ownership model. If it exposes a conceptual mismatch, split the concepts
instead of adapting the same abstraction through more conditionals.

## Simplification Gate

Every new mechanism must encode a named invariant. Prefer, in order:

- derive during render instead of storing derived state;
- use an event or mutation lifecycle instead of an internal coordination effect;
- key the owner when identity changes require a fresh lifecycle;
- consume an existing canonical query/cache instead of adding a duplicate;
- pass a callback to shared UI instead of creating convenience context;
- use router declarations and typed helpers instead of inferring paths from strings.

Delete the mechanism when the invariant is not real or is already owned by an
existing layer. Read the concrete reference for effect dependencies, query keys,
URL schemas, provider placement, or component contracts.

Do not add a second query, cache entry, local state value, or reconstruction
path to recover a value already owned by a canonical source. Extract a pure
selector when traversal is needed; follow [module-structure.md](module-structure.md)
for placement and dependency direction.

## Reachability And Shared Behavior

Follow the actual path before retaining fallbacks, loading branches, scroll
rules, optimizations, or compatibility code:

```text
route/layout -> domain wrapper -> shared component -> behavior owner
```

When a behavior is shared across modes, change the lowest owner that actually
owns it and verify every reachable mode. Do not copy a fix into parallel
components based only on similar names or JSX.

## Type And Domain Contracts

Use discriminated variants for state-dependent fields. Each variant should
expose only meaningful data; omit fields that are forbidden or constant in
that state. A shared base type needs a domain concept or polymorphic consumer,
not just repeated declarations.

When domain vocabulary changes, update API types, query keys, hooks,
components, tests, and mocks together. Backend storage names are not frontend
domain contracts. Preserve legacy vocabulary only at an explicitly required
public boundary.

### Server enums are open sets

[API Compatibility Enforcement, ADR-011](https://factory.8090.ai/project/facffe35-75fc-4d5c-998e-db53f0431471/blueprints/bb5537d5-07eb-41a9-8877-37442f2e30ff)
lets the backend add a response enum value without a client release and makes
the client responsible for handling values it has never seen. In code that
means:

- no `switch` over a server value ends in a throwing `never` guard;
- every lookup or branch keyed by a server value has a fallback:
  `MAP[value] ?? fallback`, or a `default` that renders the raw value, a
  neutral icon, or an "unsupported" notice;
- each fallback has a unit test that passes a value outside the type.

Throwing `never` guards remain right for values the client builds itself. A
fallback for a server value is required behavior, not an unreachable branch.

## Rejection Gate

Before handoff, inspect the diff and reject:

- duplicate sources of truth;
- unreachable branches or stale fallbacks;
- wrappers that only forward props;
- speculative readiness, refetch, or optimization plumbing;
- stale domain names and compatibility aliases without an explicit requirement;
- tests asserting deleted or inaccessible behavior.

Verify changed behavior with targeted tests of current accessible UI and
provider contracts. For layout and interaction work, inspect the flex chain,
portal target, focus behavior, and overflow in the browser when feasible.
