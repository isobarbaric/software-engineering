#!/usr/bin/env node

import { pathToFileURL } from "node:url";

import { main } from "../src/cli/main.js";

const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  process.exitCode = await main(process.argv.slice(2));
}
