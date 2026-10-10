# Frontend Manager Hooks

Read this reference when a frontend workflow spans multiple query or mutation hooks,
route/search state, derived view models, or coordination across components.

## Responsibility

Manager hooks own business intent and orchestration:

- compose API/query/mutation hooks;
- own the workflow meaning of pagination, filters, sort order, selection, and
  other domain state;
- consume typed URL state when it is part of the workflow;
- shape domain-facing view models;
- expose explicit commands and status to components.

For hierarchical view models, filter recursively, normalize search input once,
and share the pure filtering helper across modes unless product behavior
differs. A standalone filter helper does not itself require a manager hook.

Use a manager only when it removes real workflow complexity. A thin pass-through
hook, a second cache, or a wrapper that only renames fields is not a manager.

Managers must not make raw HTTP calls, own query keys, show presentation
toasts, or hide required identity behind nullable parameters. Fix the tree or
provider boundary when a required ID does not exist.

Routing owns URL schema, project identity, and navigation; managers decide how
the canonical typed values affect a workflow. State synchronization owns effects,
storage, subscriptions, and remount behavior; managers must not introduce those
mechanisms merely to coordinate internal React state. When a filter, page, or
scope invalidates a selection, the manager owns clearing or revalidating it so
an entity from an old result set cannot remain submit-ready.

When manager state must cross a real outlet, portal, or layout boundary, execute
the manager once in a focused provider and expose a narrow context value. Do
not create context merely to avoid a local hook or callback.
