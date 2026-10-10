import path from "node:path";

const PROFILES = new Set(["general", "software-factory"]);
const FORMATS = new Set(["text", "json"]);

const usage = `Usage:
  code-contracts check --repo <path> --changed-since <ref> [--profile <profile>]
  code-contracts check --repo <path> --staged [--profile <profile>]
  code-contracts check --repo <path> --all [--profile <profile>]

Scopes:
  --changed-since <ref>  Check branch, working-tree, and untracked changes since
                         the merge base with <ref>.
  --staged               Check the exact blobs currently in Git's index.
  --all                  Check every tracked or untracked source file.

Options:
  --profile <profile>    general or software-factory (default: general).
  --format <format>      text or json (default: text).
  --help                 Show this help.`;

const readValue = (arguments_, index, option) => {
  const value = arguments_[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${option} requires a value.`);
  }
  return value;
};

const parseCheckArguments = (arguments_) => {
  const options = {
    command: "check",
    repo: null,
    scope: null,
    base: null,
    profile: "general",
    format: "text",
  };

  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    switch (argument) {
      case "--repo":
        options.repo = path.resolve(readValue(arguments_, index, argument));
        index += 1;
        break;
      case "--changed-since":
        if (options.scope) {
          throw new Error("Choose exactly one check scope.");
        }
        options.scope = "changed-since";
        options.base = readValue(arguments_, index, argument);
        index += 1;
        break;
      case "--staged":
      case "--all":
        if (options.scope) {
          throw new Error("Choose exactly one check scope.");
        }
        options.scope = argument.slice(2);
        break;
      case "--profile":
        options.profile = readValue(arguments_, index, argument);
        index += 1;
        break;
      case "--format":
        options.format = readValue(arguments_, index, argument);
        index += 1;
        break;
      case "--help":
        return { command: "help" };
      default:
        throw new Error(`Unknown option: ${argument}`);
    }
  }

  if (!options.repo) {
    throw new Error("--repo is required.");
  }
  if (!options.scope) {
    throw new Error(
      "Choose one check scope: --changed-since, --staged, or --all.",
    );
  }
  if (!PROFILES.has(options.profile)) {
    throw new Error(
      `Unknown profile: ${options.profile}. Expected general or software-factory.`,
    );
  }
  if (!FORMATS.has(options.format)) {
    throw new Error(`Unknown format: ${options.format}. Expected text or json.`);
  }
  return options;
};

const parseArguments = (arguments_) => {
  if (arguments_.length === 0 || arguments_[0] === "--help") {
    return { command: "help" };
  }
  if (arguments_[0] !== "check") {
    throw new Error(`Unknown command: ${arguments_[0]}`);
  }
  return parseCheckArguments(arguments_.slice(1));
};

export { parseArguments, usage };
