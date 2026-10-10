# Reviewing migrations

Review migrations as deployed state transitions, not isolated Python files.
The review must establish the migration graph, final model shape, intermediate
deployment states, data behavior, and operational recovery before judging the
diff.

## Establish the review target

Resolve the actual base branch or pull-request base. Do not assume `main` when
reviewing a release backport or stacked branch.

Identify every changed revision and persisted model. Useful commands include:

```bash
git diff --name-only <base>...HEAD -- backend/migrations/versions/
git diff <base>...HEAD -- backend/migrations/versions/ backend/software_factory/
```

For a pull request, use its authoritative base and full diff. Read the entire
migration file, including its module docstring, not only changed hunks.

Build a model-to-migration inventory containing:

- revision ID, parents, dependencies, and phase functions;
- every changed table, column, nullability rule, default, relationship, foreign
  key, check, uniqueness rule, and index;
- the matching model declaration and application assumption;
- the source and destination meaning for every data movement;
- the operation's pre-deploy, post-deploy, background, or later-contract phase.

Flag model changes without matching operations and operations without an
explained model, data, or operational purpose. The migration docstring should
state scope, mappings, and non-obvious edge cases.

## Inspect graph integrity

- Do not allow an existing published revision's parent or dependency to change.
- Several heads may be valid. Sibling revisions must commute unless an explicit
  dependency orders them.
- Check both DDL overlap and `post_deploy()` reliance between siblings.
- A release backport must attach to the release graph, not an unrelated newer
  head.
- A marker saying one revision repeats another is safe only for a deliberate
  late backport whose two operations are independently idempotent.
- Scan the entire unmerged branch or release train for avoidable create-then-
  drop, widen-then-narrow, or add-then-replace churn. Consolidate unpublished
  revisions unless a real deployed state requires the intermediate step.

## Review defect classes

For each finding, identify the concrete affected rows or deployment state and
the mechanism by which it fails.

### Critical correctness

Check for:

- sibling migrations whose execution order changes the result;
- re-parented or rewritten published history;
- source-to-destination semantic mismatches;
- enum or closed-value casing and value mismatches;
- assumptions that a referenced type, table, column, or constraint already
  exists;
- empty-set predicates whose SQL matches no rows or every row unexpectedly;
- historical actor, timestamp, source, or provenance overwritten by a new
  default;
- broad exception handling that silently skips unaccounted rows;
- pre-deploy behavior that depends on live database inspection and therefore
  cannot render deterministically offline;
- application code that requires post-deploy work to have completed before it
  can start safely.

### Data integrity

Check for:

- incomplete backfills before `NOT NULL`, foreign key, check, or unique
  enforcement, including soft-deleted and historical rows;
- nullable source values mapped into required destination facts without an
  explicit semantic rule;
- dangling current/live pointers, duplicate live versions, sibling-position
  collisions, or broken parent links in versioned structures;
- loss of original timestamps, owners, IDs, or relationships;
- polymorphic type-plus-ID references the database cannot enforce;
- foreign-key `ondelete`, nullability, and cascade behavior that contradicts
  product lifecycle;
- deployed schemas left broken because an applied migration was emptied,
  reverted, or rewritten instead of repaired forward;
- retries that duplicate rows or make partial progress indistinguishable from
  completion;
- reverse DDL or data movement that can destroy newer rows, violate foreign
  keys, or pretend to restore an unrecoverable old state.

### Performance and availability

Check realistic volume and concurrency for:

- unbounded `fetchall()` or in-memory materialization;
- row-by-row DML or lookup loops where set-based SQL or bounded bulk work is
  available;
- large Python `IN (...)` lists instead of database-side joins or subqueries;
- repeated scope loops that rescan the same tables;
- table rewrites, scans, or constraint validation in the startup-critical
  phase;
- ordinary blocking index creation instead of the repository's online or
  concurrent procedure;
- long transactions without progress, timeout, batching, or recovery behavior.

### Design and operability

Check for:

- JSON used as the default home for queryable, authorized, or evolving product
  state;
- feature-specific state added to a hot aggregate table without lifecycle or
  ownership justification;
- missing indexes for actual scoped lookup paths;
- placeholder timestamps, owners, or IDs despite authoritative source data;
- fragile bot, actor, or row classification based on display-name patterns;
- migration files introduced when no durable schema or data transition exists;
- formatting churn or unrelated edits to historical revisions;
- missing progress and completion evidence for long-running work.

## Verify deployment phases

The new application must work after pre-deploy and before any post-deploy work
runs. The old application must remain compatible while expansion occurs when a
mixed-version window exists.

For each operation, report:

- assigned phase and why;
- lock level, table scan or rewrite, and expected data volume;
- compatibility with old and new application versions;
- retry behavior after interruption;
- forward repair or whole-database restoration boundary.

A bounded, recoverable unique-index enforcement window is an operational
tradeoff, not automatically a blocker. It becomes blocking when the plausible
race creates a security violation, unrecoverable corruption or loss, broad
availability failure, or another explicitly unacceptable product outcome.

For a new unique index on existing data, require evidence that the process:

- detects duplicates immediately before creation;
- reuses only an exact valid index definition;
- repairs or recreates an invalid or wrong-definition index;
- survives interruption and retry;
- exercises a conflicting write when that race is plausible.

## Verification evidence

Require the checks that prove the relied-on boundaries, which may include:

- fresh-database upgrade;
- upgrade from representative existing data;
- model-to-schema alignment;
- application operation before post-deploy completes;
- interrupted post-deploy or concurrent-index retry;
- sibling-head ordering or dependency behavior;
- fail-loud downgrade behavior and the documented forward recovery path;
- critical query plan, lock, and runtime checks on realistic PostgreSQL.

Tests and documentation do not clear an unresolved correctness violation. They
must either prove the suspected mechanism cannot occur or accompany a code or
design change that removes it.

## Findings standard

Report only actionable defects. Group findings from critical to low. Each
finding must state:

1. the defect;
2. the exact rows, graph state, deployment phase, or concurrent operation that
   triggers it;
3. the consequence;
4. the concrete correction.

Critical and high findings are blocking. For Software Factory DBA review, begin
each such finding with:

`🚨 BLOCKING DBA RULES VIOLATION`

Use `REQUEST_CHANGES` when the review system supports a formal verdict; otherwise
report `Verdict: REQUEST_CHANGES`. On a rerun, clear a blocker only when the new
diff or authoritative runtime evidence removes its mechanism. Do not downgrade
an unresolved defect merely because the author documented or acknowledged it.

A review request authorizes inspection and findings, not implementation. Apply
fixes only when separately requested, in severity order, and re-run the complete
inventory and phase review afterward.
