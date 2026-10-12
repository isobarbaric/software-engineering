---
name: execute
description: Orchestrate a high-level software blueprint through engineering, implementation, and evidence-based completion. Use when the user wants one entrypoint to carry a blueprint through the full coding workflow without collapsing role boundaries.
---

# Execute

Own orchestration, not design or code. Accept a high-level blueprint, preserve
its intent, and invoke the role the work currently needs.

## Skill hierarchy

```text
execute
├── engineer
│   └── applicable helper skills
└── implement
    └── applicable helper skills
```

`$execute` invokes only the two role skills. It does not load build, naming,
commenting, verification, delivery, or other helper skills on their behalf.
`$engineer` and `$implement` choose helpers from the available-skills catalog
according to their own responsibility and the changed concerns.

Helpers supply domain rules or bounded procedures. They do not own the overall
workflow, call `$execute`, or blur the engineer/implementer boundary. A helper
may be shared by both roles when it carries domain truth both need.

A blueprint may be a formal project document or an informal high-level plan.
Identify which one the user supplied. Treat it as the intent contract: outcome,
constraints, acceptance criteria, and non-goals. Do not silently add code-level
decisions to make it appear implementation-ready.

Read [handoff-contracts.md](references/handoff-contracts.md) before delegating.

## Frame the work

Restate the smallest honest problem:

- desired observable result;
- preserved behavior;
- constraints and explicit exclusions;
- acceptance evidence already required;
- unknowns that could materially alter product behavior or scope.

This framing is not the engineering plan. Its purpose is to give `$engineer` a
bounded intent contract without solving the problem on the orchestrator's
behalf.

## Orchestrate adaptively

Invoke `$engineer` to investigate the repository and produce the current
implementation contract. When delegation is available, use a separate
engineer agent and give it the blueprint plus the minimum repository context;
otherwise apply the engineer skill with a strict no-code boundary.

Once the contract is implementation-ready, invoke `$implement` with the current
complete plan, not a conversational summary. When delegation is available, use
a separate implementer agent so it receives the explicit handoff rather than
the engineer's private reasoning.

Do not impose a phase enum or transition table. Choose the next role from the
current unmet need:

- incomplete or contradicted plan → engineer;
- settled plan with executable work → implementer;
- material implementation discovery → engineer, then resume affected work;
- implementation defect inside the settled plan → implementer;
- missing verification evidence → implementer, which uses
  `$verify-implementation`;
- genuinely human-owned decision → user, with evidence and recommendation.

Allow unaffected implementation to continue when it cannot prejudice a pending
decision. Do not restart completed work merely because one plan section changed.

## Preserve the working artifacts

Maintain four coherent artifacts in task-visible context or the repository's
established planning location:

- the original blueprint;
- the current complete implementation contract;
- concise decision notes for material deltas and superseded choices;
- verification evidence and limitations.

Do not require a fixed file path when the repository already has an established
home. Do not rely on hidden reasoning or chat chronology to make a handoff
understandable.

## Non-negotiable invariants

1. Do not implement from an ambiguous blueprint while a missing architecture or
   product decision would materially change the result.
2. Do not let the implementer silently resolve a material decision delta.
3. Do not claim completion without verification proportional to the changed
   boundary.

These invariants constrain unsafe outcomes without prescribing one sequence for
every task.

## Complete

Complete when the current implementation contract covers the blueprint, the
implementation matches that contract, and the implementer's
`$verify-implementation` handoff returns `VERIFIED`. If it returns
`VERIFIED WITH LIMITATIONS`, present the missing evidence and residual risk for
the user's decision; do not silently promote it to completion.

For TypeScript or Python changes, require the implementer's
`@isobarbaric/code-contracts` deterministic-linter evidence before accepting
`VERIFIED`. Missing evidence or unresolved violations cannot count as a passed
check. The role skills own the procedure; do not select or run helpers on their
behalf.

Return one consolidated handoff: blueprint outcome, material engineering
decisions, implementation summary, verification evidence, unresolved limits,
and any separately authorized delivery actions.

Blueprint execution authorizes planning, in-scope code changes, and
verification. It does not by itself authorize commits, pushes, pull requests,
deployments, messages, or other external workflow mutations.
