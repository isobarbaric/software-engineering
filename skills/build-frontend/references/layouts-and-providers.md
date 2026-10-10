# Frontend Layouts And Providers

Read this reference when creating or changing module shells, domain layouts,
provider trees, sidebars, panels, portals, agent integration, or layout-scoped
state.

## Layout Ownership

The frontend has separate domain and module layout responsibilities:

- domain layouts own the sidebar provider, sidebar, auth guards, and
  breadcrumbs;
- module layouts own content chrome, panels, agent integration, and module
  layout context;
- inner layouts own document or list/detail presentation.

Put sizing, overflow, and scroll behavior at the owner of the flex, panel, or
portal chain. Do not repair an ancestor layout problem with leaf styling.

Stabilize flex width negotiation and truncate text so long labels do not
reshape navigation.

Domain sidebars render inline. Portals are for designated sub-navigation or
actions slots only; they must not replace the domain sidebar.

## Provider Boundaries

Providers that hold project, organization, document, selection, panel, or
query-scoped state must remount, clear, or invalidate when that scope changes.
Place domain providers above shared module layout when the agent panel or
other siblings need to read domain state.

Layout architecture owns structural provider placement and scope-wide layout
state. Feature contexts compose a component subtree and should not move into a
layout merely for convenience. Use the state-synchronization reference for the
reset, persistence, or external-synchronization mechanism after the scope
boundary is chosen.

Use narrow context values and descriptive consumer errors. A module layout
context should expose typed panel helpers rather than raw string panel names.

## Selection And Panels

Selection that must be shareable or history-aware belongs in the URL. Ephemeral
view state belongs in local state and resets with the primary selection. Persist
only intentionally scoped restoration state.

Register real panels in the module layout configuration. Do not call something
a panel when it is not a resizable or layout-owned region, and do not adapt a
visually different fallback into the wrong component contract.
