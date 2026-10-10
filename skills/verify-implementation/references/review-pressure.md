# Review pressure

Use these questions to inspect the implementation before accepting its test
results. They are derived from recurring review behavior: challenge the shape,
then prove or dismiss the concern with source or runtime evidence.

## Lock contract and scope

State the smallest honest promise of the change. Connect every changed file,
branch, abstraction, and compatibility mechanism to that promise.

Reject unrelated cleanup and unexplained churn. Ask why a change was necessary
before evaluating whether it was implemented elegantly.

## Search for the existing seam

Before accepting a new hook, helper, context, service, repository, option
object, enum member, adapter, or special branch, search the changed domain and
mature peers.

Reuse is not automatically correct. Compare contracts. If the existing seam
does not fit, name the missing axis. If the new concept has no independent
owner or invariant, remove it.

## Litigate state, identity, and optionality

For every changed value, identify its authoritative source. Look for:

- identity reconstructed from nearby state instead of its canonical owner;
- several absence conventions for one fact;
- transient presentation state persisted as durable preference;
- correlated values stored independently so snapshots can disagree;
- optional fields that describe mutually exclusive subtypes;
- closed states represented by scattered strings or unrelated booleans.

Prefer a shape that makes invalid states unrepresentable, but do not introduce
a formal type or wrapper merely to decorate a local expression.

## Trace the whole contract

Follow changed input and output through actual callers, consumers, caches,
persistence, authorization, copy/import/export paths, background work, and user
entrypoints that apply.

Look for asymmetry: create versus copy, list versus get/search/count, button
versus keyboard or direct handler, durable mutation versus cache or derived
view, and renamed contracts versus mappers, tests, logs, and stored values.

## Simulate unhappy transitions

Enumerate relevant states and ask what every observer sees:

- empty and loading;
- denied and revoked;
- stale and out of order;
- retry and duplicate execution;
- partial success;
- disconnect, cancellation, or terminal failure;
- delete, restore, and rollback;
- refresh, remount, and navigation;
- mixed old and new application or schema versions.

Pay special attention to success reported before durable state or required side
effects are committed.

## Demand proof at the failure boundary

A concern becomes a verification requirement only after naming the failure
mechanism. Choose evidence that would actually fail when the mechanism occurs.

Do not accept:

- mock-only proof of an external or framework boundary;
- a happy-path test for a state-partition bug;
- local empty-database success for a data-dependent migration;
- type checking as proof of runtime authorization or persistence;
- broad end-to-end success as the only evidence for a precise invariant.

If no concern survives investigation, say which high-risk paths were checked.
Confidence is a conclusion, not the absence of a failing command.
