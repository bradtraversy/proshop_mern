# Architecture — M3-M5 Addendum

> Этот файл — addendum к `project-data/architecture.md`. Покрывает 4 слоя, добавленных в курсе M3-M5: MCP-features, MCP-RAG, Feature-flags layer, AutoPilot n8n integration. При промoute в основной architecture.md — стать секциями § 9-12.
>
> **TODO(audit-2026-05-23):** перед merge в `project-data/architecture.md` синхронизировать нумерацию (current section count = 8).

---

## § 9. MCP Features Server

**Расположение:** `mcp-features/index.js` (365 LoC, single file, dual transport).
**ADR:** adr-007 (storage + ownership), proposed adr-008 (dual-transport).

### Зачем

Экспонирует 4 MCP tools + 1 resource поверх `backend/features.json` для агентного управления feature flags из Claude Code / Cursor (stdio) и из n8n workflows (StreamableHTTP).

### Транспорты

- **stdio** — local Claude Code/Cursor через `.mcp.json`. Один процесс на сессию, без auth.
- **StreamableHTTP** — Docker сервис на порту 7777. Bearer-token auth через `MCP_BEARER_TOKEN`. Доступ из n8n через Cloudflare-туннель (ephemeral URL).

Оба режима шарят `createServer()` factory и пишут в один `features.json`.

### Tools

| Tool | Назначение |
|---|---|
| `get_feature_info(feature_id)` | Чтение одной фичи + map `dependencies_status`. |
| `set_feature_state(feature_id, state)` | Меняет status, авто-настраивает `traffic_percentage`, обновляет `last_modified`, возвращает warnings о неготовых dependencies. Read-modify-write. |
| `adjust_traffic_rollout(feature_id, percentage)` | Целое 0..100, только для `status==='Testing'`. Hint при 0/100. |
| `list_features()` | Полный каталог. |

Resource `feature-flags` — summary списка для discovery.

### Известные проблемы

- ADR-DELTA-01: пишет `features.json` напрямую через `writeFileSync` (не atomic) — нарушает ADR-007 invariant #3.
- SEC HIGH: HTTP transport fail-open при пустом `MCP_BEARER_TOKEN`.
- PERF HIGH: sync I/O в HTTP режиме блокирует event loop.

Детали — `homework/M6/stage3-living-docs/specs/mcp-features-spec.md`.

---

## § 10. MCP RAG Server

**Расположение:** `mcp-rag/index.js` (search) + `mcp-rag/ingest.js` (ingestion).
**Документация дизайна:** `project-data/mcp-rag-project-data.md`.

### Зачем

Семантический поиск по `project-data/**/*.md`. Tool `search_project_docs(query, top_k=5)` возвращает chunk-фрагменты с score, source_file, section, type, text. Используется Claude Code для контекстного ответа на вопросы по проекту.

### Pipeline

```
project-data/*.md
   ↓ walkMd (recursive)
   ↓ chunkFile (split по `## ` секциям, ≤512 tokens)
   ↓ inferType (по подпапке: adr/runbook/incident/feature/api/page/doc)
   ↓ Cohere embed-multilingual-v3.0 (search_document, 1024d)
   ↓ Qdrant upsert (collection: proshop_docs, Cosine)
```

`ingest.js` — однократный/идемпотентный (full delete+recreate коллекции).
`index.js` — stdio MCP-сервер. На каждый search: Cohere embed query → Qdrant search → top_k chunks.

### Reindex когда

- Изменились файлы в `project-data/`.
- Изменилась логика чанкера.
- Команда: `cd mcp-rag && node ingest.js`.

### Известные проблемы

- PERF: no LRU на Cohere queries (повторяющиеся вопросы платят $).
- PERF: `proshop-docs-index` resource scrolls full collection каждый раз.
- ARCH: module-load side effects (dotenv + process.exit + client construction at import time).
- ARCH: `COLLECTION`/`VECTOR_SIZE`/model name дублированы в `index.js` и `ingest.js`.

Детали — `homework/M6/stage3-living-docs/specs/mcp-rag-spec.md`.

---

## § 11. AutoPilot n8n Integration

**Расположение:** `backend/routes/autopilotRoutes.js`.
**ADR:** adr-006.

### Зачем

Серверный прокси к n8n webhook. Browser идёт на свой origin (`/api/autopilot/feature-control`), backend форвардит на `${N8N_WEBHOOK_URL}/feature-control` с `X-API-Key`. Цель — никогда не отдавать секрет в browser bundle.

### Flow

```
Browser (admin)
  ↓ POST /api/autopilot/feature-control (Bearer admin JWT)
Backend express
  ↓ protect + admin + express.json({limit:16kb})
  ↓ fetch(target, {timeout: 5s, headers: X-API-Key})
n8n workflow WF1
  ↓ optionally callback to mcp-features HTTP (через Cloudflare tunnel)
features.json
```

### Известные проблемы

- ARCH: integration logic в роутере (ADR-006 invariant #6 требует service layer).
- PERF: нет keep-alive — fresh TLS на каждый клик.
- SEC: no SSRF allowlist (admin с доступом к env может направить на internal IP).
- SEC: error message утечка host/IP в 502/504 responses.

Детали — `homework/M6/stage3-living-docs/specs/autopilot-integration-spec.md`.

---

## § 12. Feature-flags Layer (end-to-end)

**Компоненты:**

- Storage: `backend/features.json` (shared mutable JSON).
- Backend read API: `backend/routes/featureFlagRoutes.js` (GET + admin PATCH) + `backend/utils/featureFlag.js` (`isFeatureEnabled`).
- Frontend Redux: `frontend/src/actions/featureFlagActions.js` (loadFeatureFlags, updateFeatureFlag), `frontend/src/reducers/featureFlagReducers.js` (merge с pending optimistic state), `frontend/src/constants/featureFlagConstants.js`.
- Frontend hook: `frontend/src/hooks/useFeatureEnabled.js`.

### Контракт оценки flag

- `Enabled` → true.
- `Testing` & `traffic_percentage > 0` → true для admin или если `bucket < traffic_percentage`.
- `Disabled` → false.
- Missing flag → false.

Идентичный контракт реализован 5 раз (frontend hook, Redux action, backend util, backend route, MCP set_feature_state). Drift risk — ADR-007 invariant #4 (shared schema) not realized.

### Traffic bucket

- Frontend: persistent в `sessionStorage['ff_traffic_bucket']` (random при первом обращении).
- Backend: header `X-FF-Bucket` (0..1 от клиента) либо `Math.random()` fallback.
- **НЕ доверять для security gating** — клиент может выставить любое значение.

### Cache

- `backend/utils/featureFlag.js` — 5s in-memory TTL.
- `backend/routes/featureFlagRoutes.js` — отдельный 5s in-memory TTL.
- Два независимых кеша в одном процессе → PATCH invalidates только один → stale `isFeatureEnabled()` в контроллерах до 5s.

Детали — `homework/M6/stage3-living-docs/specs/feature-flags-layer-spec.md`.

---

## Cross-refs

- `project-data/architecture.md` (§ 1-8 core MERN).
- `project-data/adrs/adr-006-*.md`, `adr-007-*.md`.
- `homework/M6/stage3-living-docs/synthesis.md` (Stage3 findings).
- `homework/M6/stage1-code-review/synthesis.md` (Stage1 baseline).
