# Performance Mate — Stage3 DELTA Review

**Reviewer:** performance-mate (Opus 4.7)
**Scope:** Stage3 delta — `mcp-features/index.js`, `mcp-rag/index.js`, `mcp-rag/ingest.js`, `backend/utils/featureFlag.js`, `backend/routes/featureFlagRoutes.js`, `backend/routes/autopilotRoutes.js`, `frontend/src/actions/featureFlagActions.js`, `frontend/src/hooks/useFeatureEnabled.js`.
**Out of scope:** backend controllers (Stage1), frontend screens/components, archived docs.
**Runtime:** Node 22 single event loop, Express 4, Mongoose 5, MongoDB 7, custom MCP servers (stdio + HTTP), Qdrant 1.14, Cohere API.

## Counts

- **HIGH:** 1 (residual blocking sync I/O in MCP)
- **MEDIUM:** 5 (cache coherence between two flag layers, no MCP read cache, no `proshop-docs-index` cache, no embed-query LRU, no keep-alive to n8n)
- **LOW:** 6 (thundering herd on flag cache, sequential ingest, full-collection-recreate on ingest, getCollection-per-search, render flash on flags load, hook lookup cost + sessionStorage in hot render path)

## DELTA vs Stage1

- **Residual after Stage2 (unfixed):** PERF-D1 (HIGH), PERF-D2, PERF-D5, PERF-D6, PERF-D7, PERF-D8. Stage2 focused on the three top-3 correctness findings; the perf-only items in Stage1 were left for Stage3.
- **NEW vs Stage1:**
  - PERF-D3 — cache-coherence gap between `backend/utils/featureFlag.js` and `backend/routes/featureFlagRoutes.js` (two caches in the same process, one invalidates, the other does not).
  - PERF-D4 — thundering-herd on cache miss in featureFlagRoutes.
  - PERF-D9 — `mcp-rag/ingest.js` full delete+recreate of collection (write amplification + Cohere cost on every ingest, even for 1-file edit).
  - PERF-D10 — `autopilotRoutes.js` opens fresh TCP+TLS per call; no connection reuse; no upstream-body size cap.
  - PERF-D11 — `loadFeatureFlags` causes a render flash; no `Cache-Control` header on `/api/featureflags`.
  - PERF-D12 — `useFeatureEnabled` does O(n) `flags.find` per consumer per Redux update + sync `sessionStorage` per render.

## Top concerns (HIGH)

1. **PERF-D1** — `mcp-features/index.js:8` — `readFileSync`/`writeFileSync` still on every tool call. Residual after Stage2. Under HTTP transport this freezes all concurrent MCP sessions on disk stall. Fix: `fs/promises` + 5s TTL cache (combine with PERF-D2 in one PR).

## Medium-impact themes

- **Two caches in one process, only one is invalidated** (PERF-D3): when admin PATCHes a flag, the route cache is cleared but `isFeatureEnabled` in controllers still serves stale flag for up to 5s. Cheapest fix: export and call `invalidateCache()` from PATCH after `rename()`.
- **MCP servers have no in-process caches** (PERF-D2, PERF-D5, PERF-D6): every MCP read goes to disk/Qdrant/Cohere even when the data has not changed within the process lifetime. Combined waste per agent session is ~200-500ms + Cohere $.
- **Network proxy without keep-alive** (PERF-D10): admin AutoPilot pays a fresh TLS handshake per click. Drop in a module-scoped undici Agent.

## Total estimated impact

- **MCP HTTP mode under concurrency**: today p99 spikes are ~5-10ms from sync fs + redundant parse; with a slow disk or 10 concurrent sessions this scales to 50-200ms tail.
- **Backend `/api/featureflags` UX flash on app mount**: ~50-200ms of OFF-branch render for gated UI; fixable cheaply with `Cache-Control` + start-state hydration.
- **Cohere embed waste**: ~30-50% of agent-session queries repeat → 5-10× 200ms saved by a 200-entry LRU.
- **`isFeatureEnabled` staleness window**: up to 5s of serving the old flag after an admin/MCP toggle — pure correctness, not latency.

## Cross-specialist collaboration

- **security-mate**: PERF-D10 (no response-size cap from n8n proxy) is also a self-DoS surface — if n8n is compromised/misconfigured and returns a huge body, backend buffers it via `await upstream.text()` before deciding. Worth a SEC ticket.
- **architecture-mate**: PERF-D3 (two-cache coherence) is a symptom of `features.json` being a shared mutable file with two cache owners in one process and a third writer (MCP) in another. Long-term fix is "feature flags belong in a real store"; short-term is invalidation hook.

## Status

- Blocking I/O scan (Stage3 scope): complete (1 HIGH residual).
- Caching opportunities (Stage3 scope): complete (5 MEDIUM/LOW).
- Connection pooling / keep-alive: complete (1 MEDIUM new).
- Frontend perf (feature-flag layer only): complete (2 LOW new).
- Ingest pipeline cost: complete (2 LOW residual + 1 NEW idempotency cost).

## Output files

- Findings: `homework/M6/stage3-living-docs/performance-findings.jsonl` (12 findings, JSONL).
- Summary: this file.
