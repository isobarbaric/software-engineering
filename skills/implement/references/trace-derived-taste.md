# Trace-Derived Implementation Taste

These patterns come from a bounded Langfuse review of Krish's Codex and Cursor
sessions. Apply the repeated implementation preference, not the historical code
verbatim.

## Preserve the plan boundary

When handed an approved plan, execute it without reopening settled product or
architecture questions. Do not edit the plan, invent adjacent work, or silently
change its behavior. If repository evidence invalidates it, return a decision
delta to the engineer.

Evidence: traces `fe1d372961c980ec195e21b617e115cb` and
`71b27c972d11ed50fe87f264426f7513` explicitly separated planning from
implementation and required the implementer to leave the plan unchanged.

## Prefer explicit state and cases

When the domain has a small closed set of cases, show those cases directly. Do
not replace a discriminated state with a compressed ternary or model a maximum
of two affected roots as an arbitrary loop. The reader should not mentally
derive which branch applies.

Evidence: traces `19ec15309dc82d5bcb2c0a6362320260` and
`ba881d846c2d1ab4afec4c5e388de266` favored explicit state branches and a named
two-root condition.

## Do not persist transient behavior

Search, hover, loading, focus, and other transient presentation state must not
overwrite durable user preference merely because both influence the same
rendered result. Derive visibility when possible. Persist only the event whose
contract actually changes stored preference.

Evidence: trace `a8b174fe00d1f7af7fca32cd6753fb55` found search-driven tree
expansion clobbering local storage.

## Abstractions must earn their place

Hooks, helpers, services, dataclasses, options, and wrappers are not inherently
cleaner. Keep them only when they own policy, an invariant, a domain step, or
real repeated behavior. Inline one-off forwarding. Accept some duplication when
reuse obscures a simple operation or forces unrelated callers through one
mental model.

Evidence: traces `2c92e04ebaee1240ecc08b146a218229`,
`50202a53445990b463cb37514b0406a2`, and
`f6a6248a7c345f73104c3ea771c3b01e` challenged reuse burden, static-method
ceremony, and overlapping context mechanisms.

## Boundaries and names should carry the domain

Complex code should read in the vocabulary of the operation. Keep coordination
high-level and put detach, attach, overlap, persistence, or equivalent policy in
the boundary that owns it. Use explicit signatures and types. A vague helper or
prop name that needs repeated explanation is evidence the shape is wrong.

Evidence: traces `caff0e7a17a189052c526b1cc95f5d9d`,
`f8a07d7941bdbf8aa7cbe7acabdc548a`, and
`acffbab7-24e5-4498-9feb-c30e3e43c01a` emphasized domain-shaped boundaries,
legible prop names, and explicit generics.

## Protect scope and product behavior

Do not turn an internal implementation convenience into a product change. Do
not pull an unrelated refactor into the diff because the files are nearby. Every
changed mechanism should connect to the plan's outcome, and every preserved
interaction should remain observable after the change.

Evidence: traces `e52abded339848b19548104ea891fbb9` and
`300ccf3122dead62402b12d32d1ad8d1` challenged an unacceptable hover-to-click
behavior change and demanded a concrete scope connection.

## Verify the real contract

Tests should cover the behavioral cases and the layer where failure occurs.
For stateful changes, include inactive, partial, and globally empty or terminal
states as applicable. For backend constraints, distinguish compile-time,
validation-time, service, repository, and database enforcement rather than
assuming ordinary callers prove the invariant.

Evidence: traces `7a7c583bcfded7aea23b9f4393b83a21`,
`f8f91b2441b94414a83efeb45f7bfd0a`, and
`0cf142d1f6f467d531c93830db66913f` required concrete test cases, scoped state
coverage, and precise enforcement-layer reasoning.
