# Architecture and ownership

Change the lowest honest owner of behavior. Shared infrastructure should expose
general capabilities; domain modules should own domain data, policy, routes,
and workflow.

## One authoritative source

For every displayed, derived, or navigated value, identify one owner. Avoid
duplicate queries, local mirrors, cache entries, or reconstruction paths created
only to recover information already available from an authoritative source.

Dependency direction must remain honest. Shared primitives may accept data and
callbacks from a domain wrapper; shared infrastructure must not import a
presentation helper to learn domain behavior.

## Types carry the contract

Use discriminated variants when fields depend on state or subtype. Use callback
presence when it directly represents capability instead of pairing a callback
with a redundant disabled flag. Choose one absence contract rather than mixing
`null` and `undefined` for the same fact.

Do not introduce a type, wrapper, manager hook, or context merely to make a
small expression look formal. It must own an independent contract, lifecycle,
or repeated operation.

## Search before adding a seam

Inspect neighboring modules and shared packages before adding hooks, helpers,
route objects, contexts, stores, or base components. Compare actual contracts;
reuse is correct only when ownership and semantics match. If they differ, name
the missing axis and keep the boundary explicit rather than hiding the
difference behind options and conditionals.
