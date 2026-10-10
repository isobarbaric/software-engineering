# software-engineering

`software-engineering` is Krish's personal Codex skill system for turning a
high-level blueprint into an implementation-grade plan, executing that plan,
and verifying the result without collapsing planning and coding into one role.

## Orchestration entrypoint

| Skill | Responsibility |
| --- | --- |
| `execute` | Frame a blueprint, preserve the working artifacts, and route work between the two roles. |

Use `execute` when starting with a blueprint and asking
`software-engineering` to carry it through planning, implementation, and
evidence-based completion. It is the one entrypoint for the complete workflow.
It invokes high-level roles; it does not perform their work or select helpers
for them.

## High-level role skills

| Skill | Responsibility |
| --- | --- |
| `engineer` | Investigate the repository and produce or revise a portable, code-level implementation contract. |
| `implement` | Execute an approved plan, preserve its decisions, and return material deltas instead of silently redesigning. |

These roles have disjoint ownership. `engineer` owns the plan and does not edit
product code. `implement` owns the code and does not silently revise material
plan decisions. Either role can be invoked directly when the user is already
at that point in the workflow.

There is deliberately no separate QA role and no fixed workflow state machine.
Verification is an implementation responsibility, while material discoveries
return to the engineer as decision deltas.

## Common helper pool

| Skill | Responsibility |
| --- | --- |
| `build-frontend` | Supply React and TypeScript rules for ownership, state, effects, caches, routing, composition, and interaction. |
| `build-backend` | Supply backend rules for service boundaries, persistence, authorization, background work, and external effects. |
| `build-migrations` | Supply schema-evolution, migration-review, rollout, compatibility, and forward-recovery rules. |
| `name-software-concepts` | Choose or review names whose semantics, ownership, lifecycle, or discovery behavior carry engineering meaning. |
| `verify-implementation` | Prove completed work against the plan, domain contracts, and actual failure boundaries. |
| `write-code-comments` | Write or revise only comments and docstrings that preserve non-obvious reasons, constraints, or invariants. |

Helpers are not additional workflow roles. They provide focused domain rules or
procedures inside a role's assignment and never orchestrate the overall task.
`engineer` and `implement` select from the pool as needed while staying within
their own responsibility. In the normal workflow, verification remains the
implementer's self-gate rather than an independent approval role.

Both roles use `name-software-concepts` for consequential vocabulary. The
engineer uses it to make plan terminology and public contracts unambiguous; the
implementer uses it for plan-compatible names and to identify naming collisions
that must return to engineering as decision deltas.

## Design constraints

- A blueprint remains the intent contract; engineering decisions do not
  silently rewrite it.
- A fresh implementer should be able to execute the engineering plan with
  repository access and no hidden conversation context.
- Material product, contract, ownership, data, authorization, scope, or rollout
  discoveries return to the engineer.
- Completion requires direct, risk-proportional evidence for every material
  contract.
- Skills may load only helpers surfaced in Codex's available-skills catalog.
- Commits, pushes, pull requests, deployments, and messages require separate
  authorization from blueprint execution.

## Install

Clone the repository and copy the desired skill directories into the Codex
skills directory:

```sh
git clone https://github.com/isobarbaric/software-engineering.git
cd software-engineering
rsync -a skills/ /Users/krish/.codex/skills/
```

Restart or reload Codex if its skill catalog does not refresh automatically.

## Repository layout

Each directory under `skills/` is independently installable. A skill keeps its
entrypoint in `SKILL.md`, focused guidance in `references/`, and UI metadata in
`agents/openai.yaml`.
