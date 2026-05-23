# Security Mate — Review Summary (Stage 3 DELTA)

**Reviewer:** security-mate (Opus 4.7, claude-opus-4-7[1m])
**Scope:** M3–M5 layer post-Stage2 — `mcp-features/index.js`, `mcp-rag/index.js`, `mcp-rag/ingest.js`, `backend/routes/autopilotRoutes.js`, `backend/routes/featureFlagRoutes.js`, `backend/utils/featureFlag.js`, `frontend/src/hooks/useFeatureEnabled.js`, `frontend/src/actions/featureFlagActions.js`, `frontend/src/reducers/featureFlagReducers.js`.
**Out of scope (Stage1 already covered):** `backend/controllers/`, `backend/models/`, generic frontend screens.
**Findings file:** `homework/M6/stage3-living-docs/security-findings.jsonl` (14 lines, 1 per finding).

## Severity breakdown

- **HIGH:** 1
- **MEDIUM:** 8
- **LOW:** 5

## Delta classification

- **NEW vs Stage1:** 9 findings (frontend FF layer, utils/featureFlag.js, MCP error leaks, MCP session-id prototype, MCP non-atomic write, RAG query length, RAG error leak, MCP audit log)
- **RESIDUAL after Stage2:** 5 findings — explicitly deferred by Stage2 fix docs

## Top concern (HIGH)

1. **mcp-features/index.js:302** — HTTP transport fail-open when `MCP_BEARER_TOKEN` empty. Stage2 fix-1 explicitly skipped this ("Other file. Fail-open still present."). Combined with Cloudflare tunnel exposure this is the single biggest unmitigated risk in the M3–M5 layer. (OWASP A05.)

## MEDIUM concerns (grouped)

**Three-writer features.json race remains open** — Stage2 fix-1 added regex + Object.hasOwn + 5s cache to the Express side, but did not extract a shared store. Concrete residuals:
- `mcp-features/index.js:27` writes non-atomically while Express writes atomically — partial-write window.
- `backend/utils/featureFlag.js:24` `invalidateCache` exported but never wired — stale auth-gating flags up to 5s after any writer touches the file.
- `backend/routes/featureFlagRoutes.js` cache is process-local — MCP writes do not invalidate Express cache.

**Traffic-bucket bypass is the new feature-flag attack surface**:
- `backend/utils/featureFlag.js:44` accepts `X-FF-Bucket` from client — attacker forces themselves into any Testing slice.
- `backend/utils/featureFlag.js:37` uses `Math.random()` per call when header missing — same user gets non-deterministic flag state across requests.
- `frontend/src/hooks/useFeatureEnabled.js:25` is fully bypassable via sessionStorage — must be documented as UI-only; every gated *action* needs server re-check.

**Information disclosure via verbose error paths**:
- `mcp-features/index.js:19` leaks `FEATURES_PATH`.
- `mcp-rag/index.js:68,87` leaks `QDRANT_URL` and raw upstream error.
- `backend/routes/autopilotRoutes.js:36` leaks `fetch` error message (potentially internal IPs).

**Other**:
- `mcp-features/index.js:303` bearer compared with `===` (timing-attack adjacent).
- `mcp-features/index.js:312` session ID used as raw object accessor — prototype-key DoS.
- `mcp-rag/index.js:34` unbounded query length → Cohere cost/DoS.
- `backend/routes/autopilotRoutes.js:21` no SSRF host allowlist on outbound URL (Stage2 fix-3 deferred).
- `mcp-features/index.js:160` no audit log on flag mutations.

## Cross-specialist collaboration

None contacted this pass. Three findings overlap **architecture-mate**'s domain (the multi-writer race on `features.json` and the missing shared store) and one overlaps **performance-mate** (sync fs in MCP HTTP mode blocks the event loop). All three are already documented as deferred work in `homework/M6/stage2-fix-top3/fix-1-feature-flag-store.md`; flagging here so they are tracked as **residual security debt**, not just architecture debt.

## Stage1 findings NOT re-flagged

Stage1 raised 25 issues across `backend/controllers/*` and middleware. Per scope, those are excluded from this delta pass. Two Stage1 HIGHs that were closed by Stage2:
- order endpoint hardening (fix-2)
- autopilot/upload/multer auth chain (fix-3)

Two Stage1 HIGHs explicitly **deferred** by Stage2 and re-surfaced here as residuals: MCP fail-open (HIGH-1 above) and SSRF host allowlist on autopilot (MED above).

## Status

- [x] OWASP A01–A10 scanned within scope
- [x] Hardcoded-secrets scan within scope (none — all secrets `process.env.*`)
- [x] No source files modified (read-only audit)
- [x] Dependency audit explicitly out of scope per caller instructions
