# Architecture Overview — proshop_mern

> High-level map of the system as of **2026-05-29** (M6 Stage 3 living-docs audit).
> For the machine-readable structure, see `project-index.json` at the repo root.
> Per-module deep dives live in [`../specs/`](../specs/). Decision records in [`../adr/`](../adr/).

## What this is

A MERN e-commerce app (Brad Traversy proshop fork) extended for the AI-dev course with
two **Model Context Protocol (MCP)** servers and a polyglot data layer.

## Subsystems

| Subsystem | Path | Stack | Role |
|---|---|---|---|
| Backend API | `backend/` | Express 4 + Mongoose 5 (ESM) | REST API: auth, products, orders, uploads, feature flags |
| Frontend | `frontend/` | React + Redux thunk + React Router v5, **Tailwind v4 + shadcn-style** (`src/components/good-shop/`) | SPA storefront + admin |
| Feature-flags MCP | `mcp-server-feature-flags/` | Node/TypeScript (stdio) | Read/write `backend/features.json` via MCP tools — see [spec](../specs/feature-flags-mcp-spec.md) |
| Search-docs RAG MCP | `mcp-server-search-docs/` | Node/TypeScript + OpenAI embeddings + Postgres/pgvector | Semantic search over project docs — see [spec](../specs/search-docs-rag-mcp-spec.md) |

> There is **no** Python MCP, **no** `rag/` folder, **no** Weaviate, **no** `superpowers/` folder.
> Older course material that references those describes a different layout.

## Data stores (polyglot persistence)

The system intentionally uses **three** stores — this supersedes the "MongoDB is the sole
database" claim in [`../adr/adr-001-mongodb-vs-postgres.md`](../adr/adr-001-mongodb-vs-postgres.md):

1. **MongoDB** — orders, users, products (OLTP via Mongoose).
2. **`backend/features.json`** — a flat JSON file for feature flags, written by **two**
   processes (the backend controller and the feature-flags MCP). See the concurrency caveat
   in [`../specs/featureFlagController-spec.md`](../specs/featureFlagController-spec.md).
3. **PostgreSQL + pgvector** — RAG document embeddings for the search-docs MCP. The corpus is
   pre-chunked in `../project-data/chunks.jsonl` (re-ingest after doc edits).

## Request flow (storefront → API)

See `../architecture.md` for the C4-style mermaid diagram of the order/PayPal flow, and the
per-controller sequence diagrams in `../specs/`.

## Security posture (post Stage-2 fixes, 2026-05-29)

- `getUsers` no longer leaks bcrypt password hashes (`.select('-password')`).
- `GET /api/orders/:id` is owner/admin-only (IDOR closed; non-owner → 404).
- `POST /api/upload` requires `protect + admin`.
- Still open (tracked): `updateOrderToPaid` ownership + server-side PayPal verification,
  client-trusted order totals, NoSQL operator-injection on login email, 30-day JWT TTL.
  See [`../../homework-m6/stage1-code-review/synthesis.md`](../../homework-m6/stage1-code-review/synthesis.md).

## Institutional history (archived, do not lose)

These were moved to `docs-archived-2026-05-29/` during the audit but remain essential reading:

- **Project timeline** → `docs-archived-2026-05-29/project-data/dev-history.md` (Jan 2023 → Apr 2026).
- **Incident postmortems** → `docs-archived-2026-05-29/incidents/` :
  - `i-001` PayPal double-charge (referenced by ADR-001 + incident-response runbook)
  - `i-002` Mongo connection-pool exhaustion
  - `i-003` JWT secret leak
- **Superseded ADRs** → `docs-archived-2026-05-29/adrs/` : `adr-003` (duplicate of canonical
  ADR-0001), `adr-005` (Bootstrap — reversed by the Tailwind v4 rework; see ADR-0004).
