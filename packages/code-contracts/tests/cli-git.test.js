import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { collectFiles, readSource } from "../src/cli/git.js";
import { createRepository, git, write } from "./helpers/git-repository.js";

test("changed-since includes branch, index, worktree, and untracked sources", (t) => {
  const repository = createRepository({
    "untouched.ts": "export const untouched = true;\n",
    "modified.py": "VALUE = 1\n",
    "deleted.py": "VALUE = 1\n",
  });
  t.after(repository.cleanup);
  git(repository.repo, "switch", "-c", "feature");
  write(repository.repo, "committed.ts", "export const committed = true;\n");
  write(
    repository.repo,
    "committed-then-deleted.ts",
    "export const removed = true;\n",
  );
  git(repository.repo, "add", "committed.ts", "committed-then-deleted.ts");
  git(repository.repo, "commit", "-m", "branch change");
  fs.rmSync(path.join(repository.repo, "committed-then-deleted.ts"));
  write(repository.repo, "staged.py", "VALUE = 2\n");
  git(repository.repo, "add", "staged.py");
  write(repository.repo, "modified.py", "VALUE = 3\n");
  write(repository.repo, "untracked.tsx", "export const New = () => null;\n");
  fs.rmSync(path.join(repository.repo, "deleted.py"));

  assert.deepEqual(
    collectFiles({
      repo: repository.repo,
      scope: "changed-since",
      base: "main",
    }),
    ["committed.ts", "modified.py", "staged.py", "untracked.tsx"],
  );
});

test("staged reads the exact index blob rather than worktree content", (t) => {
  const repository = createRepository({ "service.py": "VALUE = 'base'\n" });
  t.after(repository.cleanup);
  write(repository.repo, "service.py", "VALUE = 'staged'\n");
  git(repository.repo, "add", "service.py");
  write(repository.repo, "service.py", "VALUE = 'worktree'\n");

  assert.deepEqual(
    collectFiles({ repo: repository.repo, scope: "staged", base: null }),
    ["service.py"],
  );
  assert.equal(
    readSource({
      repo: repository.repo,
      relativePath: "service.py",
      scope: "staged",
    }),
    "VALUE = 'staged'\n",
  );
});

test("all includes tracked and untracked files but excludes ignored and deleted files", (t) => {
  const repository = createRepository({
    "tracked.py": "VALUE = 1\n",
    "deleted.ts": "export const deleted = true;\n",
  });
  t.after(repository.cleanup);
  write(repository.repo, "untracked.ts", "export const untracked = true;\n");
  write(repository.repo, "ignored/ignored.py", "VALUE = 2\n");
  fs.rmSync(path.join(repository.repo, "deleted.ts"));

  assert.deepEqual(
    collectFiles({ repo: repository.repo, scope: "all", base: null }),
    [".gitignore", "tracked.py", "untracked.ts"],
  );
});

test("staged follows rename destinations and excludes deletions", (t) => {
  const repository = createRepository({
    "before.py": "VALUE = 1\n",
    "delete.py": "VALUE = 2\n",
  });
  t.after(repository.cleanup);
  git(repository.repo, "mv", "before.py", "after.py");
  git(repository.repo, "rm", "delete.py");

  assert.deepEqual(
    collectFiles({ repo: repository.repo, scope: "staged", base: null }),
    ["after.py"],
  );
});

test("path handling preserves spaces and stable lexical order", (t) => {
  const repository = createRepository();
  t.after(repository.cleanup);
  write(repository.repo, "z folder/z file.py", "VALUE = 1\n");
  write(repository.repo, "a folder/a file.ts", "export const value = 1;\n");

  assert.deepEqual(
    collectFiles({ repo: repository.repo, scope: "all", base: null }),
    [".gitignore", "a folder/a file.ts", "z folder/z file.py"],
  );
});
