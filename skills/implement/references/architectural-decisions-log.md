# Architectural decisions log

Keep a record of architectural decisions you fill in during implementation when
the approved plan did not specify them. This is not a decision delta—it does
not block or return to the engineer. It surfaces consequential local choices for
the plan owner to review after delivery.

## What to log

Record architectural-level decisions that shape system structure, not trivial
implementation details:

- where state, caching, or derived data lives;
- which module, component, or layer owns a responsibility;
- new dependencies, abstractions, seams, or boundaries introduced;
- layer or boundary changes;
- choosing between competing designs when source evidence does not establish one
  clear winner.

Do not log mechanical choices covered by repository convention, obvious type
refinements, or private implementation details with one clearly superior
expression. Those remain implementer decisions.

## Format

Use this concise format per entry:

```md
### <Short decision title>

- Decision: <what you chose>
- Alternatives: <other options considered>
- Rationale: <why this choice>
- Location: <files or symbols affected>
```

## When to record

Record decisions as you make them during implementation, not reconstructed at
the end. If you made no consequential architectural choices because the plan was
complete or all gaps had unambiguous solutions from repository convention, state:

```md
## Architectural decisions log

None. The approved plan specified all architectural choices, and remaining
implementation details followed established repository conventions.
```

or

```md
## Architectural decisions log

None. All gaps were resolved by unambiguous repository conventions in <files>.
```

## Include in handoff

Add the log to your final implementer handoff. It flows into the "consequential
local decisions" section that execute synthesizes for the plan owner.
