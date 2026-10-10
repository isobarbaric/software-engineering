import fs from "node:fs";

import { parseArguments, usage } from "./arguments.js";
import { runCheck } from "./check.js";

const writeStandardOutput = (value) => process.stdout.write(`${value}\n`);
const writeStandardError = (value) => process.stderr.write(`${value}\n`);

const writeTextResult = ({ files, diagnostics }) => {
  for (const diagnostic of diagnostics) {
    writeStandardOutput(
      `${diagnostic.path}:${diagnostic.line}:${diagnostic.column}: ` +
        `${diagnostic.rule}/${diagnostic.code}: ${diagnostic.message}`,
    );
  }
  writeStandardOutput(
    `Checked ${files.length} source ${files.length === 1 ? "file" : "files"}; ` +
      `${diagnostics.length} ${diagnostics.length === 1 ? "violation" : "violations"}.`,
  );
};

const main = async (arguments_) => {
  let options;
  try {
    options = parseArguments(arguments_);
  } catch (error) {
    writeStandardError(error.message);
    writeStandardError(usage);
    return 2;
  }

  if (options.command === "help") {
    writeStandardOutput(usage);
    return 0;
  }
  if (!fs.existsSync(options.repo)) {
    writeStandardError(`Repository does not exist: ${options.repo}`);
    return 2;
  }

  try {
    const result = await runCheck(options);
    if (options.format === "json") {
      writeStandardOutput(JSON.stringify(result, null, 2));
    } else {
      writeTextResult(result);
    }
    return result.diagnostics.length === 0 ? 0 : 1;
  } catch (error) {
    writeStandardError(error.message);
    return 2;
  }
};

export { main };
