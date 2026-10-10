# Frontend Component Composition

Read this reference when creating or refactoring React components or changing
component props, feature contexts, wrappers, reusable UI state, or shell/content
splits. Use the module-structure reference for the resulting file/package placement.

## Component Categories

Template components own reusable presentation, visual states, and local
interaction state. They accept explicit data, slots, and callbacks and remain
domain-light.

Domain components own domain hooks, scope identity, route state, mutations,
domain copy, empty states, and event procedures. They translate domain data
into the template contract.

Shared components must not import domain hooks, domain contexts, or module
copy. Domain wrappers are valid only when they add real behavior; delete
wrappers that only forward props.

## Context And Capability

Feature context must cross a real component-tree boundary. Do not use it as a
convenience mutation bus. Prefer local hooks and explicit callbacks for shallow
state. Use the layouts-and-providers reference for outlets, portals, sidebars,
panels, and scope-wide provider placement.

When context owns base state, expose shared derived values from that owner
instead of requiring every consumer to repeat the derivation or import a utility.

Represent capability with callback presence when possible. Do not pass both a
disabled flag and a missing callback for the same unavailable action unless the
two states are meaningfully different.

Disable, hide, or explain actions that cannot succeed according to product
semantics; do not leave them as clickable no-ops.

## State And Types

Reusable primitives may support controlled and uncontrolled state when that
materially improves reuse. Do not mirror controlled props into local state with
an effect. Type props and callback parameters explicitly, and split components
when boolean props start encoding distinct layouts or behaviors.

Use a shell/content split when required data has loading, error, empty, or
not-found states. The content component should receive non-null required data.

## Presentation

Use the component primitive's supported placement API instead of CSS nudges.
Follow the local module's empty-state spacing and styling.
