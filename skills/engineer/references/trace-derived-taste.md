# Trace-Derived Engineering Taste

These patterns come from a bounded Langfuse review of Krish's Codex and Cursor
sessions. Apply the repeated decision pattern, not the literal historical fix.

## Plans must carry the implementation model

A natural-language checklist is insufficient when the design depends on state
ownership, branching, or boundary placement. Name the actual files, symbols,
data shape, state partition, and tests. Small representative code or signatures
are useful when they remove ambiguity. The plan must still explain why the
shape is correct rather than becoming an unexplained patch dump.

Evidence: trace `7a7c583bcfded7aea23b9f4393b83a21` corrected a prose-only
plan into concrete tree visibility derivations, view-model fields, render
branches, tests, and explicit untouched surfaces.

## Model every distinct case

Do not collapse behavior into one global boolean when the domain has multiple
levels or scopes. Enumerate the cases and their precedence, including inactive
and no-op states. A fixed two-case operation should usually read as two explicit
cases rather than as a generic collection loop.

Evidence: traces `f8f91b2441b94414a83efeb45f7bfd0a` and
`ba881d846c2d1ab4afec4c5e388de266` distinguished global versus tree-scoped
empty states and one-root versus two-root mutation behavior.

## Make ownership visible

Separate transient presentation state from persisted user preference, derived
state from stored state, and module-specific policy from shared primitives.
Plans should change the lowest honest owner and leave unrelated shared surfaces
alone.

Evidence: trace `a8b174fe00d1f7af7fca32cd6753fb55` exposed search-driven
visibility incorrectly writing a persistent expansion preference.

## Demand a reason for every concept

Every hook, helper, service, field, option, and compatibility path has a burden
of proof. Search for the existing seam first. Remove an abstraction when its
reuse cost or reader burden exceeds the policy it centralizes.

Evidence: traces `f6a6248a7c345f73104c3ea771c3b01e`,
`2c92e04ebaee1240ecc08b146a218229`, and
`1757819d453283c76d563dd661f92769` repeatedly challenged overlapping context
fields, reuse that consumed too much mental bandwidth, and redundant resolution.

## The code structure should explain the operation

For genuinely complex work, boundaries should follow the domain steps and use
the same vocabulary throughout variables, methods, logs, and tests. A reader
should see the whole operation from the coordinator without opening every
helper. This does not justify one-call wrappers; each boundary must own a real
part of the operation.

Evidence: trace `caff0e7a17a189052c526b1cc95f5d9d` required move-service
boundaries to expose source, destination, detach, attach, overlap, and affected
roots.

## Prove scope and disagree honestly

Connect every planned change to the promised outcome. Split unrelated work
instead of rationalizing it into the same pull request. When challenged, defend
the design with a concrete failure mechanism or change the plan; never comply
without evaluating the premise.

Evidence: traces `300ccf3122dead62402b12d32d1ad8d1` and
`3dc70ba8070f5845e621c8cb0e766806` demanded scope justification and an
independent correctness argument.

## Name the enforcement layer

For every invariant, say whether it is enforced by the type system, schema,
controller, service, repository, database, or runtime environment. Do not claim
an invariant merely because ordinary callers happen to follow it.

Evidence: trace `0cf142d1f6f467d531c93830db66913f` distinguished a backend
Pydantic requirement from a weaker optional frontend type.
