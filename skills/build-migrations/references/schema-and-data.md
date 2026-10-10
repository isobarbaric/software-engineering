# Schema and data

Design the durable model from invariants and access patterns, not from the most
convenient application object.

## Shape

- Put required facts behind `NOT NULL` or an equivalent durable invariant once
  the rollout can support it.
- Use foreign keys and checks for relationships and closed conditions that must
  survive every caller.
- Treat indexes as part of the query contract. Match their columns, ordering,
  predicates, and uniqueness to actual reads and writes.
- Give enum-like stored values an explicit compatibility story. Application
  enums, constraints, and existing rows must agree during rollout.
- Keep subtype-specific facts off shared base tables unless every subtype owns
  the same meaning.

Avoid duplicate persisted facts that can disagree. Prefer deriving a value from
its owner unless durable denormalization has a measured read benefit and a
single maintenance path.

## Existing data

Inspect reality before choosing a backfill:

- row count and growth rate;
- null and distinct-value distribution;
- invalid or orphaned rows;
- write traffic during deployment;
- IDs and relationships that must remain stable;
- whether data can be repointed instead of copied.

A new table does not itself justify duplicating old data. Name the product and
query behavior that requires movement.

## Backfills

Choose among migration-time SQL, a post-deploy command, or background work
based on volume, lock duration, retry needs, and observability. Large or
externally coupled backfills do not belong in a blocking schema transaction.

For an operational backfill, define deterministic batches, ordering, checkpoint
or idempotency behavior, metrics, retry limits, and the condition that proves it
complete before contraction.
