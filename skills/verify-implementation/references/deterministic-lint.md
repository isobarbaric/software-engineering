# Deterministic lint

`@isobarbaric/code-contracts` in the `software-engineering` repository is the
required deterministic linter for changed `.ts`, `.tsx`, and `.py` files. It runs
ESLint contracts for TypeScript and Python AST contracts for Python. Repository
lint commands remain additional checks; they do not necessarily load these rules.

## Resolve the tool and scope

Locate the `software-engineering` checkout from workspace context. On Krish's
machine it is `/Users/krish/Desktop/code/software-engineering`. Read its
`packages/code-contracts/README.md` and CLI `--help` for the installed revision's
contract. This is tool documentation, not permission to load undisclosed skills
from that checkout. Record its Git revision and any local linter changes.

Use the actual target worktree's absolute root as `--repo`. The CLI loads its own
rules and does not install them into or modify the target repository. It needs
the tool checkout's dependencies, Node.js >=20, and `python3` for Python sources.
If dependencies are missing, use the tool repository's documented setup and
lockfile; report an unavailable checkout/runtime as blocked evidence rather than
silently substituting another linter.

Select `--profile software-factory` for `sf-platform`; it includes general
contracts plus Software Factory rules. Use `--profile general` elsewhere. Do not
select a weaker profile to avoid findings.

Choose exactly one scope:

- `--changed-since <ref>` for implementation verification. Use the actual PR base
  or agreed task baseline. This includes committed branch changes since the merge
  base plus staged, unstaged, and untracked files. It checks complete selected
  files, not just edited lines, so existing violations can be reported too.
- `--staged` only when verifying the exact Git index is the requested contract.
  It reads staged blobs; it does not prove unstaged implementation or the full PR.
- `--all` for an explicitly required repository-wide audit or adoption baseline.
  Do not expand an ordinary change into a repository-wide cleanup.

Resolve the ref and inspect the selected changes before running. Record the base
SHA as well as the ref. Do not switch the base to `HEAD`, narrow to staged files,
or omit failing files to manufacture a pass. Preserve unrelated user work and
classify its findings separately.

## Run and interpret

Example for a Software Factory change targeting `origin/main`; replace the target
path and comparison ref with the actual worktree and task baseline:

```sh
node /Users/krish/Desktop/code/software-engineering/packages/code-contracts/bin/code-contracts.js check \
  --repo /absolute/path/to/target-worktree \
  --changed-since origin/main \
  --profile software-factory \
  --format json
```

The JSON result contains `files` and `diagnostics`. Verify that the file list
covers the changed supported sources; a zero-file success does not establish
source-code compliance. For documentation-only or unsupported-language changes,
record why the check is not applicable rather than reporting a lint pass.

- Exit `0`: no reported violations in the selected files.
- Exit `1`: contract violations or source parse errors. Fix in-scope failures and
  rerun after the final relevant edit. Unresolved violations are `NOT VERIFIED`.
- Exit `2`: invalid invocation or runner/environment failure. Repair the command
  or environment when possible; otherwise record blocked evidence. Do not claim
  `VERIFIED` without the required run.

Classify existing failures using baseline source/output at the same tool revision
and profile. A pre-existing finding is not automatically waived, and unrelated
failures do not authorize cleanup. Return material scope or contract conflicts to
the engineer. Do not disable rules, add blanket suppressions, or alter linter
configuration to obtain a passing result; a legitimate rule exception requires
its documented justification and a resolved contract decision.

Include the exact command, tool and target revisions, profile, resolved base,
checked-file coverage, exit status, diagnostics, and remaining limitations in the
handoff. A linter pass proves only its implemented contracts, not runtime,
authorization, or feature correctness.
