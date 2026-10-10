import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const git = (repo, arguments_, options = {}) =>
  execFileSync("git", ["-C", repo, ...arguments_], {
    encoding: options.encoding ?? "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });

const parseNullSeparated = (output) =>
  output
    .split("\0")
    .filter(Boolean)
    .map((entry) => entry.replaceAll("\\", "/"));

const changedSince = (repo, base) => {
  git(repo, ["rev-parse", "--verify", `${base}^{commit}`]);
  const mergeBase = git(repo, ["merge-base", "HEAD", base]).trim();
  const committed = parseNullSeparated(
    git(repo, [
      "diff",
      "--name-only",
      "-z",
      "--diff-filter=ACMRT",
      mergeBase,
      "HEAD",
      "--",
    ]),
  );
  const working = parseNullSeparated(
    git(repo, [
      "diff",
      "--name-only",
      "-z",
      "--diff-filter=ACMRT",
      "HEAD",
      "--",
    ]),
  );
  const untracked = parseNullSeparated(
    git(repo, ["ls-files", "--others", "--exclude-standard", "-z"]),
  );
  return [...new Set([...committed, ...working, ...untracked])].filter(
    (relativePath) => fs.existsSync(path.join(repo, relativePath)),
  );
};

const staged = (repo) =>
  parseNullSeparated(
    git(repo, [
      "diff",
      "--cached",
      "--name-only",
      "-z",
      "--diff-filter=ACMRT",
      "--",
    ]),
  );

const all = (repo) =>
  parseNullSeparated(
    git(repo, [
      "ls-files",
      "--cached",
      "--others",
      "--exclude-standard",
      "-z",
    ]),
  ).filter((relativePath) => fs.existsSync(path.join(repo, relativePath)));

const collectFiles = ({ repo, scope, base }) => {
  git(repo, ["rev-parse", "--is-inside-work-tree"]);
  const files =
    scope === "changed-since"
      ? changedSince(repo, base)
      : scope === "staged"
        ? staged(repo)
        : all(repo);
  return files.sort((left, right) => left.localeCompare(right));
};

const readSource = ({ repo, relativePath, scope }) => {
  if (scope === "staged") {
    return git(repo, ["cat-file", "blob", `:${relativePath}`]);
  }
  return fs.readFileSync(path.join(repo, relativePath), "utf8");
};

export { collectFiles, readSource };
