# Architecture Mate — Stage 3 Delta Review

**Reviewer:** architecture-mate (Opus 4.7, 1M context)
**Date:** 2026-05-23
**Scope (delta):** `mcp-features/index.js`, `mcp-rag/index.js`, `mcp-rag/ingest.js`, `backend/routes/autopilotRoutes.js`, `backend/routes/featureFlagRoutes.js`, `backend/utils/featureFlag.js`, `backend/middleware/authMiddleware.js`, `frontend/src/hooks/useFeatureEnabled.js`, `frontend/src/actions/featureFlagActions.js`, `frontend/src/reducers/featureFlagReducers.js`
**ADRs loaded:** 7 (adr-001 .. adr-007, including the Stage1-drafted adr-006/007)
**Stage1 findings cross-referenced:** ARCH-01..ARCH-18 from `homework/M6/stage1-code-review/architecture-review.md`
**Total findings:** 11 (2 HIGH / C1, 6 MEDIUM / C2, 3 LOW / C3)

---

## Executive summary

This delta confirms that **Stage2 fixes addressed the symptoms** of the top-3 findings (auth on integration routes, ordered shipping endpoint, fix-1 feature-flag-store hardening) but **did not yet land the structural moves** that ADR-006 and ADR-007 mandate. The two HIGH findings here are both ADR violations:

- **ARCH-DELTA-01 (HIGH).** `mcp-features/index.js` still writes `backend/features.json` directly. ADR-007 invariant #3 requires the MCP server to PATCH the REST API instead. The three-writer race remains.
- **ARCH-DELTA-02 (HIGH).** `backend/routes/featureFlagRoutes.js` still does its own read/write/validate against `features.json` and keeps a second TTL cache parallel to `backend/utils/featureFlag.js`. ADR-007 invariant #2 names this exact layout as the target; we're not there yet.

These are not new problems — they are Stage1 problems that the just-accepted ADRs have promoted from "unwritten architectural smell" to "tracked ADR violation". This is the correct trajectory: the decisions are now reviewable invariants instead of unwritten lore.

The medium findings cluster around three follow-ups:

1. **AutoPilot integration logic still lives in the router** (ARCH-DELTA-04). Stage2 added `protect, admin` and a 5s timeout but did not extract `backend/services/n8nClient.js`. ADR-006 invariant #6 makes this the next step.
2. **Dual-transport MCP is undocumented** (ARCH-DELTA-05). The choice to run stdio + StreamableHTTP from one binary is a real decision with auth/session trade-offs and no ADR. Drafted as **ADR-008** (`proposed-adrs/adr-008-mcp-features-dual-transport.md`).
3. **Feature-flag evaluation logic drift across 5 implementations** (ARCH-DELTA-10). Frontend hook, Redux optimistic update, backend util, backend route PATCH, MCP set_feature_state — each independently encodes "Enabled→100, Disabled→0, Testing→keep 1..99 or fallback 10". ADR-007 invariant #4 mandates a shared schema; not yet implemented.

Lows are hygiene: duplicate JWT verify (ARCH-DELTA-09, confirmed unchanged), shared RAG config constants (ARCH-DELTA-08), reducer stringify-equality flagging the RTK-Query migration opportunity from ADR-002 (ARCH-DELTA-11).

---

## Findings by severity

### HIGH / C1 — ADR violations (2)

| ID | File | Issue | ADR |
|---|---|---|---|
| **ARCH-DELTA-01** | `mcp-features/index.js:27` | MCP writes `features.json` directly; ADR-007 says it must PATCH the REST API. | ADR-007 invariant #3 |
| **ARCH-DELTA-02** | `backend/routes/featureFlagRoutes.js:47` | Route owns read/write/validate; ADR-007 says it must go through `utils/featureFlag.js`. Duplicate in-process cache. | ADR-007 invariant #2 |

### MEDIUM / C2 (6)

| ID | File | Issue |
|---|---|---|
| **ARCH-DELTA-03** | `backend/utils/featureFlag.js:9` | Duplicate cache vs `featureFlagRoutes.js`; invalidation only fires in one. Up-to-5s stale reads for backend `isFeatureEnabled()` callers after a PATCH. |
| **ARCH-DELTA-04** | `backend/routes/autopilotRoutes.js:12` | Integration logic still in router; ADR-006 invariant #6 mandates `backend/services/n8nClient.js`. |
| **ARCH-DELTA-05** | `mcp-features/index.js:363` | Dual-transport selection (stdio + http) is an undocumented architectural decision. **Drafted as ADR-008.** |
| **ARCH-DELTA-06** | `mcp-features/index.js:293` | God-file: 365 LoC mixing tool registration, stdio, Express, Bearer middleware, session pool. |
| **ARCH-DELTA-07** | `mcp-rag/index.js:11` | Module-load side effects (dotenv, process.exit, client construction). No factory seam comparable to `buildChunks()` in ingest.js. |
| **ARCH-DELTA-10** | `frontend/src/hooks/useFeatureEnabled.js:20` | Feature-flag evaluation/transition logic implemented 5 times across frontend hook, Redux action, backend util, backend route, MCP tool. Drift risk; ADR-007 invariant #4 (shared schema) not yet realised. |

### LOW / C3 (3)

| ID | File | Issue |
|---|---|---|
| **ARCH-DELTA-08** | `mcp-rag/ingest.js:141` | `COLLECTION`, `VECTOR_SIZE`, embedding model name duplicated across `ingest.js` and `index.js`. Model swap → silent dim mismatch risk. |
| **ARCH-DELTA-09** | `backend/middleware/authMiddleware.js:47` | `protect` and `optionalProtect` duplicate JWT verify + `User.findById`; policy drift already visible (null-user handling). |
| **ARCH-DELTA-11** | `frontend/src/reducers/featureFlagReducers.js:29` | `JSON.stringify` deep-equality on every `FEATURE_FLAGS_SUCCESS`. Pattern hint: ADR-002 'Current Assessment' RTK-Query migration would handle this natively. |

---

## ADR compliance matrix (delta)

| ADR | Status | Notes |
|---|---|---|
| **ADR-001** Mongo | Unchanged. Out of delta scope. |
| **ADR-002** Redux/RTK | Compliant; `featureFlagReducers.js` follows the classic-thunk pattern documented as the v1.x baseline. RTK Query migration noted in ARCH-DELTA-11 as the long-term destination per ADR-002 itself. |
| **ADR-003** JWT | Unchanged; debt items accepted by ADR remain. ARCH-DELTA-09 is hygiene, not ADR-violating. |
| **ADR-004** PayPal | Out of delta scope. |
| **ADR-005** Bootstrap | Out of delta scope. |
| **ADR-006** AutoPilot proxy | **Partially compliant.** Stage2 added `protect`, `admin`, 16kb body cap, 5s timeout (invariants #1, #2, #4) — good. Invariant #6 (extract `n8nClient.js`) NOT done — ARCH-DELTA-04. Invariants #3 (Zod schema) and the audit-log open issue remain open per ADR-006 itself. |
| **ADR-007** Feature-flag ownership | **Not compliant.** Invariant #1 (backend-owned canonical state) holds; #2 (single write path in process) violated by `featureFlagRoutes.js` doing its own I/O (ARCH-DELTA-02); #3 (single write path across processes) violated by `mcp-features` direct writes (ARCH-DELTA-01); #4 (shared Zod schema) not implemented (ARCH-DELTA-10); #6 (cache invalidation) partially broken by duplicate caches (ARCH-DELTA-03). |

---

## Proposed ADRs

- **`proposed-adrs/adr-008-mcp-features-dual-transport.md`** — record the dual-transport (stdio + StreamableHTTP) decision for `mcp-features`. Captures: shared `createServer()` factory, transport-specific auth surfaces (none for stdio, Bearer for HTTP), session-pool semantics, foot-gun of empty-token-disables-auth in HTTP mode, alternatives considered (two binaries, HTTP-only, stdio + tunnel-wrapper).

No amendments to existing ADRs proposed. ARCH-DELTA-01..04 are tracked as **violations of ADR-006/007**, not requests to amend those ADRs — the ADRs are correct, the code hasn't caught up.

---

## Cross-references to Stage1

| Stage3 finding | Stage1 link | What changed |
|---|---|---|
| ARCH-DELTA-01 | Follow-up to ARCH-02 | ADR-007 now exists; same code, now an ADR violation. |
| ARCH-DELTA-02 | Follow-up to ARCH-01 / ARCH-06 | Same. |
| ARCH-DELTA-03 | New | Duplicate-cache bug not specifically called out in Stage1. |
| ARCH-DELTA-04 | Follow-up to ARCH-05 | Stage2 fixed auth (SEC-7) but not the layering. ADR-006 invariant #6 now binds. |
| ARCH-DELTA-05 | New | Dual-transport not flagged in Stage1. |
| ARCH-DELTA-06 | New | God-file shape of `mcp-features/index.js` not measured in Stage1. |
| ARCH-DELTA-07 | Follow-up to ARCH-15 | Confirmed still present; recommendation now concrete (buildChunks precedent). |
| ARCH-DELTA-08 | New | RAG ingest/search constant duplication not separated from ARCH-15. |
| ARCH-DELTA-09 | Follow-up to ARCH-12 | Confirmed unchanged after Stage2. |
| ARCH-DELTA-10 | Extends ARCH-16 | Adds frontend hook and Redux optimistic update as drift sites. |
| ARCH-DELTA-11 | New | Frontend out of Stage1 scope; reducer-level smell now logged with RTK-Query migration hook to ADR-002. |

---

## Recommendations (prioritised)

1. **Realise ADR-007.** Land `getAllFlags()`/`updateFlag(key, patch)` in `backend/utils/featureFlag.js` with the atomic write + Zod schema. Make `featureFlagRoutes.js` a thin controller. Make `mcp-features` PATCH the REST API. Closes ARCH-DELTA-01, -02, -03, partially -10. One commit, biggest architectural win in the repo right now.
2. **Realise ADR-006 invariant #6.** Extract `backend/services/n8nClient.js`. ~30 lines. Closes ARCH-DELTA-04 and pre-builds the seam for the structured audit log open in ADR-006.
3. **Accept and merge ADR-008.** Decision is already implemented; ADR just records it. While merging, add the startup assertion for `MCP_BEARER_TOKEN` in HTTP mode (Open Issues in the ADR).
4. **Split `mcp-features/index.js`.** Once ADR-007 lands and the writer is gone, this file shrinks; the remaining HTTP/stdio split should follow ARCH-DELTA-06.
5. **Extract `mcp-rag/config.js`.** Tiny change, closes ARCH-DELTA-08 and prevents a silent embedding-dim mismatch the day someone bumps the model.
6. **Defer ARCH-DELTA-09 and ARCH-DELTA-11** until ADR-003 refresh-token work and ADR-002 RTK-Query migration land respectively — both are noted as v3.0 in their ADRs.

---

## Status

- [x] All 7 ADRs cross-referenced against the delta scope
- [x] Stage1 findings cross-referenced (new vs follow-up labels on every finding)
- [x] Layer boundaries scanned across M3 (MCP), M4 (feature flags), M5 (AutoPilot)
- [x] API contract integrity checked (no new public-API regressions found)
- [x] Anti-patterns scanned (god-file, duplicate cache, module-load side effects, drift)
- [x] One new ADR proposed (ADR-008 dual-transport)
- [x] No source files modified
