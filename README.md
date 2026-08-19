# sittter

A pet and house sitting business, run from a phone.

## Start here

Read `AGENTS.md` first. Every session. It holds the architectural rules that
outrank any task instruction.

| Document                | Purpose                                            |
| ----------------------- | -------------------------------------------------- |
| `AGENTS.md`             | Standing orders and architectural rules            |
| `SESSION_LOG.md`        | Current state and running record of completed work |
| `docs/spec.md`          | What the product does                              |
| `docs/dev-plan.md`      | Phases, schema, contracts, test strategy           |
| `docs/plan-summary.md`  | Phase status at a glance                           |
| `docs/user-journeys.md` | End-to-end behavior and test coverage              |
| `tasks/phase-N.md`      | Task list for a phase                              |

## Setup

Requires Node 22+ and pnpm.

```sh
pnpm install
cp .env.example .env    # then fill it in
```

## Commands

| Command                 | What it does                                              |
| ----------------------- | --------------------------------------------------------- |
| `pnpm dev`              | Development server on :3000                               |
| `pnpm build`            | Production build                                          |
| `pnpm test:unit`        | Unit tests, `src/core/` only                              |
| `pnpm test:integration` | Integration tests against a real database                 |
| `pnpm test:e2e`         | Playwright end-to-end tests                               |
| `pnpm typecheck`        | Type check, zero errors expected                          |
| `pnpm lint`             | Lint, zero errors expected                                |
| `pnpm format`           | Prettier write                                            |
| `pnpm demo`             | Prints a priced booking, visit schedule, and digest model |
| `pnpm db:generate`      | Generate a migration from `src/db/schema.ts`              |
| `pnpm db:migrate`       | Apply migrations                                          |
| `pnpm db:seed`          | Load development fixtures                                 |

## The one rule to know before writing code

`src/core/` is pure. No database, no network, no filesystem, no clock, no
randomness, no environment reads. A function needing the current date takes
it as an argument.

This is enforced by `no-restricted-imports` in `eslint.config.mjs`. Do not
disable it or add an exception. If code under `src/core/` needs something
the rule forbids, it belongs in `src/services/` instead.
