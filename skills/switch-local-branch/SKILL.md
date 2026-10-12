---
name: switch-local-branch
description: Safely switch an existing local Git checkout to another branch while preserving dirty work in a traceable stash. Use when the user asks to check out, switch to, or move a primary worktree onto a branch; do not use to create new worktrees or rewrite branch history.
---

# Switch Local Branch

Move the requested checkout to the target branch without losing local work or obscuring where that work came from.

## Inspect Before Mutating

Resolve and report:

- the checkout's absolute top-level path;
- its current branch and `HEAD`;
- staged, unstaged, and untracked changes;
- whether the target exists locally or remotely; and
- whether the target branch is already checked out in another worktree.

Do not use `--ignore-other-worktrees`. If another worktree owns the target branch, surface its path. Reusing, detaching, or removing that worktree requires the user's direction.

## Preserve Dirty Work

If the checkout is dirty and the user has authorized stashing, stash tracked and untracked files, but not ignored files. Use a message containing these resolved values:

```text
origin-branch=<branch>; origin-head=<full-sha>; worktree=<absolute-path>; target-branch=<branch>; saved=<ISO-8601 timestamp>; reason=branch-switch
```

After creating the stash:

1. Verify the checkout is clean.
2. Resolve the stash's immutable commit SHA with `git rev-parse stash@{0}`.
3. Inspect `git stash show --stat` to verify the expected files were captured.
4. Report both the current stash label and immutable SHA.

Do not silently stash when the user has not authorized it. Never include ignored files unless the user explicitly requests that broader scope.

## Switch

Prefer `git switch` over `git checkout`.

- Switch directly when the local target branch exists.
- If only the remote branch exists, create a local tracking branch for that exact remote branch.
- Do not reset, rebase, amend, force-push, or discard changes as part of switching.
- Do not fetch unless remote freshness is relevant to the request; say when the decision uses existing local remote-tracking state.

After switching, verify the active branch, `HEAD`, upstream relationship, and working-tree status.

## Recovery Handoff

Give the user the originating branch, stash SHA, captured file summary, and the exact recovery operation. Prefer:

```text
git stash apply --index <immutable-stash-sha>
```

Use `apply`, not `pop`, so the saved object remains available until restoration is verified. Drop the stash only after successful recovery and only when the user requests cleanup.

If applying onto a different branch is intentional, warn that conflicts may reflect branch drift rather than a bad stash.
