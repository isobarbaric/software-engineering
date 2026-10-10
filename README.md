# kstack

`kstack` is Krish's personal Codex software-delivery stack. It turns a
high-level blueprint into an implementation-grade plan, executes that plan,
and verifies the result without collapsing planning and coding into one role.

## Hierarchy

```text
execute
├── engineer
│   └── applicable helper skills
└── implement
    └── applicable helper skills
```

`execute` is the single orchestration entrypoint. It calls only the two role
skills. `engineer` owns the implementation contract; `implement` owns code and
evidence. Those roles select helper skills according to the changed concerns.

There is deliberately no separate QA role and no fixed workflow state
machine. Verification is an implementer responsibility, while material
discoveries return to the engineer as decision deltas.

## Skills

| Skill | Responsibility |
| --- | --- |
| `execute` | Frame a blueprint, preserve the working artifacts, and route work between the two roles. |
| `engineer` | Investigate the repository and produce or revise a portable, code-level implementation contract. |
| `implement` | Execute an approved plan, preserve its decisions, and return material deltas instead of silently redesigning. |
| `build-frontend` | Supply React and TypeScript rules for ownership, state, effects, caches, routing, composition, and interaction. |
| `build-backend` | Supply backend rules for service boundaries, persistence, authorization, background work, and external effects. |
| `build-migrations` | Supply schema-evolution, migration-review, rollout, compatibility, and forward-recovery rules. |
| `verify-implementation` | Prove the completed work against the plan, domain contracts, and actual failure boundaries. |

The `build-*` skills are shared domain truth: both `engineer` and `implement`
may use them. `verify-implementation` is an implementer self-gate, not an
independent approval role.

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

