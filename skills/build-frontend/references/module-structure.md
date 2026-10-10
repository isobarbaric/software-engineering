# Frontend Module Structure

Read this reference when creating, moving, or reviewing frontend files,
especially when a feature owns more than one kind of component, hook, type,
store, or utility.

This reference owns placement, dependency direction, and public entry points.
Use the component-composition reference for component contracts and feature
context decisions.

## Package Boundaries

Keep reusable, domain-light building blocks below product-specific modules in
the dependency graph. Shared infrastructure must not import product areas.
Product modules may compose shared packages and should expose deliberate public
entry points rather than relying on incidental deep imports.

Create a feature subpackage when a coherent capability owns several file
categories or a meaningful internal boundary. Do not manufacture folders for a
single file, but do not split one feature across distant global component and
hook directories when those files evolve together.

Keep pure selectors in a neutral dependency layer that every consumer can
import. Lower-level infrastructure must not import helpers from components,
agent tools, or other presentation packages.

## Responsibility Placement

Preserve distinct homes for these responsibilities using the repository's
established directory names:

- domain-facing React composition;
- external synchronization effects;
- HTTP transport;
- server-query and cache ownership;
- workflow orchestration;
- focused shared-state boundaries;
- browser persistence;
- pure helpers without React or network behavior;
- dependency-light shared types;
- curated public exports.

Do not put raw HTTP in components, query-cache behavior in transport hooks,
persistence in a generic utility directory, or hidden network behavior in pure
helpers.

Place named synchronization hooks inside the package that owns the external
system. Follow the repository's naming, export, and directory conventions; the
hook boundary should make setup, cleanup, dependencies, and testing legible.
Read [state-synchronization.md](state-synchronization.md) for effect necessity
and lifecycle requirements.

Before extracting shared code, verify that call sites have the same behavior,
dependencies, lifecycle, and error handling. Similar-looking code is not enough
evidence for a shared abstraction.

Match neighboring filename and export conventions. Names should expose the real
owner, scope, lifecycle, and operation.
