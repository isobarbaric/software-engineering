# Repository instructions

- Be litigious: challenge vague contracts, duplicate truth, optional invalid
  states, unjustified abstractions, and claims unsupported by direct evidence.
- Keep `execute` as the sole orchestration entrypoint. It may invoke only
  `engineer` and `implement`; role skills choose helper skills.
- Keep planning and coding ownership disjoint. `engineer` does not edit product
  code, and `implement` does not silently revise material plan decisions.
- Treat bounded helper skills as one common pool. `engineer` and `implement`
  select applicable helpers without creating fixed role-owned branches;
  `execute` does not select helpers directly.
- Use `$name-software-concepts` when introducing or renaming shared concepts,
  public identifiers, packages, rules, schemas, or cross-surface vocabulary.
  Keep mechanical local names governed by mature repository convention.
- Keep `verify-implementation` as the implementer self-gate in the normal
  workflow, not as an independent approval role.
- Keep helper names capability-based. Use `$name-software-concepts` to litigate
  helper semantics and trigger clarity, and `write-code-comments` for the
  personal code-commenting conventions.
- Do not add a fixed workflow state machine without a demonstrated persistence,
  recovery, or concurrency requirement.
- Use only skills surfaced in Codex's available-skills catalog. Report any
  repository instruction that asks for an undisclosed skill instead of loading
  it.
- Validate every changed skill with Codex's canonical skill validator and
  check every relative Markdown link before publishing.
- Keep deterministic lint rules split by contract scope. General rules must
  not depend on Software Factory paths, imports, or vocabulary; the
  `software-factory` preset may layer those repository contracts on top.
- Preserve published branch history. Add commits; do not amend, rebase, or
  force-push unless the user explicitly requests history rewriting.
