# Audit Plan — proshop_mern (M6 stage3 — Living Documentation)

**Output dir:** `homework/M6/stage3-living-docs/`
**Auditor:** `legacy-auditor-mate` (Opus 4.7)
**Plan date:** 2026-05-23
**Mode:** Plan → жду одобрения перед Phase 3.

---

## Context — зачем это нужно

Stage1 M6 выдал multi-mate code review (synthesis.md, 48 distinct findings) для M3-M5 модулей. Stage2 закрыл топ-3 находки (feature-flag store, order endpoint, auth+integration routes) с characterization-тестами. Stage3 — **living documentation pack**: задокументировать M3-M5 слои так, чтобы MCP-RAG индекс и будущие сессии могли отвечать о них корректно. `project-data/architecture.md` сейчас покрывает только core MERN; MCP-features, MCP-RAG, autopilot/n8n и feature-flags layer там отсутствуют. Цель Stage3 — закрыть этот гэп через 6 модульных specs + аккуратное обновление существующих docs + автоматизация поддержания project-index.

---

## Project shape (from Phase 1)

- **Type:** fullstack-monorepo.
- **Tech stack:** Node 22 ESM, Express 4, Mongoose 5, MongoDB 7, React 16.13 (CRA), Redux 4, MCP SDK 1.29, Qdrant 1.14, Cohere multilingual-v3, n8n webhook integration.
- **Subprojects (discovered):**
  - `backend/` — Express API (controllers/routes/middleware/utils/models/config).
  - `frontend/` — CRA + Redux.
  - `mcp-features/` — feature flags MCP server (stdio + StreamableHTTP).
  - `mcp-rag/` — semantic search MCP server поверх Qdrant + Cohere.
  - `project-data/` — RAG-индексированная документация (источник истины для семантического поиска).
- **Existing docs surface:** `project-data/` (50 файлов в 6 подпапках) + 5 top-level MD + `docs-archived-2026-05-23/` (read-only).
- **Tests surface:** `homework/M6/stage2-fix-top3/tests/` (3 characterization-теста). Других тестов в репо нет.
- **Legacy markers:** Bradtraversy upstream deprecated, react 16.13, react-scripts 3.4.3, mongoose 5, express-async-handler unmaintained (out-of-scope).

---

## Existing docs audit (from Phase 1.5)

Подробная таблица: `homework/M6/stage3-living-docs/docs-audit.md`.

- ✅ Keep as-is: **38 items** (включая все 7 ADR, все pages, большинство features/runbooks, CLAUDE/DESIGN/README, feature-flags-spec, mcp-design-principles, mcp-rag-project-data, best-practices, features-analysis-ru).
- 🔄 Update + keep (TODO markers): **6 items** — `architecture.md`, `glossary.md`, `api/orders.md`, `api/uploads.md`, `api/products.md`, `runbooks/deploy.md`.
- 📦 Archive (historical, do not move): **7 items** — `dev-history.md`, 3× incidents, `FINDINGS.md`, `indexation-and-onboarding.md`, existing `docs-archived-2026-05-23/`.
- ❌ Missing (нужно создать в Phase 4): **2 items** — `api/featureflags.md`, `api/autopilot.md`.
- ❌ Stale to discard: **0 items**.

---

## Audit scope (confirmed)

**In scope (M3-M5 модули):**
- `backend/controllers/` — `orderController.js`, `productController.js`, `userController.js`.
- `backend/middleware/` — `authMiddleware.js`, `errorMiddleware.js`.
- `backend/routes/` — `autopilotRoutes.js`, `featureFlagRoutes.js`, `orderRoutes.js`, `productRoutes.js`, `uploadRoutes.js`, `userRoutes.js`.
- `backend/utils/` — `featureFlag.js`, `generateToken.js`.
- `mcp-features/` — `index.js` (stdio + HTTP transport).
- `mcp-rag/` — `index.js`, `ingest.js`.
- **Feature-flags layer (frontend):** `frontend/src/hooks/useFeatureEnabled.js`, `frontend/src/reducers/featureFlagReducers.js`, `frontend/src/actions/featureFlagActions.js`.

**Out of scope:**
- `frontend/src/screens/`, `components/` (кроме feature-flag слоя).
- `backend/models/`, `backend/data/`, `backend/seeder.js` — описаны в существующем `architecture.md` § 5-6.
- `docs-archived-2026-05-23/` — read-only.
- ADR-001..007 — не переписываем, только ссылаемся.
- Stage1/Stage2 артефакты — read-only.

---

## Phase 3 — DISPATCH (Execute mode после approval)

### 3.1 — security-mate (re-scope под M3-M5 layers)
- [ ] Task tool dispatch.
- Scope: `mcp-features/index.js`, `mcp-rag/index.js`, `mcp-rag/ingest.js`, `backend/routes/autopilotRoutes.js`, `backend/utils/featureFlag.js`, `frontend/src/hooks/useFeatureEnabled.js`.
- Output: `homework/M6/stage3-living-docs/security-review.md` + `security-findings.jsonl`.
- **Note:** Stage1 уже покрыл backend. Здесь — *delta*: M3-M5 specifics (MCP transport auth, RAG injection surface, n8n proxy SSRF, traffic-bucket bypass).
- Constraint: 6-12 новых findings (не дублировать Stage1).

### 3.2 — performance-mate (re-scope под M3-M5)
- [ ] Task tool dispatch.
- Scope: тот же.
- Output: `performance-review.md` + `performance-findings.jsonl`.
- Focus: ingestion-time blocking I/O, embedding round-trips, MCP cold-start, feature-flag cache invalidation.

### 3.3 — architecture-mate (re-scope под M3-M5)
- [ ] Task tool dispatch + read ADR-001..007 first.
- Scope: тот же.
- Output: `architecture-review.md` + `architecture-findings.jsonl` + `proposed-adrs/` (если найдут).
- Focus: контракт между Express ↔ MCP-features (single owner для features.json уже adr-007 — проверить compliance), границы mcp-rag ingest vs query, integration boundaries.

### 3.4 — Reverse engineering (auditor, serial)
Для каждого из 6 модулей — 4-шаговый pass (UNDERSTAND → DECISION TABLE → SEQUENCE DIAGRAM → EDGE CASES) → `specs/<module>-spec.md`.

- [ ] `specs/backend-controllers-spec.md` (orderController, productController, userController, плюс Stage2 fixes baked in).
- [ ] `specs/backend-middleware-spec.md` (`protect`, `optionalProtect`, `admin`, errorMiddleware).
- [ ] `specs/mcp-features-spec.md` (dual transport stdio/HTTP, atomic write, бизнес-логика статусов).
- [ ] `specs/mcp-rag-spec.md` (chunker, embedding pipeline, Qdrant collection lifecycle, search tool).
- [ ] `specs/feature-flags-layer-spec.md` (frontend hook + Redux action/reducer + backend `featureFlag.js` + traffic bucket).
- [ ] `specs/autopilot-integration-spec.md` (`autopilotRoutes.js` → n8n webhook; security boundary).

---

## Phase 4 — AGGREGATE (Execute mode)

- [ ] **4.1 — Synthesis.** Прочитать 3 review-файла + 6 specs → собрать `homework/M6/stage3-living-docs/synthesis.md`. **НЕ перезаписывать** `homework/M6/stage1-code-review/synthesis.md`. Cross-link на Stage1 для context, отметить новые vs дублирующиеся находки.
- [ ] **4.2 — Build `docs-new/`** под `homework/M6/stage3-living-docs/docs-new/`. Зеркалит структуру `project-data/`:
  - Copy ✅ items as-is.
  - Copy 🔄 items + inline TODO markers.
  - Add `api/featureflags.md` + `api/autopilot.md` (новые).
  - Add секции в `architecture.md`: § 9 «MCP Features Server», § 10 «MCP RAG Server», § 11 «AutoPilot n8n Integration», § 12 «Feature Flags Layer».
  - Add `specs/` reference в `architecture.md` или в новом `architecture/README.md`.
- [ ] **4.3 — `project-index.json`** в корне репо (machine-readable map). Schema из legacy-auditor шаблона + поля под текущий репо (subprojects, MCP servers, RAG index path, ADR index).
- [ ] **4.4 — НЕ делать automatic swap.** Предложить пользователю команду:
  ```bash
  git mv project-data project-data-archived-2026-05-23
  git mv homework/M6/stage3-living-docs/docs-new project-data
  cd mcp-rag && node ingest.js   # reindex Qdrant под новый project-data
  ```
  Пользователь решает: оставить как hybrid (project-data сохраняется, docs-new — дельта) либо делать swap.

---

## Phase 5 — AUTOMATE

- [ ] **5.1 — Сгенерировать `.claude/hooks/update_project_index.py`** (минимальная Python-версия под текущий project-data + 4 subprojects). WATCH_PATHS = `backend/`, `frontend/src/`, `mcp-features/`, `mcp-rag/`, `project-data/`.
- [ ] **5.2 — Smoke test:** `python3 .claude/hooks/update_project_index.py` локально (Execute mode).
- [ ] **5.3 — Hook config:** добавить опциональный `PostToolUse` hook в `.claude/settings.json` (Write|Edit matcher) — *предложить, не активировать без согласия пользователя.* Hook noisy на каждый Write — пользователь может предпочесть запуск вручную после commits.
- [ ] **5.4 — Обновить `CLAUDE.md`:** добавить раздел «Living docs hook» с тремя пунктами:
  - START HERE — `project-index.json` first.
  - Keeping project-index.json current — `python3 .claude/hooks/update_project_index.py` after structural changes.
  - Reindex MCP-RAG — `cd mcp-rag && node ingest.js` after `project-data/` changes.
  AGENTS.md в репо нет — всё в CLAUDE.md.

---

## Time estimate

- Phase 3 (dispatch + reverse engineering): ~40-60 min (3 mates параллельно + 6 specs последовательно).
- Phase 4 (aggregate + docs-new + project-index): ~30-40 min.
- Phase 5 (hook + CLAUDE.md update): ~15-20 min.

---

## User decisions (locked in)

1. **Docs swap:** Hybrid. `project-data/` сохраняется как RAG source of truth. Все новые материалы (specs, новые api docs, обновлённый architecture.md draft) — в `homework/M6/stage3-living-docs/docs-new/` параллельно. Никакого `git mv` Phase 4 не делает.
2. **PostToolUse hook:** активировать автоматически. В Phase 5 добавляю PostToolUse matcher Write|Edit в `.claude/settings.local.json` (НЕ в `settings.json` — local-вариант не коммитится по умолчанию; hook ребилдит project-index.json после каждой записи).
3. **Новые ADR:** разрешено adr-008+ при необходимости. Architecture-mate выявит — оформляю в `project-data/adrs/` сохраняя нумерацию. Если решение спорное — сначала draft в `homework/M6/stage3-living-docs/proposed-adrs/`, promote после согласования.

---

## Constraints reminder

- Stage1/Stage2 артефакты read-only.
- `project-data/adrs/` нумерация сохраняется.
- `docs-archived-2026-05-23/` не трогать.
- Новые .md под `homework/M6/stage3-living-docs/` — на русском (код/пути/идентификаторы в оригинале).
- Match style of `project-data/adrs/`.
- Plan-mode write только в `00-plan.md` и `docs-audit.md`.
