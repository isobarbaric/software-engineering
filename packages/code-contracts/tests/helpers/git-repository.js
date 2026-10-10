import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const git = (repo, ...arguments_) =>
  execFileSync("git", ["-C", repo, ...arguments_], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

const write = (repo, relativePath, source) => {
  const absolutePath = path.join(repo, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, source);
};

const createRepository = (files = {}) => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "code contracts "));
  const repo = path.join(parent, "target repo");
  fs.mkdirSync(repo);
  git(repo, "init", "-b", "main");
  git(repo, "config", "user.email", "contracts@example.com");
  git(repo, "config", "user.name", "Code Contracts");
  write(repo, ".gitignore", "ignored/\n");
  for (const [relativePath, source] of Object.entries(files)) {
    write(repo, relativePath, source);
  }
  git(repo, "add", ".");
  git(repo, "commit", "-m", "baseline");
  return {
    parent,
    repo,
    cleanup: () => fs.rmSync(parent, { recursive: true, force: true }),
  };
};

export { createRepository, git, write };
