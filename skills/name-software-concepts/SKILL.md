---
name: name-software-concepts
description: Choose or review names for software concepts, identifiers, packages, rules, APIs, schemas, and architectural boundaries when semantics, ownership, lifecycle, or trigger clarity matter. Do not use for prose copyediting or purely cosmetic renames.
---

# Name Software Concepts

Treat a name as a contract. It should tell a new reader what the concept owns,
what it does, where it applies, and which distinctions matter without requiring
the original design conversation.

## Establish the referent

Before proposing names, identify:

- the exact behavior, data, policy, or boundary being named;
- its owner, scope, lifecycle, cardinality, and operation;
- adjacent concepts it must not be confused with;
- mature vocabulary already used by the repository or public contract;
- whether the name affects discovery or routing, such as a skill, rule, command,
  package, or configuration key.

Do not rename a concept to disguise unresolved ownership or an incoherent
abstraction. Fix or escalate the underlying contract first.

## Litigate candidates

Propose a small set of credible candidates. For each candidate, state:

- the literal semantic claim it makes;
- what a reader or automated router could reasonably mistake it for;
- whether it exposes the real owner, scope, lifecycle, and operation;
- collisions or overloaded meanings in the repository;
- how it behaves at call sites and in related vocabulary.

For skills and rules, prefer capability or enforced-outcome names over attitude,
process, or aspiration names. Test whether the name and description make both
positive and negative trigger cases obvious.

Recommend one name. Explain why it fits better than the strongest alternative;
do not present an undifferentiated list and externalize the decision.

## Propagate an approved rename

When the task authorizes edits, rename the concept atomically across every
affected surface: directory and file names, manifest metadata, symbols, imports,
registries, configuration, documentation, tests, examples, and prompts. Search
for the old name afterward and classify every remaining occurrence.

Do not retain aliases, fallback names, or dual terminology unless compatibility
is an explicit contract. Public APIs, persisted values, external integrations,
and published package names require a migration decision before destructive
renaming.

## Boundaries

- Do not rename merely because another word feels nicer. Name the concrete
  semantic mismatch or discovery failure.
- Do not broaden implementation scope beyond the approved naming decision.
- Preserve repository naming conventions unless they obscure a material
  distinction this concept must express.
- Keep local mechanical identifiers local when nearby precedent already settles
  them; this skill is for names that carry design or routing meaning.
