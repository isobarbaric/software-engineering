---
name: branch-from-main
description: Choose and create a concise pull-request branch from `main` and a matching commit message using `{feat|fix|chore|refactor}`. Use as a bounded helper when starting a small, single-commit PR while currently on `main`, or when the user asks for a branch name, commit message, or branch creation from `main`; it is not a workflow role.
---

# Branch From Main

Use this for small PRs that should start from `main`. It names the branch and creates it only after confirming that the current checkout is `main`.

## Workflow

1. Inspect the current branch with `git branch --show-current` and the worktree with `git status --short`.
2. Apply this skill only when the current branch is exactly `main`. If it is not, leave the current branch alone and explain that this workflow does not apply.
3. Infer one conventional prefix:
   - `feat` for a user-facing capability.
   - `fix` for a defect correction.
   - `refactor` for a behavior-preserving structural change.
   - `chore` for maintenance, tooling, or configuration.
4. Write a lowercase, hyphenated name that captures the changed product behavior, without ticket IDs, usernames, or filler such as `update`, `changes`, `misc`, or `wip`.
5. Use exactly this shape:

   ```text
   <prefix>/krish/<concise-short-name>
   ```

   Examples: `fix/krish/label-kb-feedback`, `feat/krish/add-project-export`, `refactor/krish/simplify-route-resolution`.
6. Generate a matching commit message using exactly this shape, with the same prefix:

   ```text
   <prefix>: <concise imperative description>
   ```

   Do not add a scope in parentheses. Example: `fix: classify Knowledge Base feedback by route`.
7. If the requested work is already sufficiently clear, create the branch with `git switch -c <branch-name>`. Existing uncommitted changes remain intact on the new branch. Otherwise propose the recommended branch name and commit message and wait for direction.

## Constraints

- Never create a branch directly from any branch other than `main` through this skill.
- Never use a prefix outside `feat`, `fix`, `chore`, or `refactor`.
- Never put a scope in the commit message, such as `fix(feedback): ...`.
- Do not commit, push, or open a PR; this skill only names and creates the branch.
- Never stash, reset, discard, or otherwise alter local changes while creating the branch.
