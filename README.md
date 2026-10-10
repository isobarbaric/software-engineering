# kstack

`kstack` is Krish's personal Codex software-delivery stack. It turns a
high-level blueprint into an implementation-grade plan, executes that plan,
and verifies the result without collapsing planning and coding into one role.

## Skill layers

```text
Layer 1: orchestration entrypoint
  execute
    └── invokes the role the work currently needs

Layer 2: high-level role skills
  engineer        implement
      └── select applicable helpers ──┘

Layer 3: bounded helper skills
  build-frontend    build-backend    build-migrations
  verify-implementation             write-code-comments
```

The layers describe responsibility, not a fixed sequence. `execute` never does
engineering, coding, or helper work itself. It invokes only `engineer` and
`implement`, which select the applicable helpers for the work they own.

There is deliberately no separate QA role and no fixed workflow state
machine. Verification is an implementer responsibility, while material
discoveries return to the engineer as decision deltas.

### 1. Orchestration entrypoint

| Skill | Responsibility |
| --- | --- |
| `execute` | Frame a blueprint, preserve the working artifacts, and route work between the two roles. |

Use `execute` when starting with a blueprint and asking kstack to carry it
through planning, implementation, and evidence-based completion. It is the one
top-level entrypoint for the complete workflow.

### 2. High-level role skills

| Skill | Responsibility |
| --- | --- |
| `engineer` | Investigate the repository and produce or revise a portable, code-level implementation contract. |
| `implement` | Execute an approved plan, preserve its decisions, and return material deltas instead of silently redesigning. |

These roles have disjoint ownership. `engineer` owns the plan and does not edit
product code. `implement` owns the code and does not silently revise material
plan decisions. Either role can be invoked directly when the user is already
at that layer of the workflow.

### 3. Helper skills

| Skill | Used by | Responsibility |
| --- | --- | --- |
| `build-frontend` | `engineer`, `implement` | Supply React and TypeScript rules for ownership, state, effects, caches, routing, composition, and interaction. |
| `build-backend` | `engineer`, `implement` | Supply backend rules for service boundaries, persistence, authorization, background work, and external effects. |
| `build-migrations` | `engineer`, `implement` | Supply schema-evolution, migration-review, rollout, compatibility, and forward-recovery rules. |
| `verify-implementation` | `implement` | Prove completed work against the plan, domain contracts, and actual failure boundaries. |
| `write-code-comments` | `implement` | Write or revise only comments and docstrings that preserve non-obvious reasons, constraints, or invariants. |

Helpers are not additional workflow roles. They provide focused domain rules or
procedures inside a role's assignment and never orchestrate the overall task.
The `build-*` skills are shared domain truth; `verify-implementation` is an
implementer self-gate, not an independent approval role.

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
git clone https://github.com/isobarbaric/kstack.git
cd kstack
rsync -a skills/ /Users/krish/.codex/skills/
```

Restart or reload Codex if its skill catalog does not refresh automatically.

## Repository layout

Each directory under `skills/` is independently installable. A skill keeps its
entrypoint in `SKILL.md`, focused guidance in `references/`, and UI metadata in
`agents/openai.yaml`.
