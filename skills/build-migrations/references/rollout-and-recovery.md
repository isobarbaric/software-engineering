# Rollout and recovery

Model rollout as states that real deployments can occupy, including old and new
application versions running at the same time.

## Phase the change

Use the phases the repository defines. A common shape is:

1. expand the schema so old code still works;
2. deploy code that writes or reads the new representation safely;
3. move or verify existing data;
4. cut reads and writes to the new contract;
5. enforce new constraints;
6. remove obsolete shape only after the compatibility window closes.

Do not mechanically require every phase. Collapse phases only after proving
there is no mixed-version or existing-data risk.

## Preserve history

Determine whether a revision is local and unpublished, published on a branch,
deployed to a shared environment, or shipped to production. That state controls
whether it can be edited safely.

Preserve published branch and migration history by default. Do not amend,
rebase, renumber, replace, or force-push shared history. Use a new forward fix
unless the user and repository policy explicitly authorize rewriting an
unshipped revision.

## Lock and runtime reasoning

For each operation, identify the expected lock mode, table scan or rewrite,
index-build behavior, transaction duration, and timeout. Consider concurrent
reads and writes, not only an empty local database.

Avoid combining a long data rewrite with schema locks when phased work can
separate them. If the database supports an online or concurrent form, confirm
its transaction restrictions and failure cleanup.

## Retry and recovery

A deployment can fail after any statement, batch, or phase. Define:

- whether rerunning is safe;
- how partial work is detected;
- whether cleanup is automatic or explicit;
- what new forward revision or operational step restores progress;
- when full database restoration is the only honest recovery.

Do not promise reversibility that destroys or fabricates data. Follow the
repository's downgrade policy; forward recovery is the default for published
production history.
