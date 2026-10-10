# Decision deltas

A decision delta is new evidence that invalidates a material assumption in the
approved plan. It is not every implementation detail the plan omitted.

## Resolve locally

Use source evidence and repository convention for mechanical choices such as:

- a symbol moved but still has the planned responsibility;
- an import path, fixture, or focused command changed;
- a local type can be made more precise without changing a contract;
- neighboring code establishes an unambiguous convention;
- a private implementation detail has one clearly superior expression.

Document consequential local choices in the handoff. Do not bounce routine
coding decisions back to the engineer.

## Return to the engineer

Raise a delta when evidence changes any of these:

- observable product behavior or a public contract;
- authorization, data meaning, persistence, migration, or deployment;
- the component, service, or layer that must own the behavior;
- the approved scope or a stated non-goal;
- the architecture required to make the plan safe;
- a plan invariant contradicted by the current code;
- two materially different designs with no source-backed winner.

The delta must cite inspected code, tests, runtime evidence, or an authoritative
repository rule. A vague concern is not a decision point.

Use this format:

```md
## Decision delta: <short title>

- Discovery: <what is true now>
- Evidence: <files, symbols, tests, or runtime observation>
- Invalidated assumption: <the exact plan statement that no longer holds>
- Impact: <behavior, contract, scope, or ownership affected>
- Recommendation: <one preferred choice and why>
- Safe continuation: <unaffected work that can continue>
```

Continue unaffected plan steps when doing so cannot prejudice the decision.
Stop the affected path. Do not edit the plan, ask an unframed technical
question, or encode uncertainty as optionality, a fallback, or a second path.
