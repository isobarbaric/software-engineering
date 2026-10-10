# Contracts and effects

Read this reference when work crosses a public boundary, authorization check,
transaction, queue, or external system.

## Classify contracts before changing them

Distinguish:

- internal names and implementation types;
- API requests and responses;
- events, task payloads, webhooks, and tool results;
- persisted values and analytics identifiers;
- authorization outcomes and concealment behavior.

Internal cleanup does not authorize a public contract change. Conversely, do
not retain stale internal aliases, dual paths, or fallback behavior merely
because an external boundary remains compatible. Map deliberately at the
boundary.

For every invariant, name its enforcement layer: type system, request schema,
service, repository, database, or runtime environment. Do not claim stronger
enforcement than the implementation provides.

## Authorization is part of the data contract

Trace identity and resource scope from the entrypoint through every read,
mutation, batch operation, and result. Authorization must fail closed and must
cover indirect data exposure through counts, search, exports, logs, caches, and
background tasks where applicable.

Do not infer authority from the ability to load a row. Do not pass arbitrary
tenant or project identifiers deeper than the authenticated context permits.

## Order durable and external effects

Write down the failure matrix when an operation combines database state with a
queue, object store, email, payment provider, webhook, or another service:

- database succeeds, external effect fails;
- external effect succeeds, database fails;
- the caller retries;
- the worker runs twice;
- work remains incomplete indefinitely.

Prefer committing one coherent database unit before emitting an irreversible
effect. When that ordering is insufficient, use an explicit durable outbox,
idempotency key, status machine, retry policy, or reconciliation path chosen by
the plan. Do not hide the gap in a best-effort `try` block.

## Background work changes the API

If work continues after the initiating response, the contract must define:

- what the initial response promises;
- where durable status lives;
- how progress, completion, and failure are observed;
- retry and idempotency behavior;
- which queue or execution class owns the latency and resource profile;
- whether cancellation or supersession exists.

The frontend trigger, backend task, status model, and recovery behavior are one
workflow even when implemented in different packages.
