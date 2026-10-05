# Domain Docs

This repository uses a single shared domain context despite its monorepo layout.

## Before exploring

- Read the root `CONTEXT.md` glossary.
- Read relevant architectural decisions under the root `docs/adr/` directory.
- If a document or directory is absent, proceed without creating a placeholder.
  The domain-modeling flow creates documents when terms or decisions crystallise.

## Consumer rules

Use the glossary's vocabulary in specifications, issue titles, tests, and design
discussions. Raise genuine terminology gaps through domain modeling rather than
inventing competing synonyms.

Keep `CONTEXT.md` a glossary. Implementation plans, constraints, API contracts,
and task notes belong in specifications or decision records.

Surface conflicts with existing ADRs explicitly instead of silently replacing
their decisions. Consult the relevant existing record before proposing a change.

Maintain one root glossary and one root ADR location. A multi-context map or
per-domain documentation split requires a separate agreed architectural change.
