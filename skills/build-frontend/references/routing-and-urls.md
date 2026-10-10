# Frontend Routing And URLs

Read this reference when adding or changing routes, layouts selected by routes,
navigation, deep links, notification links, agent URLs, or persisted resource
URLs.

## Route Ownership

Route shape belongs in React Router declarations and routing-adjacent layouts.
Do not infer route families with string-prefix tables or component-local path
concatenation.

For current project-scoped code:

- use `projectIdFromUrl` from `useProjectContext()` as the authoritative identity;
- use `useProjectRoutes()` for current-project navigation;
- do not derive the current project from `currentProject`, `effectiveProjectId`,
  `currentProjectId`, LocalStorage, or a fallback ID;
- do not allow no-project routes to read project context.

Navigation to a different project may receive that explicit project ID at the
call site. Keep that distinct from current-project navigation.

This reference owns route and search-parameter schema, route-mode identity, and
navigation. A manager may interpret typed URL values as workflow inputs, but it
must not define alternate URL shapes or construct paths itself. Effects,
storage, and subscription mechanics that react to a route change belong to
the state-synchronization reference.

## Route Modes

Decide whether the surface is:

1. project-scoped;
2. explicitly no-project;
3. dual-mode by product design; or
4. global, such as super-admin.

Do not create a helper that claims to support no-project mode while silently
reading project context. Use existing route-mode vocabulary rather than adding
local duplicate enums.

## Links And Resource URLs

Use typed route helpers and `SofaUrl` for persisted, shared, or compared
resource URLs. Typed anchors must be used for document links with line or
comment anchors.

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
