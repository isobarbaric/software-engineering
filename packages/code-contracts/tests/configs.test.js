import assert from "node:assert/strict";
import test from "node:test";
import { Linter } from "eslint";
import parser from "@typescript-eslint/parser";
import plugin, { generalRules, softwareFactoryRules } from "../src/index.js";

function lintWithPreset(preset, code, filename) {
  const linter = new Linter({ configType: "flat" });
  return linter.verify(
    code,
    [
      {
        files: ["**/*.{ts,tsx}"],
        languageOptions: {
          parser,
          parserOptions: {
            ecmaVersion: "latest",
            sourceType: "module",
            ecmaFeatures: { jsx: true },
          },
        },
      },
      ...preset,
    ],
    { filename },
  );
}

test("plugin identity and preset namespaces use the code-contracts contract", () => {
  assert.equal(plugin.meta.name, "@isobarbaric/code-contracts");

  for (const layer of [
    ...plugin.configs.general,
    ...plugin.configs["software-factory"],
  ]) {
    assert.deepEqual(Object.keys(layer.plugins), ["contracts"]);
    assert.equal(layer.plugins.contracts, plugin);
    assert.ok(Object.keys(layer.rules).every((name) => name.startsWith("contracts/")));
  }
});

test("general preset exposes only repository-agnostic rules", () => {
  const configuredRules = plugin.configs.general[0].rules;
  assert.deepEqual(
    configuredRules,
    Object.fromEntries(
      Object.keys(generalRules).map((name) => [`contracts/${name}`, "error"]),
    ),
  );
  assert.ok(
    Object.keys(configuredRules).every(
      (name) => !name.includes("software-factory/") && !name.includes("sf-platform"),
    ),
  );
});

test("software-factory preset layers repository rules after general rules", () => {
  const [generalLayer, repositoryLayer] = plugin.configs["software-factory"];
  assert.equal(generalLayer, plugin.configs.general[0]);
  assert.deepEqual(repositoryLayer.files, ["frontend/src/**/*.{ts,tsx}"]);
  assert.deepEqual(
    repositoryLayer.rules,
    Object.fromEntries(
      Object.keys(softwareFactoryRules).map((name) => [
        `contracts/${name}`,
        "error",
      ]),
    ),
  );
});

test("plugin exports every preset rule exactly once", () => {
  const generalNames = new Set(Object.keys(generalRules));
  const repositoryNames = new Set(Object.keys(softwareFactoryRules));

  assert.equal(
    [...generalNames].filter((name) => repositoryNames.has(name)).length,
    0,
  );
  assert.deepEqual(
    Object.keys(plugin.rules).sort(),
    [...generalNames, ...repositoryNames].sort(),
  );
});

test("general preset executes its TypeScript contracts", () => {
  const result = lintWithPreset(
    plugin.configs.general,
    `type Status = "open" | "closed";`,
    "src/status.ts",
  );

  assert.deepEqual(
    result.map(({ ruleId, messageId, severity }) => ({
      ruleId,
      messageId,
      severity,
    })),
    [
      {
        ruleId: "contracts/closed-domain-values-use-enum",
        messageId: "union",
        severity: 2,
      },
    ],
  );
});

test("software-factory preset applies repository rules only under frontend src", () => {
  const inside = lintWithPreset(
    plugin.configs["software-factory"],
    `fetch("/projects");`,
    "frontend/src/app/projects/ProjectPanel.tsx",
  );
  const outside = lintWithPreset(
    plugin.configs["software-factory"],
    `fetch("/projects");`,
    "scripts/check-projects.ts",
  );

  assert.deepEqual(
    inside.map(({ ruleId, messageId, severity }) => ({
      ruleId,
      messageId,
      severity,
    })),
    [
      {
        ruleId: "contracts/software-factory/api-calls-through-api-hooks",
        messageId: "boundary",
        severity: 2,
      },
    ],
  );
  assert.deepEqual(outside, []);
});

test("every exported rule has complete ESLint metadata", () => {
  for (const [name, rule] of Object.entries(plugin.rules)) {
    assert.equal(typeof rule.create, "function", `${name} is missing create()`);
    assert.equal(rule.meta.type, "problem", `${name} has the wrong rule type`);
    assert.ok(rule.meta.docs?.description, `${name} is missing a description`);
    assert.equal(
      rule.meta.docs.recommended,
      true,
      `${name} is not marked recommended`,
    );
    assert.ok(rule.meta.messages, `${name} is missing messages`);
    assert.ok(
      Object.keys(rule.meta.messages).length > 0,
      `${name} has no diagnostic messages`,
    );
    assert.ok(
      Object.values(rule.meta.messages).every(
        (message) => typeof message === "string" && message.length > 0,
      ),
      `${name} has an empty diagnostic message`,
    );
    assert.ok(Array.isArray(rule.meta.schema), `${name} is missing a schema`);
  }
});
