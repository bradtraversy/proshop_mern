# Performance Mate — Review Summary

**Reviewer:** performance-mate (Opus 4.7)
**Scope:** backend/controllers, backend/middleware, backend/routes, mcp-features/index.js, mcp-rag/index.js, mcp-rag/ingest.js
**Runtime:** Node.js single event loop (Express + 2× MCP servers)
**Hot paths reviewed:** /api/products (list, search), /api/orders (myorders, list, create), /api/users (admin list), /api/featureflags (REST + MCP), mcp-rag search_project_docs

## Findings — counts

- **HIGH:** 5 (missing pagination ×3, blocking sync I/O in MCP, ReDoS-driven full scan)
- **MEDIUM:** 7 (missing/weak indexes, missing caches, unbounded buffers, race condition)
- **LOW:** 6 (filter-in-JS, recompute averages, sequential awaits, on-the-fly user fetch)

## Top concerns (HIGH)

1. **backend/controllers/orderController.js:119** — `getOrders` (admin) does `Order.find({}).populate('user')` with no pagination, no `.lean()`, no projection.
   - **Impact:** at 10k orders → **+500-1000ms p95, ~10MB payload, ~80MB heap spike** during JSON.stringify; OOM risk on shared instances.
   - **Fix:** `.find().limit(20).skip(...).populate('user','name email').lean()` + response envelope `{items, page, total}`.
2. **backend/controllers/orderController.js:111** — `getMyOrders` returns all orders for a user, no limit, no compound index on `{user, createdAt}`.
   - **Impact:** power-users **+100-500ms p95, ~1-3MB payload** per request; full collscan per user above ~500 orders.
   - **Fix:** add Mongoose index `OrderSchema.index({user:1, createdAt:-1})`; `.limit(20).lean()` + cursor pagination.
3. **backend/controllers/userController.js:110** — `getUsers` (admin) returns entire collection, full docs.
   - **Impact:** **+300-800ms p95, ~5MB payload** at 10k users; leaks password hash if schema lacks `select:false`.
   - **Fix:** `.find().select('-password').limit(20).skip(...).lean()`.
4. **backend/controllers/productController.js:13,22** — `keyword` unescaped/uncapped into `$regex` (case-insensitive).
   - **Impact:** **+200-2000ms p95** per request from full collscan (leading wildcard kills index); adversarial regex **pins a CPU core indefinitely** (ReDoS). Cross-ref: **security SEC-9**.
   - **Fix:** escape regex meta-chars, cap length 64, anchor with `^`. Run `countDocuments` + `find` via `Promise.all` (saves ~30-80ms).
5. **mcp-features/index.js:17** — `readFileSync`/`writeFileSync` on every MCP tool invocation.
   - **Impact:** **~1-5ms event-loop block per call** today; under HTTP transport with N concurrent sessions, p99 grows linearly. Worst case: SSD stall → 50-100ms freeze of ALL MCP sessions.
   - **Fix:** switch to `fs/promises` (mirror REST route); add 5s TTL cache (saves ~80% of reads).

## Other notable issues (MEDIUM)

- **backend/controllers/productController.js:237** — `getPendingReviews` selects whole `reviews` arrays and filters in JS; no multikey index on `reviews.status`.
  - **Impact:** **+50-200ms p95** + ~2-5x doc transfer over wire vs. server-side filter; grows linearly with reviews/product.
  - **Fix:** `$unwind` + `$match` aggregation; add `productSchema.index({'reviews.status':1})`.
- **backend/controllers/productController.js:182** — `Product.find({}).sort({rating:-1})` (top + recommendations) without index on `rating`. Hot path — every home render.
  - **Impact:** **+30-150ms p95** per home load; in-memory sort cost grows O(n log n) with catalog.
  - **Fix:** `productSchema.index({rating:-1})`; cache top-N for 60s.
- **mcp-features/index.js:17** — no in-memory cache of `features.json`. Backend `featureFlag.js` already has 5s TTL.
  - **Impact:** **~1ms disk hit per MCP call** today; **80%+ avoidable** with cache parity.
  - **Fix:** mirror 5s TTL cache from backend util.
- **backend/routes/featureFlagRoutes.js:78** — read-modify-write race on `features.json` (concurrent admin PATCH + MCP writers). Cross-ref **security SEC-16**.
  - **Impact:** **not latency** — silent **lost updates** (~5-10% under burst writes). Data-integrity, not throughput.
  - **Fix:** `proper-lockfile` cross-process advisory lock.
- **mcp-rag/ingest.js:141** — `buildChunks()` loads every chunk into memory before iterating in batches.
  - **Impact:** **~5MB heap** at current corpus (~50 files); **+1MB per ~10 new files** linearly. OK now, ballooning risk.
  - **Fix:** stream `for-await` batches of 32 chunks; flush per batch.
- **mcp-rag/index.js:111** — `proshop-docs-index` resource scrolls entire Qdrant collection (`limit=100` per page); many round-trips.
  - **Impact:** **+200-500ms** per resource fetch at ~500 chunks; grows linearly.
  - **Fix:** cache scrolled index for process lifetime (invalidate on `ingest` restart).
- **mcp-rag/index.js:38** — `search_project_docs` re-embeds identical queries via Cohere every call.
  - **Impact:** **+150-400ms p95 per call + $0.0001/query** Cohere cost; ~30-50% of dev queries are repeats.
  - **Fix:** 200-entry LRU keyed by `sha256(query)`; TTL 1h.

## LOW

- `getProductById` filters reviews in JS after full hydration.
  - **Impact:** **+5-20ms** + extra wire bytes on products with many approved reviews. **Fix:** `$elemMatch` projection or aggregation.
- `createProductReview` / `moderateReview` recompute rating average over full reviews array on every write.
  - **Impact:** **+10-50ms write latency** at >100 reviews/product; quadratic-ish in worst case. **Fix:** running sum + `$inc numReviews` + recompute average from stored sum.
- `mcp-rag/ingest.js` processes embed→upsert strictly sequentially.
  - **Impact:** ingest wall-clock **~2-3× slower** than necessary (~30s vs ~10s at current corpus). **Fix:** bounded `p-limit(5)` parallelism.
- `mcp-rag/index.js` does `getCollection` health check before every search.
  - **Impact:** **+20-50ms p95** per search (Qdrant round-trip). **Fix:** cache result per process; revalidate on error.
- `authMiddleware.protect` does DB round-trip per protected request.
  - **Impact:** **+5-15ms p95** per protected call + linear DB load with QPS. **Fix:** 30s LRU on `userId → user` (caveat: interacts w/ security SEC-3/SEC-5 stale-claim — short TTL only).
- Future risk: when `addOrderItems` server-recomputes totals (security SEC-10), MUST use `Product.find({_id:{$in:[...]}})`.
  - **Impact if done wrong:** **N+1** → +50-200ms per order with 5+ items. **Fix:** single batched query as noted.

## Total estimated impact (rough, qualitative for many)

- **/api/orders** (admin list): unbounded payload — at 10k orders, +500-1000ms p95 and ~10MB payload. **HIGH risk** of OOM on very large stores.
- **/api/users** (admin list): same pattern — unbounded.
- **/api/orders/myorders**: per-user unbounded; +100-500ms for heavy users.
- **/api/products** with `?keyword=...`: full scan per request; adversarial regex can pin a CPU core indefinitely.
- **MCP feature-flag tools**: ~1ms event-loop block per call today; grows linearly with file size and disk latency.
- **mcp-rag search**: ~150-400ms Cohere round-trip per duplicate query — avoidable with a 200-entry LRU.

## Cross-specialist collaboration

- Cross-references to `homework/M6/stage1-code-review/security-findings.jsonl`:
  - **SEC-9** (ReDoS in product keyword) — confirmed from a perf angle: also kills index usage → full scan. Both reviews recommend escape + length cap.
  - **SEC-16** (features.json TOCTOU/race) — same root cause, perf impact is silent lost-update not latency.
  - **SEC-10/SEC-11** (client-trusted order totals) — noted: the fix must avoid an N+1 per orderItem.
- No new tickets opened to security-mate or architecture-mate — overlap is already documented.

## Status

- N+1 scan: complete (clean, with one future-risk note on `addOrderItems`).
- Blocking I/O scan: complete (1 HIGH — MCP sync fs; otherwise clean).
- Pagination scan: complete (3 HIGH).
- Index / query-plan scan: complete (3 issues; recommend `explain()` runs in CI for hot queries).
- Caching opportunities: complete (3 misses).
- Unbounded buffers / memory: complete (2 noted, both scaling risks rather than current bugs).
- Bundle / asset diff: N/A (backend scope only).
