import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

import parser from "@typescript-eslint/parser";
import { ESLint } from "eslint";

import plugin from "../index.js";
import { collectFiles, readSource } from "./git.js";

const TYPESCRIPT_EXTENSION = /\.tsx?$/u;
const PYTHON_EXTENSION = /\.py$/u;
const PYTHON_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../python",
);

const eslintConfiguration = (profile) => [
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        sourceType: "module",
      },
    },
  },
  ...plugin.configs[profile],
];

const checkTypescript = async ({ repo, profile, sources }) => {
  if (sources.length === 0) {
    return [];
  }
  const eslint = new ESLint({
    cwd: repo,
    overrideConfigFile: true,
    overrideConfig: eslintConfiguration(profile),
  });
  const diagnostics = [];
  for (const { relativePath, source } of sources) {
    const [result] = await eslint.lintText(source, {
      filePath: path.join(repo, relativePath),
    });
    for (const message of result.messages) {
      diagnostics.push({
        language: "typescript",
        path: relativePath,
        line: message.line,
        column: message.column,
        endLine: message.endLine ?? message.line,
        endColumn: message.endColumn ?? message.column,
        rule: message.ruleId ?? "parser",
        code: message.fatal ? "syntax-error" : "violation",
        message: message.message,
      });
    }
  }
  return diagnostics;
};

const checkPython = ({ sources }) => {
  if (sources.length === 0) {
    return [];
  }
  const pythonPath = process.env.PYTHONPATH
    ? `${PYTHON_ROOT}${path.delimiter}${process.env.PYTHONPATH}`
    : PYTHON_ROOT;
  const result = spawnSync(
    "python3",
    [
      "-m",
      "code_contracts",
      "--stdin-json",
      "--format",
      "json",
    ],
    {
      encoding: "utf8",
      env: { ...process.env, PYTHONPATH: pythonPath },
      input: JSON.stringify(sources),
      maxBuffer: 64 * 1024 * 1024,
    },
  );
  if (result.error) {
    throw result.error;
  }
  if (![0, 1].includes(result.status)) {
    throw new Error(result.stderr || "Python contract runner failed.");
  }
  const parsed = JSON.parse(result.stdout || "[]");
  return parsed.map((diagnostic) => ({
    language: "python",
    path: diagnostic.path,
    line: diagnostic.line,
    column: diagnostic.column,
    endLine: diagnostic.end_line,
    endColumn: diagnostic.end_column,
    rule: diagnostic.rule,
    code: diagnostic.code,
    message: diagnostic.message,
  }));
};

const runCheck = async (options) => {
  const files = collectFiles(options).filter(
    (relativePath) =>
      TYPESCRIPT_EXTENSION.test(relativePath) ||
      PYTHON_EXTENSION.test(relativePath),
  );
  const sources = files.map((relativePath) => ({
    relativePath,
    path: relativePath,
    source: readSource({ ...options, relativePath }),
  }));
  const [typescript, python] = await Promise.all([
    checkTypescript({
      repo: options.repo,
      profile: options.profile,
      sources: sources.filter(({ relativePath }) =>
        TYPESCRIPT_EXTENSION.test(relativePath),
      ),
    }),
    Promise.resolve(
      checkPython({
        sources: sources.filter(({ relativePath }) =>
          PYTHON_EXTENSION.test(relativePath),
        ),
      }),
    ),
  ]);
  const diagnostics = [...typescript, ...python].sort(
    (left, right) =>
      left.path.localeCompare(right.path) ||
      left.line - right.line ||
      left.column - right.column ||
      left.rule.localeCompare(right.rule),
  );
  return { files, diagnostics };
};

export { runCheck };
