---
name: build-frontend
description: Plan, implement, or review React and TypeScript application behavior across ownership, state, effects, query caches, routing, composition, layout, and interaction. Use for frontend product code and compose with backend or migration skills when contracts cross those boundaries.
---

# Build Frontend

Use this as the top-level entrypoint for React and TypeScript application work.
It owns frontend architecture and behavior; the approved plan owns the requested
outcome and scope.

Before changing code, establish:

- the owner of each changed behavior;
- the authoritative source of each value and identity;
- the state category and lifecycle of every new or moved value;
- the API, cache, route, and component contracts that change together;
- preserved interaction behavior and explicit non-goals;
- the failure boundary and evidence that will prove it.

Do not add a fallback, context, effect, refetch, wrapper, or boolean prop until
its independent invariant is named.

## Read the applicable guidance

- Read [architecture-and-ownership.md](references/architecture-and-ownership.md)
  for module boundaries, authoritative state, types, and abstractions.
- Read [state-data-and-routing.md](references/state-data-and-routing.md) for
  URL identity, state classification, effects, query caches, and external
  stores.
- Read [composition-and-interaction.md](references/composition-and-interaction.md)
  for context, shared UI, layout, search, and interaction affordances.

The owning role may compose this skill with `naming-litigation` for changed
identifiers or domain vocabulary and `$verify-implementation` for
implementation evidence. Use only skills surfaced in the available-skills
catalog.

## Execute the frontend contract

- Derive values already available from props, URL state, query data, or a
  domain enum instead of storing them again.
- Use effects only to synchronize with a real external system or post-render
  boundary. Use callbacks, query lifecycle, render derivation, or keyed owner
  remounts for ordinary React coordination.
- Fix cache invariants directly. Do not use forced refetches, zero stale time,
  or broad invalidation to conceal an incorrect cache write.
- Keep transport hooks presentation-free. Domain orchestrators own workflow and
  user feedback; shared components receive explicit data and callbacks.
- Use context only across a real tree, outlet, portal, or stable multi-consumer
  boundary—not to avoid shallow props or imports.
- Represent closed states and subtype-dependent fields explicitly. Do not use
  optional fields and unrelated booleans to permit impossible combinations.
- Preserve hover, focus, keyboard, navigation, loading, empty, denied, and
  error behavior that the plan does not intentionally change.
- Add an abstraction only when it owns policy, lifecycle, a domain operation,
  or real repeated behavior.

Follow mature neighboring modules unless the plan identifies a real difference.
Keep current domain vocabulary aligned across API types, query keys, hooks,
components, tests, and mocks.

## Verify and hand off

Inspect the final diff for duplicate truth, effect-based internal coordination,
hidden storage fallbacks, broad cache churn, unjustified context, coupled props,
stale routes, impossible actions, and unrequested compatibility behavior.

Verification must cover the changed owner and meaningful state partition. Use
a browser when focus, layout, portals, navigation, timing, or browser storage is
the actual boundary; do not use broad browser success as a substitute for a
focused deterministic invariant.
