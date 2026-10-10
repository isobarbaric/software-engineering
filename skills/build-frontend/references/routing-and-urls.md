# Frontend Routing And URLs

Read this reference when adding or changing routes, layouts selected by routes,
navigation, deep links, notification links, or persisted resource URLs.

## Route Ownership

Route shape belongs in router declarations and routing-adjacent layouts. Do not
infer route families with string-prefix tables or component-local path
concatenation.

Use the canonical typed route parameter or route context as the authoritative
identity for the current scope. Do not reconstruct it from loaded entities,
browser storage, or fallback IDs. Navigation to a different scope may receive
that explicit identity at the call site; keep it distinct from navigation
within the current scope.

This reference owns route and search-parameter schema, route-mode identity, and
navigation. A workflow orchestrator may interpret typed URL values as inputs,
but it must not define alternate URL shapes or construct paths itself. Effects,
storage, and subscription mechanics that react to a route change belong to the
state-synchronization reference.

## Route Modes

Decide whether a surface is scoped, explicitly unscoped, dual-mode by product
design, or global/administrative. Do not claim to support an unscoped mode while
silently reading scoped context. Use the product's canonical route-mode
vocabulary instead of adding local duplicate enums.

## Links And Resource URLs

Use typed route helpers and the repository's canonical URL representation for
persisted, shared, or compared resource URLs. Preserve typed anchors when the
resource contract supports line, comment, selection, or other deep-link state.

Links inside selectable or draggable rows must preserve modifier-click,
selection, and drag behavior. Put the link on the title or explicit link
affordance rather than wrapping the entire interactive row.

## Renames And Legacy Paths

Update route labels, keys, enums, API consumers, tests, and exhaustive maps
together when a module changes identity. Retain legacy vocabulary only at an
explicit redirect, persistence, or external-payload boundary. Delete retired
screen implementations once the canonical route is live.

Add redirects for old paths only when preserving those URLs is explicitly
required; do not maintain parallel screen implementations.
