# Frontend State Synchronization

Read this reference when changing React state, `useEffect`, browser storage,
window listeners, subscriptions, auth-session recovery, or identity-scoped
component lifecycles.

## State Taxonomy

Classify each value before choosing a mechanism:

- URL state: shareable and back/forward-aware;
- server state: owned by query and mutation hooks;
- external state: DOM, browser APIs, storage, subscriptions, or editors;
- ephemeral state: transient interaction state such as open or focused;
- derived state: computed from props, URL, queries, or enums during render;
- capability state: represented by an available callback when possible.

Do not store a value that can be derived from an authoritative source.

## Ownership Boundary

This reference owns synchronization mechanics: effects, external subscriptions,
browser persistence, and identity-driven remounts. The routing-and-urls
reference owns URL schema and navigation; the manager-hooks reference owns the
product meaning of filters, selections, and workflow state.

Treat URL state as an authoritative input here only when deciding whether to
derive, reset, or synchronize React state from it; do not introduce or alter
route/search parameters from this reference.

## Effects And Identity

Use effects only to synchronize React with a real external system. Prefer an
event handler, render derivation, query lifecycle, or mutation lifecycle for
internal React coordination.

Isolate a non-trivial synchronization boundary in a named custom hook owned by
the package that owns the external system. Follow the repository's file and
export conventions. Do not extract an effect merely to relocate code; the hook
must expose a coherent synchronization responsibility.

Give each effect hook one coherent external-synchronization responsibility and
keep its setup, cleanup, cancellation, and lifecycle bookkeeping together. Use
explicit typed inputs, complete dependencies, and behavior that remains correct
when inputs change, the component unmounts, or React Strict Mode replays setup
and cleanup. Do not suppress dependency linting or hide reactive inputs to
control execution.

Name the hook for the synchronization behavior rather than for a generic
lifecycle such as `useMount`. Keep pure calculations outside the effect and
test observable synchronization, dependency changes, cleanup, and stale
asynchronous results at the hook boundary. Extraction does not justify an
effect that has no external system.

When adding or behaviorally changing an effect hook, use applicable testing
guidance surfaced in the available-skills catalog. Test observable
synchronization, dependency changes, cleanup, Strict Mode replay, and stale
asynchronous results at the hook boundary.

Existing conventional hooks that already own the external system remain the
preferred boundary. `useLayoutEffect` and other effect primitives follow the
same isolation rule; use `useLayoutEffect` only for a real pre-paint invariant
when the necessary data is already available before paint.

When identity changes should reset a subtree, key the owner at the boundary:

```tsx
<FeatureContent key={scopeId} />
```

Do not patch identity changes with an effect that copies new props or query
results into local state. Use the repository's shared listener abstraction when
one exists instead of duplicating subscription mechanics.

Keep the changing key at the call site that owns the lifecycle boundary;
static keys do not reset state.

## Browser Storage

- Use the repository's shared browser-storage boundary when one exists; do not
  scatter raw storage access through components and hooks.
- Keep feature-specific key builders and accessors in the feature's established
  persistence module.
- Choose a snapshot read when a caller needs one value and a subscribed
  external store when mounted UI must react to writes.
- Scope keys by the real privacy boundary: user, tenant, workspace, feature, or
  resource as applicable.
- Deliberately migrate or remove changed persisted shapes; do not silently
  reinterpret old state.
- Never persist credential-like URLs, invite tokens, or PII.

Navigation, prefetch, and mutation setup often need only a snapshot. Raw
LocalStorage reads do not trigger renders; mounted UI that must respond to
same-tab writes needs React state or a subscribed external store. Extract
duplicated storage fallback into a resolver with explicit precedence; pass its
result as a query input rather than hiding persistence inside a data hook.

For expired-token, degraded-session, stream-reconnect, or collaboration
recovery work, read [auth-session-recovery.md](auth-session-recovery.md).
