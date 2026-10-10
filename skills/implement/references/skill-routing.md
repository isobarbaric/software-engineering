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

## Add conditional catalog skills

- Use `naming-litigation` when introducing or changing identifiers or domain
  vocabulary.
- Use `write-code-comments` when adding or revising comments or docstrings.
- Use `$verify-implementation` for the implementation self-gate.
- Use `branch-from-main` only when the user asks for branch creation or its
  naming output.
- Use `manage-ephemeral-previews` only when the user asks for a preview or the
  approved plan explicitly requires that environment and authority exists.

Do not load independent PR-review, exploratory QA, deployment, or external
workflow skills merely because implementation touched related code. Those are
separate requested modes.
