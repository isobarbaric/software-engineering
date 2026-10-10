# Frontend API Hooks

Read this reference when adding or changing frontend consumers of backend endpoints,
including S3 upload transport and request/response mapping.

## Responsibility

API hooks own HTTP only:

- choose the correct layered base API hook;
- unpack typed route, query, and body parameters;
- call the endpoint;
- return the typed response or typed transport result.

They must not own React Query, cache invalidation, optimistic updates, shared
state, toasts, component behavior, or domain placement decisions.

Use typed `ApiRequestParams` objects rather than positional arguments. Use
`NoRouteParams`, `NoQueryParams`, and `NoBodyParams` when a request bucket is
unused. Never use raw `fetch` in a domain API hook.

## Upload Transport

`useS3Upload` is the application-wide, domain-neutral transport utility for
every presigned S3 upload. Use it from any feature that uploads bytes to a
presigned URL; do not create module-specific upload hooks that duplicate its
progress tracking, result shape, or error classification.

Do not call the underlying `uploadFileToPresignedUrl` helper from domain hooks
or components. `useS3Upload` owns the S3 PUT, progress reporting, and typed
`S3UploadResult` failure classification. It is intentionally limited to that
transport concern: it does not create application resources, choose a document
tree location, show UI toasts, or invalidate queries.

The domain mutation or manager that composes `useS3Upload` owns the rest of the
workflow: request a presigned URL, decide whether to continue after an upload
failure, create or update the resource, place it in the domain tree, and update
or invalidate the affected query scope.

## Types

Define explicit request and response types. Preserve backend response naming
until constructing the domain-facing return shape; do not hide renames inside
destructuring.
