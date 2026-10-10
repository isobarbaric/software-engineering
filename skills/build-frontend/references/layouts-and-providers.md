# Frontend Layouts And Providers

Read this reference when creating or changing module shells, domain layouts,
provider trees, sidebars, panels, portals, agent integration, or layout-scoped
state.

## Layout Ownership

Name the responsibility of each layout boundary: application shell, domain or
scope shell, feature chrome, and inner presentation as applicable. Follow the
repository's established layout taxonomy instead of forcing these names into a
different structure.

Put sizing, overflow, and scroll behavior at the owner of the flex, panel, or
portal chain. Do not repair an ancestor layout problem with leaf styling.

Stabilize flex width negotiation and truncate text so long labels do not
reshape navigation.

Use portals only for an intentional cross-tree slot. Do not use a portal to
avoid resolving which layout owns a region.

## Provider Boundaries

Providers that hold tenant, workspace, resource, selection, panel, or
query-scoped state must remount, clear, or invalidate when that scope changes.
Place a provider at the narrowest stable ancestor shared by its real consumers.

Layout architecture owns structural provider placement and scope-wide layout
state. Feature contexts compose a component subtree and should not move into a
layout merely for convenience. Use the state-synchronization reference for the
reset, persistence, or external-synchronization mechanism after the scope
boundary is chosen.

Use narrow context values and descriptive consumer errors. Layout context
should expose typed operations rather than raw string identifiers.

## Selection And Panels

Selection that must be shareable or history-aware belongs in the URL. Ephemeral
view state belongs in local state and resets with the primary selection. Persist
only intentionally scoped restoration state.

Register layout-owned regions through the repository's established
configuration when one exists. Do not call something a panel when it is not a
resizable or layout-owned region, and do not adapt a visually different fallback
into the wrong component contract.
