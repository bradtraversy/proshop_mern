# Architecture Mate — Review Summary

**Reviewer:** architecture-mate (acting per `.claude/agents/architecture-mate.md` — read-only, find-only)
**Scope:** Whole repository — `backend/`, `frontend/src/`, `mcp-server-feature-flags/src/`, `mcp-server-search-docs/src/`, `backend/server.js`, `docker-compose.yml`
**Scope size:** ~25 source/config files across the Express backend, React/Redux frontend, and two TypeScript MCP servers
**ADRs loaded:** 8 — `docs/adr/0001-0003` + `docs/project-data/adrs/adr-001..005`
**Read first:** `.github/copilot-instructions.md`, all ADRs, and the two prior reports (`security-review.md`, `performance-review.md`), cross-referenced below.

---

## Findings by criticality

- **C1 (HIGH):** 4 — client-trusted order pricing, feature-flag dual-writer file store, password-hash leak in user list, missing service layer impact on contracts
- **C2 (MEDIUM):** 7 — no service layer, duplicated/divergent flag logic, polyglot-persistence ADR gap, path coupling to flag file, copy-pasted auth cross-cutting concern, inconsistent list contracts, missing validation tier, RAG inline SQL/no DAL
- **C3 (LOW):** 4 — dead `VITE_API_URL` config, anaemic models, duplicated MCP scaffolding, Redux boilerplate cohesion smell
- **Status lines:** ADR compliance checked (1)

Total: 15 actionable findings + 1 ADR-compliance status line.

---

## Top concerns (C1)

1. **`backend/controllers/orderController.js:23`** — Server trusts client-computed money. `itemsPrice/taxPrice/shippingPrice/totalPrice` are calculated in `PlaceOrderScreen.jsx:23-28` (15% tax, $100 shipping rule) and stored verbatim. Core pricing domain logic lives in the presentation layer; the server never recomputes from authoritative product prices. (ADR violated: none — proposing one. Compounds ADR-0002 payment trust gap.)

2. **`backend/controllers/featureFlagController.js:9` + `mcp-server-feature-flags/src/index.ts:28`** — Feature-flag store is a flat JSON file written by **two independent processes** (Express backend and the MCP server) via direct `fs` read-modify-write, both bind-mounted to the same file in `docker-compose.yml:23,53`. No lock, no transaction, no shared abstraction → lost-update / last-writer-wins on concurrent edits. (ADR violated: none — proposing one.)

3. **`backend/controllers/userController.js:110`** — `getUsers` returns full User docs **including the bcrypt password hash**, while `getUserById:134` correctly uses `.select('-password')`. Same resource, two contracts, one leaks a credential. (Cross-ref security-review HIGH + performance-review PERF-007.)

4. **`backend/controllers/orderController.js:7` (root cause)** — No service layer anywhere; every controller calls Mongoose models directly and embeds domain logic (state transitions, review aggregation, flag mutation) in HTTP handlers. This is the structural root of findings #1, the anaemic models, and the contract inconsistencies. Confirmed: no `*service*` directory exists in `backend/` or `frontend/src/`.

---

## Grouped detail

### Layering & service boundary (C1/C2)
- **No service layer** (`orderController.js:7`, all controllers) — controller → model with no domain tier. Logic is untestable without HTTP and unreusable by the MCP servers. Root cause of several findings below.
- **Client-trusted pricing** (`orderController.js:23`) — domain calc in the React layer; server stores untrusted totals.
- **Anaemic domain models** (`orderModel.js:3`, `productModel.js`) — schema-only, no behavior; transitions live in controllers.
- **Missing validation tier** (`userController.js:9`, `orderController.js:8`) — raw `req.body` → Mongoose, no Joi/zod, despite copilot-instructions §6 mandating body validation.

### Feature-flag subsystem boundary (C1/C2)
- **Dual-writer file store** (`featureFlagController.js:9`, `mcp .../index.ts:28`) — two processes mutate one JSON file, no concurrency control.
- **Divergent domain contracts** (`mcp .../index.ts:18,185` vs `featureFlagController.js:51`) — MCP allows `Shadow` + enforces dependency/traffic guards; backend allows only `Enabled|Testing|Disabled` with no guards. The two writers disagree on what is valid.
- **Brittle dual path resolution** (`featureFlagController.js:6` vs `mcp .../index.ts:10`) — same file, two fragile path strategies; controller assumes cwd = repo root.

### API contract stability (C1/C2)
- **Password-hash leak in list** (`userController.js:110`) — inconsistent projection vs `getUserById`.
- **Inconsistent list envelopes** (`orderController.js:112`, `userController.js:111` bare arrays vs `productController.js:25` `{products,page,pages}`) — clients special-case each; adding pagination later is breaking. (Overlaps perf PERF-005/006/007.)

### MCP / RAG subsystem (C2/C3)
- **Inline SQL, no DAL** (`mcp-server-search-docs/src/index.ts:117`) — pgvector schema/`chunks` table referenced by both the searcher and an external `embed_chunks.js` with no shared schema source of truth. (Pairs with perf PERF-001 per-call connection.)
- **Duplicated MCP scaffolding** (`index.ts:168` in both servers) — copy-pasted bootstrap/status/main.

### Cross-cutting concerns & config (C2/C3)
- **Copy-pasted auth handling** (`orderActions.js:58` ×6 + `featureActions.js:62`) — `'Not authorized, token failed'` string match → `logout()` duplicated in every thunk; couples frontend to an exact backend error string (`authMiddleware.js:23`). ADR-0001 already flags this coupling.
- **Dead `VITE_API_URL`** (`docker-compose.yml:31`) — only the Vite *dev* proxy reads it; the production static build uses relative `/api`, which has no route to the backend in the compose topology. The API base-URL convention is implicit and only correct same-origin (Heroku).

### Persistence architecture (C2)
- **Polyglot persistence undocumented** (`docker-compose.yml:35`) — MongoDB + JSON file + Postgres/pgvector now coexist, but ADR-001 declares MongoDB "the sole database." The flag file and pgvector store are undocumented deviations.

---

## ADR compliance cross-check

| ADR | Status vs code |
|---|---|
| `0001` JWT/localStorage | Followed. Brittle error-string logout coupling it warns about is realized in every thunk (see finding). |
| `0002` Client-trusted PayPal | Followed (acknowledged risk). The new pricing finding **compounds** it — totals are also client-trusted. |
| `0003` No migration tooling | Followed; no `migrations/`, models are schema source. |
| `adr-001` MongoDB sole DB | **Deviated** — JSON-file flags + pgvector RAG store are not covered. Needs amendment (see Proposed ADRs). |
| `adr-002` Redux vs Context | Followed; 23-reducer store + thunk triad as documented. |
| `adr-003` JWT vs session | Followed. |
| `adr-004` PayPal vs Stripe | Followed (PayPal). |
| `adr-005` Bootstrap vs Tailwind | **Stale** — chose Bootstrap, codebase now uses Tailwind v4 + shadcn/ui. Update/supersede (styling is out of architecture scope, flagged for hygiene). |

---

## Proposed ADRs

### ADR-0004 (draft) — Server-authoritative order pricing
- **Decision:** Compute `itemsPrice`, `taxPrice`, `shippingPrice`, and `totalPrice` on the server from authoritative DB product prices at order creation; treat client-supplied totals as untrusted display values only.
- **Why it needs an ADR:** Today pricing is a presentation-layer responsibility (`PlaceOrderScreen.jsx`) silently trusted by the backend — an undocumented, security-relevant architectural decision that compounds ADR-0002. Either document the deliberate trust model or change it.
- **Trade-off:** small server-side pricing service vs current zero-backend-logic simplicity.

### ADR-0005 (draft) — Feature-flag store: single owner & concurrency model
- **Decision:** Define one authoritative owner of `backend/features.json` (or migrate flags into Mongo) and a single shared access module; the MCP server and the admin API must go through it rather than both writing the file directly. Specify the concurrency guarantee (single-writer / lock / transactional store) and a single validated status enum + dependency rules.
- **Why it needs an ADR:** the dual-writer JSON file with divergent validation contracts is the most fragile boundary in the repo and is invisible in current docs.
- **Trade-off:** coordination overhead vs current "just edit a file from anywhere" convenience.

### ADR-0006 (draft, optional) — Polyglot persistence boundaries (amends adr-001)
- **Decision:** Document that the system intentionally uses three stores — MongoDB (orders/users/products/OLTP), a file-based flag store, and PostgreSQL+pgvector (RAG embeddings) — with explicit ownership/boundaries for each.
- **Why it needs an ADR:** adr-001 currently claims MongoDB is the sole database, which the code contradicts. Supersede or amend it so the persistence map is accurate.

> Per the agent template, full Nygard drafts can be dropped at `docs/adr/0004-draft.md` etc. by the team; this review proposes the decisions and rationale (read-only — no files written into the ADR folder).

## Cross-specialist collaboration (cross-referenced prior reports)

- **security-review (orderController.js:60 / ADR-0002):** the client-trusted-payment HIGH is the payment half; this review adds the **pricing** half (totals also client-trusted) — both should be fixed together server-side.
- **security-review (getUsers password exposure) + performance-review (PERF-007):** both resolved by one architectural fix — a standardized User serializer that excludes `password` + paginates. Tracked here as an API-contract finding.
- **performance-review (PERF-005/006/007 unbounded lists):** overlaps the inconsistent-list-contract finding — adopting a single paginated envelope fixes both the perf payload growth and the contract drift.
- **performance-review (PERF-001 RAG per-call connect):** pairs with the RAG inline-SQL/no-DAL finding — extracting a pooled data-access module addresses both.
- **performance-review (PERF-003/004 feature-flag file I/O):** same `features.json` hot-path; the single-owner ADR proposed here is the architectural counterpart to their caching fix.

## Status

- All 8 loaded ADRs cross-referenced against the scope
- Layer boundaries scanned (controller/service/model, frontend/backend, MCP/backend)
- API contract stability checked (list envelopes, user projection)
- Coupling/cohesion & duplication scanned (flag logic, auth handling, MCP scaffolding)
- Prior security-review.md and performance-review.md cross-referenced (5 overlaps)
