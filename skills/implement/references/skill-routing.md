# Skill routing

Use only skills surfaced in the available-skills catalog. If repository
instructions reference a skill that is not surfaced, report the conflict; do
not read it from a product-specific skill directory.

## Select every changed build surface

| Surface | Skill |
| --- | --- |
| React or TypeScript application behavior | `$build-frontend` |
| Backend application behavior | `$build-backend` |
| Persisted schema or data evolution | `$build-migrations` |

These surfaces compose. A full-stack persisted feature may require all three.
Do not choose one primary label and ignore another changed contract.

Read the selected entrypoint completely and only the focused references relevant
to the plan. Repository instructions remain authoritative when they do not
conflict with skill isolation or higher-priority instructions.

## Apply the remaining helpers and constraints

- Use `write-code-comments` when adding or revising comments or docstrings.
- Use `$verify-implementation` for the implementation self-gate.
- When introducing or changing identifiers or domain vocabulary, name the real
  owner, scope, lifecycle, and operation; match mature repository convention
  and propagate the rename through every affected surface without aliases.
- Treat branch creation, previews, commits, pushes, pull requests, and
  deployments as separate delivery actions. Perform them only when the user
  authorizes them, using the repository's established workflow.

Do not load independent PR-review, exploratory QA, deployment, or external
workflow skills merely because implementation touched related code. Those are
separate requested modes.
