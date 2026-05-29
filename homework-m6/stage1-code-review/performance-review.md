# Performance Mate — Review Summary

**Reviewer:** performance-mate (acting per `.claude/agents/performance-mate.md` — read-only, find-only)
**Scope:** Whole repository — `backend/`, `frontend/src/`, `mcp-server-feature-flags/src/`, `mcp-server-search-docs/src/`, `backend/server.js`
**Scope size:** ~25 source files across the Express backend, React/Redux frontend, and two TypeScript MCP servers
**Hot paths reviewed:** `/api/orders` (list + myorders), `/api/products` (list + search + top), feature-flag reads (HTTP + MCP), RAG `search_project_docs` (embedding + pgvector query)
**Read first:** `.github/copilot-instructions.md`, `homework-m6/stage1-code-review/security-review.md` (cross-referenced below)

---

## Findings by severity

- **HIGH:** 5 — RAG per-call DB connect (PERF-001), no embedding cache (PERF-002), feature-flag `readFileSync` on hot path (PERF-003), unbounded admin order list (PERF-005), unbounded user list incl. password hashes (PERF-007)
- **MEDIUM:** 8 — MCP feature-flag sync I/O (PERF-004), unbounded myorders (PERF-006), uncached/unindexed top-products (PERF-008), no HTTP cache/compression (PERF-009), missing Mongo indexes (PERF-010), unindexed regex search (PERF-011), no route code-splitting (PERF-013), PayPal lib in global bundle (PERF-014)
- **LOW:** 4 — sequential count/find (PERF-012), render-time store mutation (PERF-015), unsized/eager grid images (PERF-016), unbounded embedded reviews (PERF-017)
- **CLEAN:** N+1 scan — no ORM-in-loop pattern found (PERF-018)

Total: 17 actionable findings + 1 clean status.

---

## Top concerns (HIGH)

1. **`mcp-server-search-docs/src/index.ts:131`** — RAG `/search` creates `new pg.Client(...)`, `connect()`, then `client.end()` on **every** call. Each query pays a full TCP+auth handshake. **Est: +20-60ms p50 per /search** plus connection churn / backend-slot exhaustion under bursty agent traffic. Fix: one module-scope `pg.Pool`, `pool.query()` per request.

2. **`mcp-server-search-docs/src/index.ts:98`** — fresh OpenAI client per call and the query is **re-embedded every time** with no cache. **Est: +100-400ms p50 + per-token API spend** on every repeated/near-identical query. Fix: module-scope client + bounded LRU cache on normalized query → embedding.

3. **`backend/controllers/featureFlagController.js:9`** — feature-flag reads do `fs.readFileSync` + `JSON.parse` of ~14KB on the request thread for **every** GET (a documented hot path). **Est: ~0.3-1ms event-loop block per call, serializing all concurrent requests under load.** Fix: load once into module scope, refresh on write.

4. **`backend/controllers/orderController.js:113`** — `getOrders` (admin) returns **all** orders, no `limit`/pagination. Payload + synchronous `JSON.stringify` grow linearly; at scale this is **multi-MB responses, hundreds of ms-to-seconds latency, GC pressure**. Fix: paginate + sort on an indexed `createdAt`.

5. **`backend/controllers/userController.js:111`** — `getUsers` (admin) returns **all** users with **no pagination and no `.select('-password')`** — unbounded payload *and* leaks bcrypt hashes. Fix: paginate + exclude password. (Cross-ref security-review: data over-fetch / exposure.)

---

## Grouped detail

### Blocking I/O / event-loop (HIGH/MEDIUM)
- **PERF-001 (HIGH)** RAG: per-call `pg.Client` connect/end — use a pool.
- **PERF-003 (HIGH)** HTTP feature flags: `readFileSync`+parse per request — cache in memory.
- **PERF-004 (MED)** MCP feature flags: same `readFileSync`/`writeFileSync` sync pattern across all four tools.

### Missing pagination / unbounded result sets (HIGH/MEDIUM)
- **PERF-005 (HIGH)** `getOrders` — all orders, no limit.
- **PERF-006 (MED)** `getMyOrders` — all of a user's orders, no limit, unindexed filter.
- **PERF-007 (HIGH)** `getUsers` — all users, no limit, includes password hash.

### Caching opportunities (HIGH/MEDIUM)
- **PERF-002 (HIGH)** RAG embeddings recomputed every call — LRU cache.
- **PERF-008 (MED)** `getTopProducts` — full scan + in-memory sort each homepage hit, no index, no result cache.
- **PERF-009 (MED)** No `Cache-Control`/`ETag` and no gzip/br compression on public GETs (`/api/products`, `/top`, `/feature-flags`, `/config/paypal`).

### DB indexes / query shape (MEDIUM/LOW)
- **PERF-010 (MED)** No index on `Order.user`, `Product.rating`, or `Product.name` — full scans that worsen with growth.
- **PERF-011 (MED)** Product search uses unanchored `$regex /i` — cannot use a standard index; COLLSCAN per search. (ReDoS itself is mitigated by escaping per security-review; perf cost remains.)
- **PERF-012 (LOW)** `getProducts` runs `countDocuments` then `find` sequentially — run with `Promise.all`.

### Frontend bundle / render / assets (MEDIUM/LOW)
- **PERF-013 (MED)** No `React.lazy`/code-splitting — all 17 screens (incl. admin dashboards) in the entry bundle. **Est: +200-600ms LCP on 3G.**
- **PERF-014 (MED)** `react-paypal-button-v2` statically imported, ships globally — lazy-load the checkout route.
- **PERF-015 (LOW)** `OrderScreen` recomputes & mutates `order.itemsPrice` in render — memoize / derive in selector.
- **PERF-016 (LOW)** Product grid `<img>` has no width/height/`loading="lazy"`, serves unsized originals — CLS + LCP hit. Cross-ref security-review unbounded-upload finding (large image = worst-case LCP).

### Memory / unbounded growth (LOW)
- **PERF-017 (LOW)** Embedded `reviews` array grows unbounded in the product doc; rating re-reduced over all reviews per write. Consider separate collection + incremental average.

### N+1 (CLEAN)
- **PERF-018** No ORM-in-loop N+1. Mongoose `.populate` calls are batched; MCP dependency resolution reads from an already-loaded in-memory object.

---

## Total estimated impact (rough)

- **RAG `/search` p50:** -120 to -460ms achievable (pooled connection + embedding cache hit).
- **Feature-flag + list endpoints:** removes per-request event-loop blocks and unbounded payloads; latency becomes flat instead of linear in collection size.
- **Frontend LCP:** ~ -200 to -600ms on mobile/3G from code-splitting + image sizing/lazy-load.
- **Egress:** -60 to -80% JSON payload with compression.

## Cross-specialist collaboration (cross-referenced security-review.md)

- **PERF-007 / getUsers** overlaps security's data-exposure concern (password hashes shipped) — fixing pagination + `.select('-password')` resolves both.
- **PERF-011 / regex search** — security-review confirms the ReDoS is already mitigated by input escaping; the remaining issue is purely the unindexed COLLSCAN (perf).
- **PERF-016 / grid images** depends on the security-review unbounded-upload finding (`uploadRoutes.js` has no `limits.fileSize`); enforcing an upload cap bounds worst-case image weight and LCP.

## Status

- N+1 scan complete (clean)
- Blocking I/O scan complete (3 findings)
- Pagination / unbounded result-set scan complete (3 findings)
- Caching opportunities identified (3 findings)
- DB index / query-shape review complete (3 findings)
- Frontend bundle / render / asset review complete (4 findings)
- Memory / unbounded-growth review complete (1 finding)
- Cross-referenced security-review.md (3 overlaps)
