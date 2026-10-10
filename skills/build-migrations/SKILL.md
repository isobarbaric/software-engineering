---
name: build-migrations
description: Design, implement, or review persisted schema and data evolution, including models, migrations, rollout phases, compatibility windows, locking, retries, and forward recovery. Use whenever stored shape or meaning changes, even if no migration file has been requested yet.
---

# Build Migrations

Treat a migration as a production rollout artifact, not a code-generation
byproduct. This skill owns persisted-shape evolution. Compose it with
`$build-backend` when application behavior changes with the schema.

Repository instructions own concrete commands, framework conventions, and
deployment policy. Use only skills surfaced in the available-skills catalog;
report a conflicting reference instead of loading an undisclosed repository
skill.

## Establish the data transition

Before changing a model or migration, determine:

- the current deployed schema and migration graph;
- the target schema and the invariant it enables;
- existing row volume, nullability, and value distribution where relevant;
- which application versions may read or write during rollout;
- whether the change is additive, backfill, cutover, contract, or cleanup;
- lock, index-build, transaction, and retry behavior;
- whether an existing revision is unpublished or already part of shared history;
- the forward recovery path if deployment stops halfway.

Do not create a migration merely because a model diff exists. Do not omit one
merely because application code can temporarily tolerate schema drift.

## Read the applicable guidance

- Read [schema-and-data.md](references/schema-and-data.md) for table, column,
  relationship, constraint, index, enum-like value, and backfill decisions.
- Read [rollout-and-recovery.md](references/rollout-and-recovery.md) for phased
  compatibility, locks, retries, history, and operational verification.
- Read [reviewing-migrations.md](references/reviewing-migrations.md) when
  reviewing a branch or pull request, and use its final-diff pass before
  handing off a migration you implemented.

Use `$build-backend` for the application, model, repository, and transaction
boundaries around the migration.

## Implement

- Keep models, migrations, constraints, relationships, and application
  assumptions aligned.
- Preserve published migration identity and branch history. Correct shipped or
  shared history with a new forward revision unless the repository explicitly
  defines another safe procedure.
- Separate expansion, data movement, application cutover, and contraction when
  old and new code can overlap.
- Make backfills bounded, observable, restartable, and idempotent when their
  scale or failure mode requires it.
- Name the database behavior being relied on: constraint validation, lock mode,
  index build, transaction scope, server default, or application write path.
- Never represent an unresolved rollout decision as permanent nullability,
  duplicate columns, or an indefinite dual-write path.

## Verify and hand off

Inspect generated or handwritten operations rather than trusting autogenerate.
Verify the paths relevant to the change: fresh database upgrade, upgrade from
realistic existing state, model/schema alignment, retry after partial progress,
multiple-head behavior, application compatibility, and critical query plans or
locks.

For review-only requests, do not edit the migration or apply proposed fixes
unless the user separately authorizes implementation. Report actionable
findings against the reviewed diff using the severity and evidence standard in
[reviewing-migrations.md](references/reviewing-migrations.md).

Report the migration graph change, deployment phases, compatibility window,
data movement, lock and runtime expectations, verification evidence, and exact
forward recovery plan. If any of those are unknown and material, return a
decision delta instead of shipping assumptions.
