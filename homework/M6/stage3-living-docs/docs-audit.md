# Existing docs audit — proshop_mern (M6 stage3)

> Заполнен `legacy-auditor-mate` в Phase 1.5. Цель — НЕ выкинуть валидную документацию.
> Каждый файл/папка из `project-data/` и каждый top-level doc получает свой verdict.

**Auditor:** `legacy-auditor-mate` (Opus 4.7)
**Audit date:** 2026-05-23
**Repo:** proshop_mern fork — MERN e-commerce + custom MCP/RAG/feature-flags/autopilot слои.
**Existing docs scanned:** 8 top-level MD + 8 `project-data/*.md` + 6 подпапок project-data (adrs/, api/, features/, incidents/, pages/, runbooks/) = ~50 .md файлов.

---

## Verdict legend

| Symbol | Verdict | Action in Phase 4 |
|---|---|---|
| ✅ | **ACCURATE** — matches code, well-maintained | Copy as-is to `docs-new/` |
| 🔄 | **PARTIALLY ACCURATE** — mostly right, has stale sections / missing M3-M5 layers | Copy + `TODO(audit-2026-05-23): <что>` markers |
| 📦 | **HISTORICAL** — старое, но ценное (dev-history, post-mortems, артефакты курса) | НЕ перемещать; оставить в `project-data/` либо `docs-archived-2026-05-23/`; ссылаться из new arch overview |
| ❌ | **STALE / REDUNDANT** — outdated and superseded | Архивировать (never `rm`), игнорировать |

---

## Inventory

### Top-level MD

| Path | Type | Verdict | Reasoning | Action |
|---|---|---|---|---|
| `CLAUDE.md` | file (16.5 KB) | ✅ ACCURATE | Источник истины для всего проекта; обновлён 2026-05-16; описывает MCP-features (stdio/HTTP), MCP-RAG, autopilot, features.json, dev gotchas. Совпадает с кодом. | Не трогать; обновить только разделом «Living docs hook» в Phase 5. |
| `DESIGN.md` | file (39.7 KB) | ✅ ACCURATE | Design system spec (M4), anti-AI-slop guards; всё ещё актуален для frontend. | Не трогать. |
| `README.md` | file (19.3 KB) | ✅ ACCURATE | Свежий (2026-05-16), описывает quickstart с MCP-серверами, RAG, feature flags, autopilot. | Не трогать. |
| `FINDINGS.md` | file (2.3 KB) | 📦 HISTORICAL | Раннее M0/M1 findings table; пункты 1-2 fixed, 3-5 «not yet» но затёрты Stage1/Stage2 синтезом. Сохранить как историю. | Архивировать (move в `docs-archived-2026-05-23/` опционально) либо оставить в корне с пометкой. |
| `indexation-and-onboarding.md` | file (7.3 KB) | 📦 HISTORICAL | Это **промт** для генерации C4-диаграмм (артефакт M4), а не онбординг-док. Имя обманчиво. | Архивировать либо переместить в `homework/M4/prompts/`. |
| `prompt.md` | untracked | — | Текущий conversation prompt, не часть docs. | Игнорировать (в .gitignore не нужен — пользовательский). |

### project-data — top-level .md

| Path | Type | Verdict | Reasoning | Action |
|---|---|---|---|---|
| `project-data/architecture.md` | 746 lines | 🔄 PARTIALLY ACCURATE | Покрывает core MERN корректно (sections 1-8), но **полностью отсутствуют** разделы про MCP-features, MCP-RAG, autopilot/n8n, feature-flags layer. Это M3-M5 модули, которые сейчас в scope. | Сохранить + TODO marker; добавить новые секции из `specs/` в Phase 4. |
| `project-data/best-practices.md` | 806 lines | ✅ ACCURATE | Generic engineering guidance 2026 для MERN — переживёт изменения кода. | Сохранить как есть. |
| `project-data/dev-history.md` | 293 lines | 📦 HISTORICAL | Хроника проекта Jan 2023 → Apr 2026; институциональный контекст, незаменим. | Сохранить как есть, ссылаться из new architecture overview. |
| `project-data/feature-flags-spec.md` | 751 lines | ✅ ACCURATE | Authoritative spec для features.json + MCP-features. Соответствует коду и ADR-007. | Сохранить как есть. |
| `project-data/features-analysis-ru.md` | 182 lines | ✅ ACCURATE | Карта 25 фичей и навигация M3→M7. Стабильный курсовой артефакт. | Сохранить как есть. |
| `project-data/glossary.md` | 427 lines | 🔄 PARTIALLY ACCURATE | Покрывает domain/tech термины; вероятно отсутствуют термины MCP/RAG/Qdrant/autopilot/feature flag traffic bucket. | Сохранить + TODO для добавления M3-M5 терминов. |
| `project-data/mcp-design-principles.md` | 547 lines | ✅ ACCURATE | Generic principles для MCP-серверов, 2026; не привязан к конкретному коду. | Сохранить как есть. |
| `project-data/mcp-rag-project-data.md` | 188 lines | ✅ ACCURATE | Design spec MCP-RAG сервера; соответствует `mcp-rag/index.js` + `ingest.js`. | Сохранить как есть. |

### project-data/adrs/ — 7 файлов

| Path | Type | Verdict | Reasoning | Action |
|---|---|---|---|---|
| `adrs/adr-001-mongodb-vs-postgres.md` | 66 lines | ✅ ACCURATE | Решение зафиксировано; в коде Mongoose. | Сохранить. |
| `adrs/adr-002-redux-vs-context.md` | 99 lines | ✅ ACCURATE | Redux в коде. | Сохранить. |
| `adrs/adr-003-jwt-vs-session.md` | 88 lines | ✅ ACCURATE | JWT в `generateToken.js`. | Сохранить. |
| `adrs/adr-004-paypal-vs-stripe.md` | 99 lines | ✅ ACCURATE | PayPal в коде. | Сохранить. |
| `adrs/adr-005-bootstrap-vs-tailwind.md` | 109 lines | ✅ ACCURATE | Bootstrap 4 в коде. | Сохранить. |
| `adrs/adr-006-n8n-autopilot-integration.md` | 93 lines | ✅ ACCURATE | Создан в Stage1 M6; соответствует `autopilotRoutes.js`. | Сохранить. |
| `adrs/adr-007-feature-flag-storage-and-ownership.md` | 114 lines | ✅ ACCURATE | Создан в Stage1 M6; описывает текущую схему features.json + MCP ownership. | Сохранить. |

### project-data/api/ — 5 файлов

| Path | Type | Verdict | Reasoning | Action |
|---|---|---|---|---|
| `api/auth.md` | 193 lines | ✅ ACCURATE | Endpoints `/api/users/login`, `/register` соответствуют `userController.js`. | Сохранить. |
| `api/orders.md` | 422 lines | 🔄 PARTIALLY ACCURATE | Описание `/api/orders` корректно по сигнатуре, но: семантика `getOrderById` без ownership-check (Stage2 fix-2), `updateOrderToPaid` теперь recomputes prices — нужны TODO markers. | Сохранить + TODO для отражения Stage2 fixes. |
| `api/products.md` | 367 lines | ✅ ACCURATE | Соответствует `productController.js`. | Сохранить (TODO опционально для search regex escape после fix). |
| `api/uploads.md` | 286 lines | 🔄 PARTIALLY ACCURATE | Stage2 fix-3 добавил `protect` + `admin` на `POST /api/upload`; нужно отразить. | Сохранить + TODO. |
| `api/users.md` | 217 lines | ✅ ACCURATE | Endpoints соответствуют. | Сохранить. |
| **MISSING:** `api/featureflags.md` | — | ❌ — отсутствует | Endpoints `/api/featureflags` и `PATCH /api/featureflags/:key` существуют в коде, но не описаны. | Создать в Phase 4 на базе `featureFlagRoutes.js` + ADR-007. |
| **MISSING:** `api/autopilot.md` | — | ❌ — отсутствует | `POST /api/autopilot/feature-control` существует, не описан. | Создать в Phase 4 на базе `autopilotRoutes.js` + ADR-006. |

### project-data/features/ — 6 файлов

| Path | Type | Verdict | Reasoning | Action |
|---|---|---|---|---|
| `features/admin.md` | 425 lines | ✅ ACCURATE | Admin surface описан корректно. | Сохранить. |
| `features/auth.md` | 269 lines | ✅ ACCURATE | Совпадает с `userController.js`. | Сохранить. |
| `features/cart.md` | 197 lines | ✅ ACCURATE | localStorage + Redux cart — без изменений. | Сохранить. |
| `features/catalog.md` | 283 lines | ✅ ACCURATE | Каталог/поиск/пагинация. | Сохранить. |
| `features/checkout.md` | 271 lines | ✅ ACCURATE | Multi-step checkout сохранён. | Сохранить. |
| `features/payments.md` | 239 lines | ✅ ACCURATE | PayPal интеграция. | Сохранить. |

### project-data/incidents/ — 3 файла

| Path | Type | Verdict | Reasoning | Action |
|---|---|---|---|---|
| `incidents/i-001-paypal-double-charge.md` | 119 lines | 📦 HISTORICAL | Пост-мортем; ценен для `runbooks/incident-response.md`. | Сохранить как есть, ссылаться из runbooks. |
| `incidents/i-002-mongo-connection-pool-exhaustion.md` | 142 lines | 📦 HISTORICAL | Пост-мортем. | Сохранить. |
| `incidents/i-003-jwt-secret-leak.md` | 146 lines | 📦 HISTORICAL | Пост-мортем. | Сохранить. |

### project-data/pages/ — 16 файлов

| Path | Type | Verdict | Reasoning | Action |
|---|---|---|---|---|
| `pages/INDEX.md` + 15 экран-файлов | 16 файлов | ✅ ACCURATE | Покрывают все текущие экраны `frontend/src/screens/`. | Сохранить как есть. |

### project-data/runbooks/ — 6 файлов

| Path | Type | Verdict | Reasoning | Action |
|---|---|---|---|---|
| `runbooks/ab-test-setup.md` | 372 lines | ✅ ACCURATE | A/B через `useFeatureEnabled`. | Сохранить. |
| `runbooks/db-seed-and-reset.md` | 429 lines | ✅ ACCURATE | `npm run data:import/destroy` без изменений. | Сохранить. |
| `runbooks/deploy.md` | 294 lines | 🔄 PARTIALLY ACCURATE | Базовый deploy актуален, но docker-compose для MCP/tunnel мог измениться. | Сохранить + light TODO. |
| `runbooks/feature-flag-toggle.md` | 384 lines | ✅ ACCURATE | Совпадает с MCP-features + frontend AutoPilot UI. | Сохранить. |
| `runbooks/incident-response.md` | 445 lines | ✅ ACCURATE | Процедуры реакции, ссылается на `incidents/`. | Сохранить. |
| `runbooks/local-setup.md` | 222 lines | ✅ ACCURATE | Соответствует `CLAUDE.md` Commands. | Сохранить. |

### docs-archived-2026-05-23/ — НЕ ТРОГАТЬ

| Path | Verdict | Action |
|---|---|---|
| `docs-archived-2026-05-23/architecture.md` | 📦 HISTORICAL | Ранее существовавший `docs/`; уже архивирован в Stage1. Не перезаписывать, не разархивировать. |
| `docs-archived-2026-05-23/docker_mongo.sh` | 📦 HISTORICAL | Helper-скрипт, перенесён в CLAUDE.md. |
| `docs-archived-2026-05-23/rag/` | 📦 HISTORICAL | Старая `docs/rag/`. |

---

## Summary

- ✅ ACCURATE: **38 items** (большинство `project-data/*`, все ADR, все pages, большинство features/runbooks, top-level CLAUDE/DESIGN/README).
- 🔄 PARTIALLY ACCURATE: **6 items** (`architecture.md`, `glossary.md`, `api/orders.md`, `api/uploads.md`, `runbooks/deploy.md` + неявно `api/products.md`).
- 📦 HISTORICAL: **7 items** (`dev-history.md`, все 3 incidents, FINDINGS.md, indexation-and-onboarding.md, существующий `docs-archived-2026-05-23/`).
- ❌ MISSING (нужно создать): **2 items** (`api/featureflags.md`, `api/autopilot.md`).
- ❌ STALE: **0 items**. Wholesale-архивирования не требуется.

**Total reviewed:** ~50 файлов.

---

## Cross-references to preserve

Чтобы НЕ потерять при swap:

- `project-data/adrs/` — нумерация adr-001..007 НЕ перезапускать. Новые ADR (если появятся в Phase 3) — adr-008+.
- `project-data/dev-history.md` → ссылаться из нового `architecture/README.md` (если будет swap docs-new → project-data).
- `project-data/incidents/` ↔ `project-data/runbooks/incident-response.md` — двусторонняя связка, не разрывать.
- `project-data/feature-flags-spec.md` — authoritative source для нового `api/featureflags.md`; новый файл должен ссылаться, не дублировать.
- `project-data/mcp-rag-project-data.md` — authoritative source для нового модуля spec `mcp-rag-spec.md`.
- `CLAUDE.md` секция «Feature Flags MCP Server», «RAG MCP Server», «AutoPilot proxy» — соответствует ADR-006/007; не дублировать в новых spec'ах, только ссылаться.
- `docs-archived-2026-05-23/` — read-only, не трогать.
- `homework/M6/stage1-code-review/synthesis.md` и `stage2-fix-top3/*` — НЕ перезаписывать, они служат источником для нового `synthesis.md` Stage3.

---

## Notes for Phase 2 planning

- **Не делать blanket swap project-data → docs-new.** Достаточно дополнить project-data новыми файлами (`api/featureflags.md`, `api/autopilot.md`, новые секции в `architecture.md`) + добавить `specs/<module>-spec.md` в `homework/M6/stage3-living-docs/specs/` для M3-M5 модулей. Это сохраняет RAG-индекс.
- **Если пользователь хочет полноценный swap** — построить `docs-new/` параллельно, и предложить atomic команду (`git mv project-data project-data-archived-2026-05-23 && git mv docs-new project-data`). Решение пользователь принимает после Phase 4.
- **MCP-RAG индекс должен быть переиндексирован** после любых изменений в `project-data/` (`cd mcp-rag && node ingest.js`). Включить шаг в Phase 4 verification.
- **architecture.md гэп — главный приоритет** Phase 3: М3 (MCP-features), M4 (frontend feature-flags layer + AutoPilot UI), M5 (n8n autopilot) полностью отсутствуют в архитектурном overview.
- **Specs модули (Phase 3.4):** `backend-controllers`, `backend-middleware`, `mcp-features`, `mcp-rag`, `feature-flags-layer`, `autopilot-integration` — 6 specs.
