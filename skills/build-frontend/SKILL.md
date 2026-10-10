---
name: build-frontend
description: Use for implementation, bug fixes, refactors, or reviews of React and TypeScript application code. Applies to components, hooks and effects, API and query-cache logic, client state, routing, providers, layouts, module boundaries, and interaction behavior, even when the task never says React or frontend.
---

# Build Frontend

Use this skill before implementing, fixing, refactoring, or reviewing React or
TypeScript application code, even when the task never says React or frontend.
In sf-platform, the primary application surface is `frontend/src/`; in another
repository, identify its equivalent package root. This is the entrypoint for
frontend application guidance; load only the references that match the changed
behavior.

For sf-platform pull-request reviews, also use `$krish-pr-review` when it is
present in the available-skills catalog. This skill supplies the frontend
domain rules; the review skill owns the static-review workflow and verdict.

When the change affects what people see or interact with, preserve the product's
established visual system and verify the actual interaction surface. This skill
owns React structure, not an unrequested visual redesign.

Use `naming-litigation` for identifier decisions. For logging or editor
subsystem work, compose only with applicable guidance surfaced in the
available-skills catalog; otherwise follow repository instructions and source
precedent without loading an undisclosed skill path.

Do not turn this into an editor subsystem guide. Avoid editor wiring
inventories, Y.js details, and content-state maps unless the task requires them.

## Core Execution Contract

An approved technical direction is binding. Do not reopen architecture
exploration, offer more options, or wait for confirmation on implementation
details that source inspection and peer precedent can resolve.

Identify the behavior owner and authoritative source before editing. Use the
architecture reference when those boundaries need investigation or a tradeoff
decision. Stop only when a missing decision would materially change product
behavior, a public contract, authorization, data semantics, or deployment safety.

## Read The Relevant Reference

- For ownership, tradeoffs, simplification, shared behavior, type contracts,
  and verification: [architecture.md](references/architecture.md).
- For HTTP transport, typed request parameters, and presigned uploads:
  [api-hooks.md](references/api-hooks.md).
- For query keys, mutations, invalidation, optimistic updates, and cache scope:
  [query-cache.md](references/query-cache.md).
- For workflows that coordinate queries, mutations, typed URL state,
  selections, and filtered view models: [manager-hooks.md](references/manager-hooks.md).
- For routes, navigation, deep links, project identity, and resource URLs:
  [routing-and-urls.md](references/routing-and-urls.md).
- For React state, effects, browser persistence, subscriptions, and remounts:
  [state-synchronization.md](references/state-synchronization.md).
- For expired sessions, stream reconnects, and recovery behavior:
  [auth-session-recovery.md](references/auth-session-recovery.md).
- For shared/domain component boundaries, feature context, callbacks,
  action availability, and presentation: [component-composition.md](references/component-composition.md).
- For package placement, imports, utilities, stores, types, and entry points:
  [module-structure.md](references/module-structure.md).
- For provider nesting, panels, sidebars, portals, and layout ownership:
  [layouts-and-providers.md](references/layouts-and-providers.md).
