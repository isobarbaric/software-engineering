---
name: write-code-comments
description: Write, review, or revise code comments and docstrings in Krish's concise style. Use when adding inline explanations, documenting non-obvious invariants, or removing comments that merely narrate the code.
---

# Write Code Comments

Use comments only for non-obvious constraints, lifecycle reasons, timing behavior,
workarounds, or deliberate exceptions. Do not narrate code that already says what
it does.

Prefer short lowercase `// note:` comments near the code they qualify. State the
reason or invariant directly, not the implementation history.

```ts
// note: blur fires between mousedown and mouseup, so an immediate cancel would
// close the menu before its action runs

// note: once cache takes the optimistic value we can let it take over; a rollback then renders naturally
```

Use `// Note:` only when matching an established local file convention. Keep
multi-line comments compact; wrap only when the explanation needs it. Avoid
section headers, restating types, and generic comments such as `// update state`
or `// handle error`.

For docstrings, explain the ownership boundary, input/output contract, or a
non-obvious lifecycle rule. Keep them brief; do not duplicate the function name
or type signature.

Before adding a comment, ask whether deleting it would make a competent reader
misunderstand the code. If not, do not add it.
