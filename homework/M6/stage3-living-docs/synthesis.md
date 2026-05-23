# Stage3 Living Documentation — Synthesis

**Inputs:** `security-review.md` (14 findings), `performance-review.md` (12 findings), `architecture-review.md` (11 findings), 6 reverse-engineering specs (`specs/*.md`), 1 new ADR draft (`proposed-adrs/adr-008-mcp-features-dual-transport.md`).
**Total raw findings:** 37 → **deduplicated/cross-domain merged:** ~28 distinct issues.
**Reviewers:** security-mate, performance-mate, architecture-mate (all Opus 4.7).
**Date:** 2026-05-23.

**Не перезаписывает** `homework/M6/stage1-code-review/synthesis.md` (Stage1 baseline) — данный файл это **DELTA Stage3** поверх Stage1+Stage2.

---

## TL;DR

Stage2 закрыл топ-3 находки (feature-flag store, order endpoint, auth on integration routes), но **структурные изменения по ADR-006/007 НЕ применены**. Текущий Stage3 находит:

- **1 HIGH security residual** — MCP-features HTTP fail-open при пустом `MCP_BEARER_TOKEN` (cluster A, deferred Stage2).
- **2 HIGH architecture violations** — обе нарушают только что принятые ADR-007 invariants: MCP-features пишет `features.json` напрямую (#3), Express PATCH делает свой read/write вместо `utils/featureFlag.js` (#2).
- **1 HIGH performance residual** — sync `readFileSync`/`writeFileSync` в MCP блокирует event loop под HTTP-нагрузкой.

Все три HIGH — **одна и та же корневая проблема**: shared mutable `backend/features.json` с тремя разнообразными writer'ами без shared store module. ADR-007 это уже описывает; код не догоняет.

MEDIUM-кластеры: traffic-bucket bypass (client может форсить Testing flag), cache coherence (две кеш-карты в одном процессе), AutoPilot integration logic всё ещё в роутере, dual-transport MCP не задокументирован (предложен ADR-008).

---

## HIGH severity (3 cross-domain findings)

### Cluster Δ-A — Three-writer `features.json` (cross-domain: SEC + PERF + ARCH)

Единый root cause, найден всеми тремя mates под разными углами:

- **SEC-HIGH-1** — `mcp-features/index.js:302` HTTP transport fail-open при пустом `MCP_BEARER_TOKEN`. Combined с Cloudflare tunnel = публичный write-доступ к features.json. Stage2 fix-1 явно отложил это.
- **ARCH-DELTA-01 (HIGH)** — `mcp-features/index.js:27` MCP пишет `features.json` напрямую через `writeFileSync`. ADR-007 invariant #3 требует PATCH через REST API.
- **ARCH-DELTA-02 (HIGH)** — `backend/routes/featureFlagRoutes.js:47` владеет read/write/validate. ADR-007 invariant #2 требует прохода через `utils/featureFlag.js`.
- **PERF-D1 (HIGH residual)** — `mcp-features/index.js:8` `readFileSync`/`writeFileSync` на каждый tool call. Под HTTP заморозит все concurrent sessions.

**Рекомендация:** реализовать ADR-007 целиком за один PR — `getAllFlags()`/`updateFlag(key, patch)` в `utils/featureFlag.js` с atomic write + Zod schema. `featureFlagRoutes.js` — тонкий controller. `mcp-features` PATCHит REST. Это закроет 4 HIGH одним махом.

### Cluster Δ-B — AutoPilot integration layering (cross-domain ARCH + PERF + SEC)

- **ARCH-DELTA-04 (MED)** — integration logic всё ещё в `backend/routes/autopilotRoutes.js`; ADR-006 invariant #6 требует `backend/services/n8nClient.js`.
- **PERF-D10 (MED, NEW)** — fresh TCP+TLS на каждый клик; нет `Cache-Control`/keep-alive; нет cap на `upstream.text()`.
- **SEC-MED autopilot:21** — SSRF host allowlist на outbound URL отложен Stage2 fix-3.

**Рекомендация:** ~30-line extraction `n8nClient.js` с keep-alive agent + response-size cap (закроет SEC + PERF) + env-validate at startup. Один PR.

---

## MEDIUM severity

### Cluster Δ-C — Feature-flag drift & cache coherence

- **ARCH-DELTA-03 (MED)** + **PERF-D3 (MED, NEW)** — две in-process кеша (`utils/featureFlag.js` + `featureFlagRoutes.js`). PATCH invalidate'ит только route cache; `isFeatureEnabled()` в контроллерах продолжает отдавать stale до 5s.
- **ARCH-DELTA-10 (MED)** — feature-flag evaluation/transition logic дублирован 5 раз (frontend hook, Redux action, backend util, backend route, MCP tool). ADR-007 invariant #4 (shared schema) не реализован.

**Самый дешёвый шаг:** export `invalidateCache` из util, вызвать после `rename()` в PATCH-роуте.

### Cluster Δ-D — Traffic bucket bypass (SEC)

- **SEC-MED-2** — `utils/featureFlag.js:44` принимает `X-FF-Bucket` от клиента → attacker форсит включение Testing flag для себя.
- **SEC-MED-3** — `utils/featureFlag.js:37` `Math.random()` per request без header → non-deterministic state.
- **SEC-MED-4** — `frontend/src/hooks/useFeatureEnabled.js:25` sessionStorage bucket редактируется клиентом.

**Mitigation:** документировать `useFeatureEnabled` как UI-only; server-re-check gated actions; для security-sensitive flags игнорировать bucket header.

### Cluster Δ-E — MCP hardening misc

- **SEC-MED** — `mcp-features:303` bearer `===` → timing attack (use `crypto.timingSafeEqual`).
- **SEC-MED** — `mcp-features:312` session ID как raw object accessor → prototype-key DoS.
- **SEC-MED** — `mcp-features:160` no audit log на flag mutations.
- **ARCH-DELTA-05 (MED)** — dual-transport (stdio + HTTP) не задокументирован. **Драфт adr-008** готов в `proposed-adrs/`.
- **ARCH-DELTA-06 (MED)** — `mcp-features/index.js` god-file 365 LoC.

### Cluster Δ-F — MCP-RAG operational

- **PERF-D5 (MED)** — `proshop-docs-index` resource scrolls full collection каждый раз. Cache на process lifetime.
- **PERF-D6 (MED)** — no LRU на одинаковые Cohere queries (~30-50% repeats per session).
- **ARCH-DELTA-07 (MED)** — `mcp-rag/index.js:11` module-load side effects (dotenv, process.exit, client construction). Нет factory seam.
- **SEC-MED** — `mcp-rag/index.js:34` unbounded query length → Cohere cost amplifier.

### Cluster Δ-G — Info disclosure

- `mcp-features:19` leaks `FEATURES_PATH`.
- `mcp-rag:68,87` leaks `QDRANT_URL` + raw SDK errors.
- `autopilotRoutes:36` leaks fetch error (internal IPs).
- `errorMiddleware.js:7` default unsafe — stack trace утекает кроме production (Stage1 уже flagged, не пофикшен).

---

## LOW severity

- **PERF-D4** — thundering-herd на cache miss в featureFlagRoutes (no single-flight).
- **PERF-D7** — `mcp-rag/ingest.js` sequential embed batches (можно concurrent).
- **PERF-D8** — getCollection check per search (закешировать после первого hit).
- **PERF-D9** — full delete+recreate коллекции на каждый ingest (write amplification).
- **PERF-D11** — `loadFeatureFlags` render flash + no `Cache-Control`.
- **PERF-D12** — `useFeatureEnabled` O(n) find + sessionStorage в hot path.
- **ARCH-DELTA-08** — `COLLECTION/VECTOR_SIZE` дублированы в `mcp-rag/index.js` + `ingest.js` → silent dim-mismatch при model swap.
- **ARCH-DELTA-09** — `protect` + `optionalProtect` дублируют JWT verify (Stage1 ARCH-12 unchanged).
- **ARCH-DELTA-11** — `JSON.stringify` deep-equality в featureFlagReducers; ADR-002 hint на RTK-Query migration.

---

## Cross-domain map

| Symptom | Security finding | Performance finding | Architecture finding |
|---|---|---|---|
| Multi-writer features.json | SEC-HIGH-1, SEC-MED writes-race | PERF-D1, PERF-D3 | ARCH-DELTA-01, -02, -03 |
| Stale `isFeatureEnabled` after PATCH | — | PERF-D3 | ARCH-DELTA-03 |
| AutoPilot proxy | SSRF residual | PERF-D10 keep-alive + body cap | ARCH-DELTA-04 |
| Traffic bucket | SEC-MED-2..4 | PERF-D12 sessionStorage | ARCH-DELTA-10 (drift) |
| Dual-transport MCP | bearer fail-open | sync I/O | ARCH-DELTA-05 → ADR-008 |
| Info disclosure | SEC-MED ×4 | — | — |

---

## Top-N for immediate action (Stage4)

| # | Finding | Files | Effort | Closes |
|---|---|---|---|---|
| 1 | Реализовать ADR-007 (shared store module) | `backend/utils/featureFlag.js`, `backend/routes/featureFlagRoutes.js`, `mcp-features/index.js` | 1-2 дня | ARCH-DELTA-01, -02, -03; PERF-D1, -D2, -D3; SEC-HIGH-1 (если MCP перестанет писать файл — fail-open больше не критичен), -MED writes-race |
| 2 | Extract `backend/services/n8nClient.js` | `backend/routes/autopilotRoutes.js`, новый `backend/services/n8nClient.js` | 30 LoC | ARCH-DELTA-04; PERF-D10; SEC SSRF allowlist |
| 3 | Accept ADR-008 + add startup assertion на `MCP_BEARER_TOKEN` | `proposed-adrs/adr-008-*.md` → `project-data/adrs/`, `mcp-features/index.js` | 10 LoC | ARCH-DELTA-05; SEC-HIGH-1 (defense-in-depth) |
| 4 | Document traffic-bucket как UI-only + server re-check guidelines | `project-data/feature-flags-spec.md` + new section | docs | SEC-MED-2..4 (mitigation by policy) |
| 5 | Sanitize error payloads | `mcp-features`, `mcp-rag`, `autopilotRoutes`, `errorMiddleware` | 20 LoC | SEC-MED info disclosure ×4 |
| 6 | LRU кэш на Cohere queries + cache на `proshop-docs-index` resource | `mcp-rag/index.js` | 50 LoC | PERF-D5, -D6 |
| 7 | Extract `mcp-rag/config.js` | новый файл + 2 import updates | 10 LoC | ARCH-DELTA-08 |

---

## Stage1 → Stage3 traceability

| Stage1 finding | Status now |
|---|---|
| Cluster A (features.json multi-writer) | **Partially closed by Stage2 fix-1**; Express side hardened, MCP side untouched → Stage3 ARCH-DELTA-01, -02, -03; PERF-D1, -D3 |
| Cluster B (order endpoints) | **Closed Stage2 fix-2.** Не повторяется в Stage3. |
| Cluster C (unauth integration routes) | **Closed Stage2 fix-3.** SSRF + body cap residual → ARCH-DELTA-04, PERF-D10 |
| Cluster D (admin/auth) | Stage2 не трогал. Out of Stage3 scope (backend/controllers). |
| Cluster E (regex ReDoS) | Stage2 не трогал. Out of Stage3 scope. |
| Cluster F (unbounded lists) | Stage2 не трогал. Out of Stage3 scope. |
| MED: JWT 30-day, console.error log | Stage2 не трогал. Накладывается с Stage3 cluster Δ-G. |
| MED: errorMiddleware stack leak | Stage3 cluster Δ-G — повторно flagged. |
| ARCH-07 (admin 401 vs 403) | Не пофикшен. Repeated as edge case в `backend-middleware-spec.md`. |
| ARCH-08 (PUT vs POST/PATCH semantics) | Не пофикшен. Out of Stage3 scope. |
| ARCH-12 (`protect`/`optionalProtect` duplication) | Stage3 ARCH-DELTA-09 — confirmed unchanged. |
| ARCH-16 (feature-flag logic duplication) | Stage3 ARCH-DELTA-10 — extends с frontend layer. |

---

## ADR compliance matrix

| ADR | Compliance | Failing invariants |
|---|---|---|
| ADR-001 Mongo | ✅ unchanged | — |
| ADR-002 Redux | ✅ compliant; RTK-Query roadmap noted | — (ARCH-DELTA-11 hint) |
| ADR-003 JWT | accepted-debt | — |
| ADR-004 PayPal | out of scope | — |
| ADR-005 Bootstrap | out of scope | — |
| ADR-006 AutoPilot | **Partial** | #6 (extract n8nClient.js); #3 Zod schema; audit log |
| ADR-007 Feature-flag ownership | **NOT compliant** | #2, #3, #4, #6 |
| ADR-008 (proposed) MCP dual-transport | — | n/a — драфт |

---

## Reverse-engineering specs index

Все 6 specs покрывают M3-M5 surface area:

- `specs/backend-controllers-spec.md` — order/product/user controllers, включая Stage2 fixes.
- `specs/backend-middleware-spec.md` — protect/admin/optionalProtect + errorHandler.
- `specs/mcp-features-spec.md` — dual transport, 4 tools, resource, race-conditions.
- `specs/mcp-rag-spec.md` — chunker, ingest pipeline, search tool, resource.
- `specs/feature-flags-layer-spec.md` — end-to-end (frontend hook → Redux → backend util → storage).
- `specs/autopilot-integration-spec.md` — proxy logic + SSRF surface.

---

## Token usage footer

3 mates ran in parallel (background mode). Combined: 17+16+23 tool calls ≈ 192k tokens (~$3-4 на Opus 4.7). 6 specs writing serial — ~$1.5. Worth it: 37 distinct findings + 6 modular specs за ~10 минут wall clock.
