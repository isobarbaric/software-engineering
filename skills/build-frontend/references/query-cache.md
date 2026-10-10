# Frontend Query And Cache

Read this reference when reading server data, submitting mutations, polling,
subscribing to backend state, invalidating queries, or implementing optimistic
updates.

## Query And Mutation Ownership

Queries wrap `useQuery`; mutations wrap `useMutation` or the repository's
optimistic mutation helper. This layer owns:

- query keys and cache identity;
- loading and error wiring;
- invalidation and cache writes;
- optimistic updates and rollback.

Queries must not cause writes or advance server state. Do not put raw API calls
in components, contexts, or manager hooks.

## Query Identity

Query keys must include every scope dimension that changes the result:
tenant, workspace, resource identity, filters, search parameters, and
feature-specific modes as applicable. Do not pass nullable IDs to key factories
when the query requires an identity; structure the component boundary so the
key gets a required ID.

Scope switches must not display or reuse data from the previous authorization
boundary. Avoid `keepPreviousData` across privacy or authorization scopes.

## Cache Correctness

Fix cache ownership and write invariants before adding refetches, `staleTime: 0`,
or broad invalidation. A refetch is a product freshness decision, not a safety
blanket.

Guard writes to list caches that were never fetched; do not fabricate an
incomplete list. Update or invalidate every affected filter intentionally,
not only the visible list. Calling an already-prefetched stable query hook
normally reads cached data; do not add fetch or readiness plumbing without a
correctness requirement or measured cost.

Optimistic updates must patch the same scope as the query. Reconcile temporary
display overlays against authoritative cache changes and clear them on
rejection or permission denial. Denied mutations must reject so rollback and
error handling run.

Use `enabled` only for real runtime gating. Do not add readiness props to hide
an impossible component boundary or to optimize an unmeasured cache concern.
