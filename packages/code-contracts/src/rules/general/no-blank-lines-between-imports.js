import { createRule } from "../../ast.js";

function isImport(node) {
  return node.type === "ImportDeclaration" || node.type === "TSImportEqualsDeclaration";
}

export default createRule(
  {
    type: "layout",
    docs: {
      description: "Keep consecutive imports together unless a comment separates them.",
      recommended: true,
    },
    fixable: "whitespace",
    schema: [],
    messages: {
      blankLine: "Remove blank lines between consecutive imports.",
    },
  },
  (context) => ({
    Program(node) {
      const sourceCode = context.sourceCode;
      for (let index = 1; index < node.body.length; index += 1) {
        const previous = node.body[index - 1];
        const current = node.body[index];
        if (!isImport(previous) || !isImport(current)) continue;

        const range = [previous.range[1], current.range[0]];
        const gap = sourceCode.text.slice(...range);
        if (!/^\s+$/.test(gap)) continue;
        const lineBreaks = [...gap.matchAll(/\r\n|[\n\r\u2028\u2029]/g)];
        if (lineBreaks.length < 2) continue;
        const lastBreak = lineBreaks.at(-1);
        const replacement = lastBreak[0] + gap.slice(lastBreak.index + lastBreak[0].length);

        context.report({
          node: current,
          messageId: "blankLine",
          fix: (fixer) => fixer.replaceTextRange(range, replacement),
        });
      }
    },
  }),
);
