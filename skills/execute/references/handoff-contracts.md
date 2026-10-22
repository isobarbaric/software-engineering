# Handoff contracts

Role isolation is useful only when each handoff is portable. Pass artifacts and
evidence, not hidden chain-of-thought or a vague summary.

## Execute to engineer

Provide:

- the original blueprint or an exact reference to it;
- the bounded problem framing;
- explicit constraints, acceptance criteria, and non-goals;
- repository and checkout context;
- known human decisions and unresolved questions.

Expect a complete implementation contract or a narrowly framed human-owned
decision with evidence and a recommendation. Do not accept a prose checklist
that leaves architecture, ownership, or verification for the implementer to
rediscover.

## Engineer to implementer

Provide the complete current plan, including:

- observable contract and preserved behavior;
- current owners and target responsibilities;
- concrete files and symbols;
- changed data, state, API, persistence, or deployment contracts;
- ordered work and focused verification;
- explicit exclusions;
- resolved decisions and remaining human-owned decisions.

The implementer should not need the engineering conversation.

## Implementer to engineer

Return a decision delta only when source or runtime evidence invalidates a
material plan assumption. Include the discovery, evidence, invalidated
assumption, impact, recommendation, and unaffected work that can continue.

Routine imports, moved symbols, local types, fixture updates, command changes,
and unambiguous repository conventions remain implementer decisions.

## Implementer to execute

Return:

- completed plan items;
- catalog skills and focused references used;
- changed files and contracts;
- consequential local decisions (the architectural decisions log);
- `$verify-implementation` status and evidence;
- unresolved deltas, blockers, or limitations.

Execute synthesizes this evidence. It does not independently reinterpret the
implementation or override either role's ownership.
