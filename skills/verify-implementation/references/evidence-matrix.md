# Evidence matrix

Build one row for each material promise, invariant, preserved behavior, or
risky transition. Combine rows only when the same owner and evidence genuinely
prove them together.

| Contract | Owner or enforcement layer | Failure mechanism | Required evidence | Result |
| --- | --- | --- | --- | --- |
| `<what must remain true>` | `<type/schema/service/repository/database/UI/runtime>` | `<how it could fail>` | `<test, command, or observation>` | `<pass/fail/blocked>` |

## Choose evidence by boundary

### Pure logic and finite cases

Use focused unit tests that enumerate meaningful variants and the no-op case.
Assert outputs and invariants, not private call order.

### Frontend state and interaction

Prove the authoritative state source, lifecycle reset, cache transition, and
rendered behavior. Include loading, empty, denied, stale, remount, and failure
states only when the changed contract can enter them. Use a real browser when
focus, layout, navigation, portals, timing, or browser storage is the boundary.

### Backend contracts

Match evidence to the owner:

- schema tests for transport validation;
- service tests for orchestration and state transitions;
- repository integration for query, locking, and persistence behavior;
- route or tool integration for serialization, dependency wiring, and
  authorization outcomes;
- failure-order tests for transactions, queues, and external effects.

### Migrations and persisted data

Use the `$build-migrations` review requirements. Prove model-to-schema
alignment, realistic existing-data upgrade, application behavior during phased
rollout, retry after interruption, graph behavior, and forward recovery as the
change requires. An empty fresh database is not representative evidence for a
backfill.

### Performance

Measure the actual changed boundary with representative shape and volume.
Record the environment, sample size, endpoint or query, and before/after
numbers. Do not infer performance from code shape alone.

## Report honestly

For every command, record:

- exact invocation;
- working directory and material environment assumptions;
- selected test or data subset;
- exit status and meaningful result;
- skipped cases, warnings, or weakened evidence.

`Not run` is not `passed`. A passing subset is not the full suite. A mocked
boundary is not the deployed boundary. If the best available proof is weaker
than required, mark the row blocked or limited and preserve the residual risk.
