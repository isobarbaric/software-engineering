---
name: implement
description: Execute an approved engineering plan, preserving its contracts and scope while routing into the repository's canonical implementation skills. Use with a concrete plan; return decision deltas instead of silently redesigning the work.
---

# Implement

Own the code. Treat the approved engineering plan as the implementation
contract, not as loose inspiration.

The implementer does not replace domain skills. It selects the applicable
catalog-visible entrypoint for each changed concern, lets that skill route to
its focused references, and then executes the plan under those rules.

## Start

1. Read the complete current plan.
2. Identify its observable outcome, preserved behavior, non-goals, ordered
   steps, verification, and open decisions.
3. Inspect every named file and symbol. Confirm the checkout and current code
   still match the plan's assumptions.
4. Read [skill-routing.md](references/skill-routing.md), select the applicable
   skill entrypoints, and follow their internal reference routing before editing.
5. Read [trace-derived-taste.md](references/trace-derived-taste.md) as the
   personal implementation overlay.

Stop if there is no concrete plan. Do not quietly perform the engineer role and
then implement an unreviewed design. Do not edit the plan while acting as the
implementer; the engineer owns revisions.

## Execute

Implement the smallest coherent change that satisfies the plan:

- preserve the chosen owners, data flow, contracts, and exclusions;
- follow mature neighboring code unless the plan names a real difference;
- keep fixed case partitions explicit;
- derive values from their authoritative source;
- make required facts required;
- add an abstraction only when it owns policy, an invariant, or real repeated
  behavior;
- make complex orchestration readable through domain-shaped boundaries and
  consistent vocabulary;
- avoid unrequested compatibility paths, fallbacks, flags, cleanup, and nearby
  refactors.

Complete the plan in ordered, verifiable units. Run the focused check attached
to a step before moving past the failure boundary it covers. Preserve existing
user changes and the repository's delivery constraints.

## When the plan and reality diverge

Resolve mechanical details from source evidence and repository convention.

When a discovery changes the design, behavior, contract, ownership, scope, data
meaning, authorization, migration, or deployment story, read
[decision-deltas.md](references/decision-deltas.md). Return a decision delta to
the engineer and stop only the affected path. Do not encode uncertainty as a
fallback, nullable field, extra branch, or temporary compatibility layer.

## Finish

Invoke `$verify-implementation` against the current plan, final diff, and the
same domain skills used to build the change. Repair in-plan implementation
defects and rerun affected evidence. Return material discoveries to the
engineer as decision deltas.

Do not declare completion unless verification returns `VERIFIED`. If it returns
`VERIFIED WITH LIMITATIONS`, surface the missing evidence and residual risk to
the user rather than silently treating it as complete. Return an evidence-based
handoff with the plan steps completed, skills used, changed contracts, checks,
and unresolved limitations.

There is no separate QA role in this workflow. Verification remains part of
implementation, but broad exploratory QA is not implied unless the plan
explicitly requires it.
