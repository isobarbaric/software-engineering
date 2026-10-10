# Frontend API Hooks

Read this reference when adding or changing frontend consumers of backend endpoints,
including S3 upload transport and request/response mapping.

## Responsibility

API hooks own HTTP only:

- use the repository's established HTTP client or base API hook;
- unpack typed route, query, and body parameters;
- call the endpoint;
- return the typed response or typed transport result.

They must not own React Query, cache invalidation, optimistic updates, shared
state, toasts, component behavior, or domain placement decisions.

Prefer a typed parameter object over positional arguments when a request has
multiple parameter categories. Do not bypass an established transport client
with ad hoc network calls unless the boundary genuinely requires different
transport behavior.

## Upload Transport

Use one domain-neutral transport utility for presigned uploads rather than
creating feature-specific hooks that duplicate progress tracking, result shape,
or error classification. Keep that utility limited to byte transport and
transport-level failure reporting.

The domain mutation or orchestrator owns the rest of the workflow: request an
upload target, decide whether to continue after failure, create or update the
domain resource, place it in the product's hierarchy when applicable, and
update or invalidate the affected query scope.

## Types

Define explicit request and response types. Preserve backend response naming
until constructing the domain-facing return shape; do not hide renames inside
destructuring.
