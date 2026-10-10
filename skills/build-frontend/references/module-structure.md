# Frontend Module Structure

Read this reference when creating, moving, or reviewing files under `frontend/src`,
especially when a feature owns more than one kind of component, hook, type,
store, or utility.

This reference owns placement, dependency direction, and public entry points.
Use the component-composition reference for component contracts and feature
context decisions.

## Package Boundaries

- `src/lib/<module>/` contains reusable, domain-light building blocks and must
  not import from `src/app/`.
- `src/app/<module>/` contains one product area.
- `src/app/<module>/<sub-module>/` is a real package for a coherent feature,
  not merely a grouping folder.

Keep pure selectors in a neutral dependency layer that consumers can import.
Lower-level infrastructure must not import helpers from components, agent
tools, or other presentation packages.

Prefer deep modules once a feature owns multiple file categories. Do not split
one feature across `components/<feature>` and `hooks/<feature>` when it should
be a sub-module.

## Directory Ownership

```text
components/  domain-facing React composition
effects/     named hooks that isolate required React effects
hooks/api/    HTTP transport
hooks/query/  React Query state and query keys
hooks/manager/ orchestration and business intent
hooks/contexts/ focused shared state boundaries
store/        module-local persistence accessors and key builders
util/         pure helpers without React or network behavior
types/        dependency-light shared types
index.ts      curated public entry point
```

Do not put raw HTTP in components, React Query in API hooks, persistence in
`util/`, or hidden network logic in pure helpers.

Put `effects/` at the root of the package that owns the synchronization, beside
`components/` and `hooks/`, rather than under `hooks/` or in a global effect
collection. Name each effect-hook file `useLowerCamelCase.ts`. The file must
export exactly one function: a hook whose name exactly matches the filename
without `.ts`. It may contain private types and helpers. For example,
`frontend/src/lib/initialization/effects/useInitializationFailureReporting.ts`
exports only `useInitializationFailureReporting`.
Read [state-synchronization.md](state-synchronization.md) for effect necessity,
lifecycle, and testing requirements.

Before extracting shared code, verify that call sites have the same behavior,
dependencies, lifecycle, and error handling. Similar-looking code is not
enough evidence for a shared abstraction.

Use matching `UpperCamelCase` names for component files, matching
`useLowerCamelCase` names for hook files, and lowercase kebab-case for utility
and non-hook function files. Use `naming-litigation` for identifier or module
naming decisions when it is present in the available-skills catalog.
