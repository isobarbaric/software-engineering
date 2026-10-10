# Software Factory Frontend Conventions

Read this reference for frontend work in the `sf-platform` repository. It
extends the general `build-frontend` references with Software Factory's exact
application vocabulary, paths, helpers, and architectural contracts. Do not
apply these names or structures to another repository by analogy.

## Application And Supporting Guidance

- The primary frontend application root is `frontend/src/`.
- When surfaced in the active skill catalog, compose with `review`,
  `frontend-visual-design`, `build-naming-conventions`, `frontend-logging`,
  `build-editors`, and `testing` when the change touches those concerns.
- Do not turn ordinary frontend work into an editor-subsystem investigation.
  Load editor wiring, Y.js, and content-state details only when the task
  actually touches the editor.

## API Hooks And Uploads

- Use the layered base API hooks and typed `ApiRequestParams` objects.
- Use `NoRouteParams`, `NoQueryParams`, and `NoBodyParams` when a request bucket
  is unused.
- Do not bypass the application API layer with raw `fetch` in a domain hook.
- `useS3Upload` is the application-wide transport hook for presigned S3
  uploads. It owns the S3 PUT, progress, and `S3UploadResult` failure shape.
- Domain code must not call `uploadFileToPresignedUrl` directly. The composing
  mutation or manager owns presign requests, resource creation, document-tree
  placement, user feedback, and query updates.

## API Compatibility

Software Factory's API compatibility contract treats backend response enums as
open sets. Follow
[API Compatibility Enforcement, ADR-011](https://factory.8090.ai/project/facffe35-75fc-4d5c-998e-db53f0431471/blueprints/bb5537d5-07eb-41a9-8877-37442f2e30ff):

- server-enum switches and lookup maps require a non-throwing fallback;
- render the raw value, a neutral affordance, or an unsupported notice as the
  contract requires;
- test a value outside the generated client type;
- retain throwing exhaustiveness guards for closed values built by the client.

## Routing And Scope Identity

- Route shapes belong in React Router declarations. This guidance also covers
  notification links, agent URLs, and persisted resource URLs.
- `projectIdFromUrl` from `useProjectContext()` is the authoritative current
  project identity.
- Use `useProjectRoutes()` for current-project navigation.
- Do not derive current project identity from `currentProject`,
  `effectiveProjectId`, `currentProjectId`, LocalStorage, or a fallback ID.
- A no-project route must not read project context. Navigation to a different
  project may receive that explicit project ID at the call site.
- Use the established project-scoped, no-project, dual-mode, and global or
  super-admin route vocabulary.
- Use typed route helpers and `SofaUrl` for persisted, shared, or compared
  resource URLs. Preserve typed document line and comment anchors.

## Layouts, Providers, And Components

- Domain layouts own the sidebar provider, inline domain sidebar, auth guards,
  and breadcrumbs.
- Module layouts own content chrome, registered panels, agent integration, and
  module-layout context.
- Inner layouts own document or list/detail presentation.
- Portals are limited to designated sub-navigation or action slots; they do not
  replace the domain sidebar.
- Place domain providers above shared module layout when the agent panel or
  another sibling consumes project, organization, document, or selection state.
- Module-layout context exposes typed panel helpers rather than raw panel-name
  strings. Register actual panels in module layout configuration.
- Domain components own project scope. Shared components remain domain-light.
- Use menu and popover primitives' `side` and `align` APIs rather than CSS
  placement nudges.

## Module And Effect Structure

- `src/lib/<module>/` contains reusable, domain-light building blocks and must
  not import from `src/app/`.
- `src/app/<module>/` contains a product area; coherent feature subpackages live
  under `src/app/<module>/<sub-module>/`.
- Use the established responsibility directories:
  `components/`, `effects/`, `hooks/api/`, `hooks/query/`, `hooks/manager/`,
  `hooks/contexts/`, `store/`, `util/`, and `types/`.
- Put synchronization hooks in the owning package's root `effects/` directory.
  Each `useLowerCamelCase.ts` effect file exports exactly one same-named hook;
  supporting types and helpers remain private.
- When materially changing an inline effect, extract it into that boundary
  without sweeping unrelated legacy effects into the change.
- `frontend/src/lib/initialization/effects/useInitializationFailureReporting.ts`
  is the representative effect-file shape.
- Component filenames use matching `UpperCamelCase`; hook filenames use
  matching `useLowerCamelCase`; utility and non-hook function filenames use
  lowercase kebab-case.

## Queries, Storage, And Recovery

- Query keys include organization, project, resource, filter, search, and mode
  dimensions that change the result.
- Organization and project switches must not reuse data across the old scope.
- Use `useWindowEventListener` for shared window subscriptions.
- Use the shared LocalStorage helpers, with feature key builders and accessors
  in `store/`.
- Scope persisted keys by the applicable user, organization, project, module,
  or resource boundary.
- Managers consume project identity from routing and clear selections that are
  invalidated by a new project, filter, page, or query result.
