import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { parseArguments } from "../src/cli/arguments.js";

test("parses changed-since with an explicit Software Factory profile", () => {
  assert.deepEqual(
    parseArguments([
      "check",
      "--repo",
      "../target",
      "--changed-since",
      "origin/main",
      "--profile",
      "software-factory",
      "--format",
      "json",
    ]),
    {
      command: "check",
      repo: path.resolve("../target"),
      scope: "changed-since",
      base: "origin/main",
      profile: "software-factory",
      format: "json",
    },
  );
});

test("parses staged and all as distinct source scopes", () => {
  assert.equal(
    parseArguments(["check", "--repo", ".", "--staged"]).scope,
    "staged",
  );
  assert.equal(
    parseArguments(["check", "--repo", ".", "--all"]).scope,
    "all",
  );
});

test("defaults to the general profile and text output", () => {
  const options = parseArguments(["check", "--repo", ".", "--all"]);
  assert.equal(options.profile, "general");
  assert.equal(options.format, "text");
});

test("requires one and only one source scope", () => {
  assert.throws(
    () => parseArguments(["check", "--repo", "."]),
    /Choose one check scope/u,
  );
  assert.throws(
    () =>
      parseArguments([
        "check",
        "--repo",
        ".",
        "--staged",
        "--all",
      ]),
    /exactly one check scope/u,
  );
});

test("rejects missing option values and unknown vocabulary", () => {
  assert.throws(
    () => parseArguments(["check", "--repo", "--all"]),
    /--repo requires a value/u,
  );
  assert.throws(
    () => parseArguments(["check", "--repo", ".", "--wat"]),
    /Unknown option/u,
  );
  assert.throws(
    () =>
      parseArguments([
        "check",
        "--repo",
        ".",
        "--all",
        "--profile",
        "factory",
      ]),
    /Unknown profile/u,
  );
});

test("recognizes command and global help", () => {
  assert.deepEqual(parseArguments([]), { command: "help" });
  assert.deepEqual(parseArguments(["--help"]), { command: "help" });
  assert.deepEqual(parseArguments(["check", "--help"]), { command: "help" });
});

test("rejects unknown commands", () => {
  assert.throws(() => parseArguments(["diff"]), /Unknown command: diff/u);
});
