---
name: build-frontend
description: Use for implementation, bug fixes, refactors, or reviews of React and TypeScript application code. Applies to components, hooks and effects, API and query-cache logic, client state, routing, providers, layouts, module boundaries, and interaction behavior, even when the task never says React or frontend.
---

# Build Frontend

Use this skill before implementing, fixing, refactoring, or reviewing React or
TypeScript application code, even when the task never says React or frontend.
Identify the repository's application root and established frontend stack. This
is the entrypoint for frontend application guidance; load only the references
that match the changed behavior.

For frontend reviews, apply these domain rules to the complete diff and return
only evidence-backed findings with concrete mechanisms and consequences.

When the change affects what people see or interact with, preserve the product's
established visual system and verify the actual interaction surface. This skill
owns React structure, not an unrequested visual redesign.

For identifier decisions, name the real owner, scope, lifecycle, and operation;
match mature repository convention and propagate a rename through files,
exports, types, imports, tests, and mocks without compatibility aliases. Compose
only with applicable guidance surfaced in the available-skills catalog;
otherwise follow repository instructions and source precedent without loading
an undisclosed skill path.

## Core Execution Contract

An approved technical direction is binding. Do not reopen architecture
exploration, offer more options, or wait for confirmation on implementation
details that source inspection and peer precedent can resolve.

Identify the behavior owner and authoritative source before editing. Use the
architecture reference when those boundaries need investigation or a tradeoff
decision. Stop only when a missing decision would materially change product
behavior, a public contract, authorization, data semantics, or deployment safety.

## Read The Relevant Reference

- For work in the Software Factory repository, read
  [software-factory.md](references/software-factory.md) in the same pass as the
  applicable general references. It contains repository-specific contracts and
  concrete application vocabulary; do not apply it to other repositories.
- For ownership, tradeoffs, simplification, shared behavior, type contracts,
  and verification: [architecture.md](references/architecture.md).
- For HTTP transport, typed request parameters, and presigned uploads:
  [api-hooks.md](references/api-hooks.md).
- For query keys, mutations, invalidation, optimistic updates, and cache scope:
  [query-cache.md](references/query-cache.md).
- For workflows that coordinate queries, mutations, typed URL state,
  selections, and filtered view models: [manager-hooks.md](references/manager-hooks.md).
- For routes, navigation, deep links, scope identity, and resource URLs:
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
