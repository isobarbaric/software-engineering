# Auth Session Recovery

Use this reference when changing frontend behavior for expired access tokens,
forced refresh, degraded sessions, session-expired UI, streaming requests, or
collaboration providers.

## Token lease coordination

Token refresh is shared external state. Model it as a coordinated lease instead
of independent fetch calls racing each other:

- A forced refresh must join or supersede non-forced token reads so background
  traffic cannot keep using a cached expired token during recovery.
- Expired or recovery snapshots should fail closed for background API/refetch
  traffic by returning no usable token or a typed session-expired result.
- Stream `401` handling after terminal expiration should surface the
  session-expired state. Do not loop forced refreshes for a session that is no
  longer recoverable.

## UI recovery gates

Recovery UI should match authenticated state:

- Show blocking recovery only for users who still have an authenticated session
  that can recover.
- Do not show a blocking recovery dialog to logged-out users navigating back to
  the app shell.
- Dismissing or completing recovery must leave visible data in a trustworthy
  state, not a stale pre-expiration snapshot.

## Resynchronization after recovery

Successful silent recovery should resynchronize every active external channel
that observed the expired session:

- refetch active React Query queries that failed during recovery;
- restart or reconnect live streams that were stopped by auth failure;
- reconnect collaboration providers after degraded-to-healthy transitions,
  including dead websocket cases.

Tests should include the race that motivated the change: one stale/background
request during forced refresh, at least one failed active query, and one live
provider or stream recovering to healthy state.
