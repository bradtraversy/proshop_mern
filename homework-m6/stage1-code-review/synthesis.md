# Code Review Synthesis — proshop_mern (homework M6 Stage 1)

**Date:** 2026-05-29
**Reviewer:** 3-agent team (security-mate + performance-mate + architecture-mate), sequential (Option A)
**Scope:** Whole repository — `backend/`, `frontend/src/`, `mcp-server-feature-flags/src/`, `mcp-server-search-docs/src/`, root config
**Inputs:** `security-review.md` (18), `performance-review.md` (17 + 1 clean), `architecture-review.md` (15 + 1 status) → 50 raw findings, de-duplicated below.

---

## HIGH severity (10 findings)

### Auth & access control (security A01)

1. **`backend/controllers/orderController.js:43`** — IDOR in `getOrderById` (`GET /api/orders/:id`): any authenticated user reads any order's PII / address / email / payment data by iterating ids. No ownership or admin check.
   - Source: security-mate (HIGH, A01)
   - Fix approach: after loading the order, allow only `order.user === req.user._id` OR `req.user.isAdmin`; else 401/404.
   - Effort: 30 min

2. **`backend/routes/uploadRoutes.js:37`** — `POST /api/upload` is fully public (no `protect`/`admin`). Anyone can upload files served statically from `/uploads`.
   - Source: security-mate (HIGH, A01)
   - Fix approach: add `protect, admin` middleware to the route (matches how product mutations are already protected).
   - Effort: 20 min

3. **`backend/controllers/orderController.js:60`** — `updateOrderToPaid` lets any authenticated user mark ANY order paid with attacker-supplied `paymentResult`; no ownership check, no server-side PayPal capture verification.
   - Source: security-mate (HIGH, A01); architecture-mate (compounds ADR-0002)
   - Fix approach: add ownership/admin guard now; full server-side PayPal verification is a larger change (ADR-0002 acknowledges the trust gap) — track as follow-up.
   - Effort: 30 min (guard only)

### Data exposure — triple-flagged ⭐

4. **`backend/controllers/userController.js:110-111`** — `getUsers` (admin list) returns full User docs **including the bcrypt password hash**, and is unbounded (no pagination). `getUserById:134` already uses `.select('-password')` — same resource, two contracts, one leaks a credential.
   - Source: **security-mate (HIGH, data exposure) + performance-mate (PERF-007) + architecture-mate (C1 contract)** — flagged by all three
   - Fix approach: `.select('-password')` on the query (credential leak); pagination is a separate, larger change.
   - Effort: 15 min

### Dependency & crypto

5. **`package.json:24`** — `jsonwebtoken ^8.5.1` carries HIGH CVEs (verify signature-bypass via insecure default algorithm, RSA→HMAC confusion); `authMiddleware.js` does not pin `algorithms`.
   - Source: security-mate (HIGH, A06)
   - Fix approach: bump to `jsonwebtoken@^9` and pin `algorithms: ['HS256']` in `jwt.verify`. (Touches a dependency — see Stage 2 note.)
   - Effort: 45 min

6. **`package.json` deps overall** — `npm audit`: 2 critical / 20 high (multer, mongoose, express chain).
   - Source: security-mate (HIGH, A06)
   - Fix approach: staged dependency upgrade with regression testing — out of Stage 2's "<200 lines, no new deps, safe" envelope. Track as a separate hardening epic.
   - Effort: multi-hour

### Performance — RAG hot path & unbounded lists

7. **`mcp-server-search-docs/src/index.ts:131`** — RAG `/search` opens+closes a new `pg.Client` on every call (full TCP+auth handshake). ~**+20-60ms p50/call** + connection churn under load.
   - Source: performance-mate (HIGH); architecture-mate (pairs with no-DAL finding)
   - Fix approach: one module-scope `pg.Pool`, `pool.query()` per request.
   - Effort: 1 h

8. **`mcp-server-search-docs/src/index.ts:98`** — query re-embedded via a fresh OpenAI client every call, no cache. ~**+100-400ms p50/call** + token spend on repeated queries.
   - Source: performance-mate (HIGH)
   - Fix approach: module-scope client + bounded LRU cache (normalized query → embedding).
   - Effort: 1 h

9. **`backend/controllers/orderController.js:113`** — `getOrders` (admin) returns all orders unbounded; multi-MB payloads + blocking `JSON.stringify`, latency linear in collection size.
   - Source: performance-mate (HIGH); architecture-mate (list-contract)
   - Fix approach: pagination + indexed `createdAt` sort.
   - Effort: 1 h

### Architecture — silent client-trusted money

10. **`backend/controllers/orderController.js:23`** — server trusts client-computed `itemsPrice/taxPrice/shippingPrice/totalPrice` (calculated in `PlaceOrderScreen.jsx:23-28`) and stores them verbatim; never recomputes from authoritative product prices.
    - Source: architecture-mate (C1); compounds security-mate finding #3 and ADR-0002
    - Fix approach: recompute totals server-side at order creation → proposed **ADR-0004**.
    - Effort: 2-3 h

---

## MEDIUM severity (selected, de-duplicated)

- **`backend/controllers/featureFlagController.js:9` + `mcp-server-feature-flags/src/index.ts:28`** — feature-flag JSON file written by **two independent processes** (backend + MCP) via direct `fs` read-modify-write, both bind-mounted to one file, no lock/transaction → lost-update; **and divergent validation contracts** (MCP allows `Shadow` + dependency/traffic guards; backend allows only `Enabled|Testing|Disabled`). Also the read path does `readFileSync`+parse per request (PERF-003/004). Flagged by architecture (C1/C2) + performance (HIGH/MED). → proposed **ADR-0005**.
- **`backend/controllers/userController.js:11`** — NoSQL operator injection risk on unvalidated `req.body.email` in `User.findOne` (security A03/MEDIUM).
- **`mcp-server-search-docs/src/index.ts:115`** — retrieved document text returned untrusted to the calling LLM (prompt-injection surface); SQL itself is parameterized (security MEDIUM).
- **`mcp-server-search-docs/src/index.ts:24` + `docker-compose.yml:39`** — hardcoded default Postgres creds `proshop/proshop` (security MEDIUM).
- **`backend/server.js:25`** — no helmet, no global rate limiter, no body-size limit (security MEDIUM; A04/A05).
- **No service layer** (`orderController.js:7`, all controllers) — controllers call Mongoose directly with domain logic inline; root cause of contract drift + untestability (architecture C2 root cause).
- **No validation tier** (`userController.js:9`, `orderController.js:8`) — raw `req.body` → Mongoose, despite copilot-instructions §6 mandating body validation (architecture C2).
- **Missing Mongo indexes** on `Order.user`, `Product.rating`, `Product.name`; unindexed regex search; no HTTP compression/cache (performance MED).
- **Polyglot persistence undocumented** — Mongo + JSON file + pgvector contradict `adr-001` "MongoDB is the sole database" (architecture C2) → proposed **ADR-0006**.
- **Frontend bundle** — no code-splitting / `React.lazy`; PayPal lib in global bundle (~+200-600ms LCP on 3G) (performance MED).

## LOW severity (hygiene)

- bcrypt cost 10 → raise to ≥12 (security); container runs as root, no `USER node` (security); missing security headers/CORS allowlist (security).
- feature-flag controller uses raw `req.params.name` as object key + reflected in error (security LOW).
- sequential `countDocuments`+`find` (PERF-012); render-time store mutation in `OrderScreen` (PERF-015); unsized/eager grid images (PERF-016); unbounded embedded reviews array (PERF-017).
- Stale **adr-005** (says Bootstrap; code uses Tailwind v4 + shadcn); dead `VITE_API_URL` in compose; copy-pasted auth-error logout across 6 thunks.

---

## Cross-mate observations (flagged by ≥2 agents)

| Finding | security | performance | architecture |
|---|:--:|:--:|:--:|
| `getUsers` password-hash leak + unbounded | ✅ HIGH | ✅ PERF-007 | ✅ C1 |
| Client-trusted order pricing / payment | ✅ (#3) | — | ✅ C1 (compounds ADR-0002) |
| Feature-flag dual-writer file store | ✅ (LOW reflection) | ✅ PERF-003/004 | ✅ C1/C2 |
| RAG per-call pg connect + inline SQL | — | ✅ PERF-001 | ✅ C2 (no DAL) |
| Unbounded list contracts (orders/users) | ✅ (exposure) | ✅ PERF-005/006/007 | ✅ C1/C2 |
| Product regex search (ReDoS vs COLLSCAN) | ✅ mitigated | ✅ PERF-011 | — |

---

## Recommended fix order (top 5)

1. `getUsers` `.select('-password')` — credential leak, one line, triple-flagged. **(Stage 2 #1)**
2. `getOrderById` IDOR ownership check — PII exposure, contained. **(Stage 2 #2)**
3. `POST /api/upload` add `protect, admin` — public write surface, contained. **(Stage 2 #3)**
4. RAG `pg.Pool` + embedding cache — biggest latency win (-120…-460ms p50).
5. Server-authoritative order pricing (ADR-0004) — closes the client-trusted-money gap.

---

## ⭐ Top-3 для Stage 2

Selected for: (a) HIGH severity / multi-agent agreement, (b) contained & safe (<200 lines, **no new production deps**), (c) characterization-testable on the Express stack.

| # | File:line | Issue | Recommended fix | Effort |
|---|---|---|---|---|
| 1 | `backend/controllers/userController.js:110-111` | `getUsers` leaks bcrypt password hashes (no `.select('-password')`) — triple-flagged | Add `.select('-password')` to the query | 15m |
| 2 | `backend/controllers/orderController.js:43` | IDOR: any user reads any order via `GET /api/orders/:id` | Add ownership/admin guard after fetch (else 404/401) | 30m |
| 3 | `backend/routes/uploadRoutes.js:37` | `POST /api/upload` fully public | Add `protect, admin` middleware to the route | 20m |

**Why these three over the perf/arch HIGHs:** the RAG pool fix (#7) and server-side pricing (#10) are higher-effort and need a running Postgres / cross-layer changes; #5/#6 touch dependencies (outside Stage 2's "no new deps / safe" envelope). The three chosen are all security A01 access-control defects, each a small contained diff with a clear intentional behavior change that characterization tests can pin (current = open, post-fix = locked).

---

## Token usage estimate (cost awareness)

| Agent | Subagent tokens (approx) |
|---|---|
| security-mate | ~51k |
| performance-mate | ~66k |
| architecture-mate | ~71k |
| main (orchestration + synthesis) | ~40k |
| **Total Stage 1** | **~230k tokens** |

Sequential Option A. Parallel Agent Team (Option B) would cut wall-clock but raise total tokens (mailbox chatter + overlap).
