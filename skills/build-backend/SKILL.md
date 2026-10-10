---
name: build-backend
description: Plan, implement, or review backend application behavior across API boundaries, services, repositories, persistence, authorization, background work, and external side effects. Compose with build-migrations whenever persisted schema changes.
---

# Build Backend

Use this as the top-level entrypoint for backend implementation. It owns the
cross-cutting execution model; repository and domain skills own their local
contracts.

An approved engineering plan is binding. Resolve ordinary coding details from
source evidence and established precedent. Return a decision delta when the
current system invalidates a material plan assumption rather than silently
changing behavior, ownership, scope, data meaning, authorization, or rollout.

## Establish the operation

Before editing, trace the complete operation:

- every entrypoint and observable response;
- the service or domain owner;
- persistence reads, writes, and transaction boundaries;
- authorization and tenant or project scope;
- background work and external side effects;
- public contracts that must remain stable;
- the failure boundary and evidence that will verify it.

If the operation has no clear owner, stop adding glue and resolve the ownership
problem first.

## Read only the applicable guidance

- Read [layers-and-ownership.md](references/layers-and-ownership.md) when the
  change crosses transport, orchestration, persistence, or database layers.
- Read [contracts-and-effects.md](references/contracts-and-effects.md) when the
  change affects public schemas, authorization, transactions, queues, external
  systems, retries, or failure ordering.
- Use `$build-migrations` in the same pass whenever a persisted table, column,
  relationship, index, constraint, or stored value meaning changes.

Keep changed domain vocabulary consistent across routes, schemas, services,
repositories, logs, tasks, and tests. Prefer names that expose the real owner,
scope, lifecycle, and lookup key while matching mature repository convention.
Use `$verify-implementation` for implementation evidence. Use only skills
surfaced in the available-skills catalog. Repository instructions remain
authoritative when they do not conflict with skill isolation or higher-priority
instructions.

## Execute

- Put behavior in the lowest honest owner without bypassing the domain service
  that already owns the rule.
- Derive values from authoritative state; do not introduce redundant fields
  that can disagree.
- Make required domain facts required. Do not use nullability as a substitute
  for resolving construction or rollout semantics.
- Keep transport concerns out of domain services and business decisions out of
  repositories.
- Commit one logical database unit before triggering an irreversible external
  side effect, unless the plan defines a durable reconciliation protocol.
- Preserve public contracts deliberately while removing stale internal
  compatibility paths unless the plan requires them.
- Add an abstraction only when it owns policy, an invariant, a domain
  operation, or real repeated behavior.

Follow mature neighboring modules unless the plan or a repository rule names a
real difference. Keep domain vocabulary consistent through routes, schemas,
services, repositories, logs, tasks, and tests.

## Verify and hand off

Verify at the layer where failure would occur: pure policy tests, service
orchestration tests, repository integration tests, route-contract tests, and
runtime evidence only when the boundary requires it. A mocked collaborator does
not prove the real contract it replaces.

Inspect the final diff for duplicate truth, optional invalid states, misplaced
SQL or orchestration, side effects before durable state, stale vocabulary,
unrequested compatibility code, and unrelated cleanup. Report the skills used,
contracts changed or preserved, verification commands and results, and any
remaining decision delta.
