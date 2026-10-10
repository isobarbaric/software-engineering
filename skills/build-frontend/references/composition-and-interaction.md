# Composition and interaction

## Context is a boundary

Use context when stable domain state crosses a real tree, outlet, portal, or
multi-consumer boundary. Do not use it to avoid importing a hook, ferry shallow
props, or centralize mutations that belong in a domain orchestrator.

Shared components own rendering and local interaction. Domain wrappers own
queries, mutations, route identity, policy, and user feedback. Low-level hooks
return typed results rather than showing toasts or choosing placement.

## Layout has an owner chain

Trace the portal target, flex parent, panel group, scroll container, and content
region before applying local styling. Put sizing and overflow behavior at the
route, module, sidebar, or panel owner that controls the relevant dimension.

Do not reuse a fallback component with a different visual or interaction
contract by adding metadata and conditional styling. Separate distinct
contracts.

## Search follows data shape

Hierarchical data normally requires hierarchical filtering. Normalize the
query once, recurse through the real structure, preserve relevant ancestors,
and share the algorithm across modes only when their product behavior matches.

## Affordances tell the truth

Do not leave impossible actions clickable. Disable, hide, or explain them
according to product semantics. Use component positioning APIs for edge
relationships rather than compensating CSS nudges. Verify keyboard, focus,
hover, navigation, loading, empty, denied, error, and retry behavior only where
the changed interaction can enter those states.
