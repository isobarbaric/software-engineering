import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { runCheck } from "../src/cli/check.js";
import { createRepository, git, write } from "./helpers/git-repository.js";

const BIN = fileURLToPath(new URL("../bin/code-contracts.js", import.meta.url));

const allOptions = (repo, profile = "general") => ({
  repo,
  scope: "all",
  base: null,
  profile,
  format: "text",
});

test("checks TypeScript and Python through their native analyzers", async (t) => {
  const repository = createRepository({
    "frontend/src/Two.tsx": `
      export const First = () => <div />;
      export const Second = () => <span />;
    `,
    "backend/read_service.py":
      "class ReadService:\n    def read(self) -> tuple[int, int]:\n        return 1, 2\n",
  });
  t.after(repository.cleanup);

  const result = await runCheck(allOptions(repository.repo));
  assert.deepEqual(result.files, [
    "backend/read_service.py",
    "frontend/src/Two.tsx",
  ]);
  assert.deepEqual(
    result.diagnostics.map(({ language, rule, code }) => ({
      language,
      rule,
      code,
    })),
    [
      {
        language: "python",
        rule: "no-tuple-service-results",
        code: "tuple-return-annotation",
      },
      {
        language: "python",
        rule: "no-tuple-service-results",
        code: "tuple-return-value",
      },
      {
        language: "typescript",
        rule: "contracts/one-react-component-per-file",
        code: "violation",
      },
    ],
  );
});

test("software-factory profile layers repository contracts over general rules", async (t) => {
  const repository = createRepository({
    "frontend/src/app/Feature.tsx": `
      export const Feature = () => {
        fetch("/api/feature");
        return <div />;
      };
    `,
  });
  t.after(repository.cleanup);

  const general = await runCheck(allOptions(repository.repo));
  const softwareFactory = await runCheck(
    allOptions(repository.repo, "software-factory"),
  );
  assert.equal(general.diagnostics.length, 0);
  assert.deepEqual(
    softwareFactory.diagnostics.map(({ rule }) => rule),
    ["contracts/software-factory/api-calls-through-api-hooks"],
  );
});

test("software-factory profile applies scoped Python response contracts", async (t) => {
  const repository = createRepository({
    "backend/responses.py":
      "from pydantic import BaseModel\n\n" +
      "class ProjectScopedResponse(BaseModel):\n    pass\n\n" +
      "class ProjectResponse(ProjectScopedResponse):\n    pass\n",
  });
  t.after(repository.cleanup);

  const general = await runCheck(allOptions(repository.repo));
  const softwareFactory = await runCheck(
    allOptions(repository.repo, "software-factory"),
  );
  assert.equal(general.diagnostics.length, 0);
  assert.deepEqual(
    softwareFactory.diagnostics.map(({ rule, code }) => ({ rule, code })),
    [
      {
        rule: "scoped-responses-include-scope-ids",
        code: "missing-organization-id",
      },
      {
        rule: "scoped-responses-include-scope-ids",
        code: "missing-project-id",
      },
    ],
  );
});

test("changed-since reports changed violations without auditing untouched files", async (t) => {
  const repository = createRepository({
    "backend/untouched_service.py":
      "class UntouchedService:\n    def read(self): return 1, 2\n",
    "backend/changed_service.py":
      "class ChangedService:\n    def read(self): return None\n",
  });
  t.after(repository.cleanup);
  git(repository.repo, "switch", "-c", "feature");
  write(
    repository.repo,
    "backend/changed_service.py",
    "class ChangedService:\n    def read(self): return 3, 4\n",
  );

  const result = await runCheck({
    repo: repository.repo,
    scope: "changed-since",
    base: "main",
    profile: "general",
    format: "text",
  });
  assert.deepEqual(result.files, ["backend/changed_service.py"]);
  assert.equal(result.diagnostics.length, 1);
  assert.equal(result.diagnostics[0].path, "backend/changed_service.py");
});

test("staged checks index content even when worktree content is valid", async (t) => {
  const repository = createRepository({
    "backend/read_service.py":
      "class ReadService:\n    def read(self): return None\n",
  });
  t.after(repository.cleanup);
  write(
    repository.repo,
    "backend/read_service.py",
    "class ReadService:\n    def read(self): return 1, 2\n",
  );
  git(repository.repo, "add", "backend/read_service.py");
  write(
    repository.repo,
    "backend/read_service.py",
    `class ReadService:\n    def read(self): return None\n`,
  );

  const result = await runCheck({
    repo: repository.repo,
    scope: "staged",
    base: null,
    profile: "general",
    format: "text",
  });
  assert.equal(result.diagnostics.length, 1);
  assert.equal(result.diagnostics[0].code, "tuple-return-value");
});

test("returns deterministic syntax diagnostics instead of runner tracebacks", async (t) => {
  const repository = createRepository({
    "backend/broken.py": "def broken(:\n",
    "frontend/src/broken.ts": "const value: = 1;\n",
  });
  t.after(repository.cleanup);

  const result = await runCheck(allOptions(repository.repo));
  assert.deepEqual(
    result.diagnostics.map(({ language, code }) => ({ language, code })),
    [
      { language: "python", code: "syntax-error" },
      { language: "typescript", code: "syntax-error" },
    ],
  );
});

test("CLI returns zero for clean input and one with JSON diagnostics", (t) => {
  const repository = createRepository({
    "backend/read_service.py":
      "class ReadService:\n    def read(self): return None\n",
  });
  t.after(repository.cleanup);

  const clean = spawnSync(
    process.execPath,
    [BIN, "check", "--repo", repository.repo, "--all", "--format", "json"],
    { encoding: "utf8" },
  );
  assert.equal(clean.status, 0, clean.stderr);
  assert.deepEqual(JSON.parse(clean.stdout).diagnostics, []);

  write(
    repository.repo,
    "backend/read_service.py",
    "class ReadService:\n    def read(self): return 1, 2\n",
  );
  const invalid = spawnSync(
    process.execPath,
    [BIN, "check", "--repo", repository.repo, "--all", "--format", "json"],
    { encoding: "utf8" },
  );
  assert.equal(invalid.status, 1, invalid.stderr);
  assert.equal(JSON.parse(invalid.stdout).diagnostics.length, 1);
});

test("CLI returns two for invalid invocation and missing repositories", () => {
  const invalid = spawnSync(process.execPath, [BIN, "check", "--all"], {
    encoding: "utf8",
  });
  assert.equal(invalid.status, 2);
  assert.match(invalid.stderr, /--repo is required/u);

  const missing = spawnSync(
    process.execPath,
    [BIN, "check", "--repo", "/definitely/missing", "--all"],
    { encoding: "utf8" },
  );
  assert.equal(missing.status, 2);
  assert.match(missing.stderr, /Repository does not exist/u);
});
