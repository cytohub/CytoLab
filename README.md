# CytoLab

A modern life-science R&D platform. **V1 is an Experiment & Research Progress
Dashboard**, built on a foundation designed to grow into a full scientific R&D
operating system — experiment management, sample and data management, an
electronic lab notebook, and a permission-aware AI layer — without a rewrite.

> **The demo starts empty.** It holds no research data: visitors sign in with
> neutral demo accounts and create their own projects and experiments, which the
> nightly reset removes. Nothing in it is a real scientific finding.

## What's in V1

- **R&D dashboard** — active projects, experiment throughput, status
  distribution, project health, upcoming milestones, needs-attention list and a
  live activity feed.
- **Projects** — list and detail workspace with computed progress and health,
  milestones, and a status workflow.
- **Experiments** — filterable/sortable list and an ELN-style workspace with
  tabs for protocol, inputs, samples, observations, structured results, files
  and activity.
- **Timeline**, **research-progress analytics**, **global search**, an
  **activity feed**, **notifications**, and **teams/people**.
- **Auth & RBAC** — session auth with five roles and resource-level policies.
- **Auditability** — every mutation records activity + an append-only audit
  entry and reindexes search, in one transaction.

Future modules (Samples, Protocols, Data, Inventory) are visible in the
navigation and marked *coming soon*; the data model already reserves them.

## Stack

TypeScript 5.9 · Next.js 16 (App Router, React 19) · Tailwind CSS 4 · Drizzle
ORM + PostgreSQL 16 · Zod 4 · Vitest + Playwright.

The architecture — a modular monolith with a pure domain layer, `server-only`
services, and an API-first design where the UI's writes all go through the same
audited `/api/v1` endpoints an integration or AI agent would use — is documented
in [`docs/architecture.md`](docs/architecture.md).

## Quick start

Requires Node 20+, pnpm, and PostgreSQL 16 (Docker or local).

```bash
pnpm install
cp .env.example .env          # adjust DATABASE_URL if needed

docker compose up -d          # starts Postgres on :5432 (or use your own)
pnpm db:migrate               # apply migrations
pnpm db:seed                  # load the synthetic demo workspace
#   …or: pnpm db:reset        # drop + migrate + seed in one step

pnpm dev                      # http://localhost:3000
```

On the sign-in page, pick a demo account (or sign in as
`demo-<role>@cytohub.example` with the password `cytolab-demo`) to explore the
different roles — Admin, Lab Manager, Scientist, Researcher, Viewer. The other
listed members cannot be signed in to. In production mode (`pnpm start`, Docker) the
demo workspace opens only with `PUBLIC_DEMO=true`.

## Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Run the app in development. |
| `pnpm build` / `pnpm start` | Production build / serve. |
| `pnpm typecheck` · `pnpm lint` | Static checks. |
| `pnpm test` | Unit tests (pure domain logic). |
| `pnpm test:integration` | Integration tests against a Postgres test database. |
| `pnpm test:e2e` | Playwright smoke tests (needs a build + seeded DB). |
| `pnpm check` | typecheck + lint + unit tests. |
| `pnpm db:generate` | Generate a migration from schema changes. |
| `pnpm db:migrate` · `pnpm db:seed` · `pnpm db:reset` | Database lifecycle. |
| `pnpm db:grant` | Re-grant the app role (`APP_DB_ROLE`) its row access; migrate and reset do this already. |
| `pnpm jobs:attention` | Run the "needs attention" notification scan. |

Integration tests use `DATABASE_URL_TEST` (default
`…/cytolab_test`); the harness drops and rebuilds that schema before running.

## Deployment

The `Dockerfile` builds one image that serves the app and runs the database
scripts. [`DEPLOY.md`](DEPLOY.md) walks through hosting the public demo on
Railway at `cytolab.ai`: uploads and account changes switched off, per-visitor
write limits, and a nightly reset. To run the same demo on a single AWS
Lightsail server with a Route 53 domain, follow
[`deploy/lightsail/README.md`](deploy/lightsail/README.md).

## Project structure

```
docs/architecture.md      Source of truth for structure & decisions
drizzle/                  Committed SQL migrations
scripts/                  migrate / seed / reset / jobs
src/
  domain/                 Pure, isomorphic: enums, permissions, workflows,
                          attention rules, project metrics, Zod schemas
  server/
    db/                   Drizzle schema + client
    auth/ authz/          Sessions, AuthContext, role→permission matrix
    http/                 API handler wrapper (auth, CSRF, validation, errors)
    platform/             Entity registry, events, search index, storage, ids
    modules/<module>/     Per-context services (reads + writes)
  app/                    App Router pages + /api/v1 REST handlers
  components/             Design system, shell, and feature components
tests/                    Integration + E2E
```

## Testing philosophy

- **Unit** tests cover the business rules the product depends on: the
  "needs attention" evaluation, project progress/health, status workflows,
  the RBAC matrix and resource policies, and identifier handling.
- **Integration** tests run real services against Postgres and assert the
  properties that matter for a multi-tenant scientific system: tenant
  isolation, RBAC enforcement, optimistic concurrency, activity + audit
  recording, search indexing, the append-only audit log, and that the SQL
  "attention" filter agrees exactly with the domain rule.

## Roadmap

Phase 1 (this build) → Experiment Management → Scientific Data & Samples →
Collaborative R&D (ELN, e-signatures, SSO) → R&D Operating System (AI over the
knowledge graph). See [`docs/architecture.md`](docs/architecture.md) §8.
