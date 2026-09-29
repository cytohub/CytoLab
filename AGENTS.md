<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# BioEngine

Life-science R&D platform. V1 is an experiment & research progress dashboard;
`docs/architecture.md` is the source of truth for structure and decisions.

## Stack

Next.js 16 (App Router, React 19) · TypeScript 5.9 strict · Tailwind 4 ·
Drizzle ORM + PostgreSQL 16 · Zod 4 · Vitest + Playwright.

## Layering (enforced by ESLint import boundaries)

- `src/domain` — pure, isomorphic: enums, labels, permissions, workflows,
  attention rules, project metrics, Zod schemas, errors. No server/UI imports.
- `src/server` — `server-only`; DB, auth, platform services, per-module services.
- `src/app` — App Router pages (server-first reads) and `/api/v1` REST handlers.
- Reads: Server Components call services directly with an `AuthContext`.
  Writes: always through `/api/v1` (same services). Every service call takes
  `ctx: AuthContext` first and filters by `ctx.orgId`.

## Workflow

- `pnpm dev` — app on :3000. `pnpm db:reset` — drop + migrate + seed demo data.
- `pnpm check` — typecheck + lint + unit tests. `pnpm test:integration` needs
  a Postgres test DB (`DATABASE_URL_TEST`). `pnpm test:e2e` runs Playwright.
- Schema change → edit `src/server/db/schema/*` then `pnpm db:generate`
  (never hand-write migrations except custom SQL like triggers).
- Server scripts run under `tsx --conditions=react-server` (see package.json).

## Conventions

- UUIDv7 keys, `org_id` on every tenant row, soft delete via `deleted_at`,
  optimistic concurrency via `version` on projects/experiments.
- Human IDs: projects use a code (CART-001), experiments `EXP-1024`, samples
  `SMP-00042`, milestones `M3`.
- Mutations record activity + audit + notifications in one transaction and
  reindex `search_documents`. The audit log is append-only (DB trigger).
- All seeded scientific data is synthetic — never present it as real findings.
