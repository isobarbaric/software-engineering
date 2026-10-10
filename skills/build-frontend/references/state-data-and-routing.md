# State, data, and routing

## Classify state first

- URL state is shareable and back/forward-aware.
- Server state belongs to queries and cache keys.
- External state belongs to browser APIs, subscriptions, editors, or storage
  boundaries.
- Ephemeral interaction state belongs to the nearest honest UI owner.
- Derived render state is computed, not stored.
- Durable preference changes only through events that actually change the
  preference contract.

Do not persist transient search, hover, focus, or loading behavior merely
because it affects the same rendered result as a stored preference.

## Effects are external synchronization

Use callbacks for internal flow, mutation lifecycle for cache updates, render
derivation for display, and an owner-level key when identity requires a fresh
lifecycle. Reserve effects for event listeners, browser APIs, subscriptions,
imperative external systems, and post-render synchronization.

## Query cache is a contract

Do not fabricate a cache entry that was never fetched. Update or invalidate all
affected filter scopes intentionally. Use invalidation when another actor makes
freshness a product contract, not as a reflex after an uncertain write.

External stores require explicit ownership. Choose whether a caller needs a
snapshot or a live subscription. Do not hide storage fallback inside a query
hook unless that hook owns the persistence policy.

## Routes own navigable identity

Treat the active route as the authority for route-scoped identity. Use the
application's canonical route helpers and router declarations rather than
reconstructing paths from nearby object state, prefix tables, or local storage.
An explicit ID is appropriate when navigating to a different owner, not when
recovering the current route's identity.
