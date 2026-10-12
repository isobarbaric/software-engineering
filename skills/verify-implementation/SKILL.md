---
name: verify-implementation
description: Verify completed implementation work against its approved plan, applicable build-domain contracts, and the actual failure boundaries. Use after coding or before handoff; do not use as independent pull-request review or exploratory QA.
---

# Verify Implementation

Prove that the implementation matches its contract. Passing commands are
evidence only when they exercise the mechanism that could fail.

This is an implementer self-gate, not an independent approval. It may repair an
in-scope implementation defect during an authorized implementation task. A
verification-only request authorizes inspection and reporting, not code edits.

## Establish the verification contract

Read the approved plan or explicit task contract and extract:

- the observable outcome;
- preserved behavior and non-goals;
- changed owners, interfaces, state partitions, and invariants;
- required verification and stated risk;
- every decision delta resolved during implementation.

Read the same applicable `build-*` skills used for the implementation from the
available-skills catalog. Domain skills define what correctness means;
verification decides whether the implementation proves it. Do not load skills
from undisclosed or product-specific skill directories.

Inspect the complete diff and relevant callers, consumers, tests, and mature
peers before running commands. Read
[review-pressure.md](references/review-pressure.md) to challenge the diff using
the recurring questions behind Krish's reviews.

## Build the evidence matrix

Read [evidence-matrix.md](references/evidence-matrix.md). For every material
contract, record:

- what must be true;
- which layer or owner enforces it;
- how it could fail;
- the narrowest evidence capable of detecting that failure;
- the command or observation and its result.

Do not substitute a nearby proxy. A helper unit test does not prove a route,
authorization boundary, cache transition, persisted constraint, deployment
phase, or real user interaction.

## Inspect before executing checks

Reject or repair, when authorized, implementation that contains:

- behavior or cleanup unrelated to the approved outcome;
- duplicate sources of truth or reconstructed canonical identity;
- optional fields or parallel states that permit impossible combinations;
- a new abstraction without independent policy, ownership, or repeated use;
- a rule enforced in a layer callers can bypass;
- product behavior changed for implementation convenience;
- unrequested compatibility paths, fallbacks, aliases, or feature flags;
- tests aligned to mocks or stale implementation details instead of the
  changed contract;
- comments that narrate syntax or preserve dead history.

Do not record a taste objection as a failure. Trace the concrete mechanism and
consequence or dismiss it.

## Required deterministic linter

For changed `.ts`, `.tsx`, or `.py` files, read and follow
[deterministic-lint.md](references/deterministic-lint.md). Run the
`@isobarbaric/code-contracts` CLI from `software-engineering` against the actual
target checkout and complete change scope. This is a required check in addition
to repository lint, type checks, and tests. Record its command, tool revision,
profile, base/scope, checked files, diagnostics, and exit status in the evidence
matrix. Unresolved violations are `NOT VERIFIED`; unavailable tooling is
`VERIFIED WITH LIMITATIONS` only when the remaining contract is verified. When
no supported source files changed, record the check as not applicable and why.

## Execute risk-proportional checks

Run the narrowest deterministic checks first, then broaden only when the risk
requires it:

1. focused unit or integration tests for changed branches and invariants;
2. type, lint, build, schema, or model-alignment checks;
3. repository or service integration at the real boundary;
4. migration, concurrency, retry, or failure-order checks where applicable;
5. runtime or end-to-end evidence only when static and deterministic checks
   cannot prove the behavior.

Enumerate the relevant unhappy states rather than testing only the happy path:
empty, loading, denied, stale, retry, partial success, duplicate execution,
disconnect, deletion, remount, and mixed-version operation as applicable. The
domain decides which states are real; do not invent ceremonial cases.

Record exact commands, environment, test subset, result, and any limitation.
Never strengthen the claim beyond the evidence.

## Classify discoveries

- **Implementation defect:** The code violates the approved plan or an
  applicable domain contract. Fix it during an authorized implementation task,
  then rerun affected checks.
- **Decision delta:** Current evidence invalidates a material plan assumption or
  requires a product, contract, ownership, data, authorization, scope, or
  deployment decision. Return it to the engineer; do not hide it in code.
- **Environmental blocker:** Required evidence cannot run because of tooling,
  credentials, services, or unavailable state. Report the exact blocker,
  weaker evidence, and residual risk.
- **Unrelated failure:** Preserve it as evidence with its scope. Do not repair
  it unless separately authorized.

## Handoff status

Return one status:

- `VERIFIED`: every material contract has direct evidence and required checks
  pass.
- `VERIFIED WITH LIMITATIONS`: implementation matches the inspected contract,
  but named required evidence could not run and residual risk remains.
- `NOT VERIFIED`: a contract fails, a decision delta is unresolved, or required
  work is incomplete.

Include the evidence matrix, exact checks and results, fixes made during the
gate, unresolved deltas, blocked evidence, and remaining risk. Do not commit,
push, open a pull request, deploy, or perform exploratory QA unless separately
authorized.
