# software-engineering

Skills for coding agents to plan, implement, and verify software changes,
plus a deterministic linter for TypeScript, React, and Python.

## Workflow

Use `execute` to take a blueprint through planning, implementation, and
verification. It delegates to two roles:

| Skill | Responsibility |
| --- | --- |
| `engineer` | Investigate the repository and produce an implementation plan. |
| `implement` | Execute the plan, verify the result, and return material decisions to engineering. |

Either role can also be invoked directly. Planning and coding have separate
owners; verification is part of implementation.

## Helpers

`engineer` and `implement` select helpers as needed:

| Skill | Responsibility |
| --- | --- |
| `branch-from-main` | Create a PR branch from `main` with a matching commit message. |
| `switch-local-branch` | Switch branches while preserving uncommitted work. |
| `build-frontend` | Apply React and TypeScript architecture and interaction rules. |
| `build-backend` | Apply rules for APIs, services, persistence, and external effects. |
| `build-migrations` | Plan and review schema changes, rollout, and recovery. |
| `name-software-concepts` | Choose clear names for software concepts and contracts. |
| `verify-implementation` | Verify implementation against its plan and failure boundaries. |
| `write-code-comments` | Explain non-obvious reasons, constraints, and invariants. |

## Improve skills from a conversation

At the end of an engineering conversation, invoke:

```text
$improve-engineering-skills
```

The skill reviews the conversation for reusable lessons, checks the relevant
source skills, and opens a focused pull request when changes are warranted.
It distinguishes missing guidance from execution mistakes and stale installed
copies. It may conclude that no skill changes are needed. Add `review-only` to
request findings without edits or a PR. Proposed changes do not update installed
skills until you install them.

## Install

Clone the repository and copy the desired directories from `skills/` into your
coding agent's skills directory. Each skill is independently installable.
Replace `/path/to/agent/skills/` with the directory used by your agent:

```sh
git clone https://github.com/isobarbaric/software-engineering.git
cd software-engineering
rsync -a skills/ /path/to/agent/skills/
```

Reload your agent if its skill catalog does not refresh automatically.

## Linter

[`@isobarbaric/code-contracts`](packages/code-contracts/README.md) checks
TypeScript, React, and Python sources. It requires Node.js 20+, the pnpm version
pinned in `package.json`, and `python3` for Python sources.

From this checkout, install dependencies and check changes in a target repository:

```sh
pnpm install --frozen-lockfile
pnpm contracts:check \
  --repo /path/to/target-repository \
  --changed-since origin/main \
  --profile general
```

Replace the target path and comparison ref with your repository and PR base.
Use `software-factory` for additional rules specific to `sf-platform`.
See the [linter documentation](packages/code-contracts/README.md) for rules and
CLI scopes, and the [verification procedure](skills/verify-implementation/references/deterministic-lint.md)
for required workflow checks.
