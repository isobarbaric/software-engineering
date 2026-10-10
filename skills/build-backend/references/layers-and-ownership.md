# Layers and ownership

Use layers to make responsibility and dependency direction legible, not to
manufacture files. A small operation may need fewer concrete types, but it must
still preserve these ownership boundaries.

## Transport boundary

Controllers, handlers, resolvers, consumers, and tool entrypoints translate an
external protocol into typed domain input and translate the result back. They
own parsing, serialization, protocol status, request identity, and dependency
wiring. They do not own business rules or direct persistence.

Keep framework injection at this boundary. Construct required collaborators in
the repository's established composition root and pass typed domain values into
services.

## Service boundary

The owning service names the domain operation. It owns validation,
orchestration, state transitions, authorization calls, cross-repository
coordination, and the transaction boundary.

Required collaborators belong in the constructor or equivalent composition
contract. Do not pass repositories, sessions, or other injected infrastructure
through ordinary domain methods. Call another owning service rather than
copying its policy into a nearby service.

## Persistence boundary

Repositories own queries, inserts, updates, locking mechanics, and database
session behavior. They expose domain-shaped persistence operations and remain
free of workflow decisions. They never call services.

Avoid both extremes:

- SQL scattered through orchestration code hides query ownership and makes
  transaction reasoning difficult.
- one-line repository wrappers around generic ORM calls add indirection without
  naming a useful persistence operation.

## Database boundary

Models and database constraints own durable shape and invariants that must hold
regardless of caller. Request validation is not a database constraint, and a
database constraint does not replace a clear service contract.

Use `$build-migrations` for any durable shape or stored-meaning change. The
model, migration, and deployed compatibility window are one contract.

## Boundary test

For each changed rule, name the one layer that prevents it from being bypassed.
If several layers independently decide the same fact, there is duplicate truth.
If no layer owns it, the implementation is incomplete.

Repository instructions may add local rules for module purity, dependency
factories, schemas, transactions, and file placement. Apply those instructions
directly. Do not load an unsurfaced repository skill to obtain them.
