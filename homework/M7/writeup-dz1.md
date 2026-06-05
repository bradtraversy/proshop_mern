# Разбор ДЗ-1 (M7)

Документ собирает, что именно было сделано в рамках первого задания M7, по
данным 4-x последних коммитов ветки `m7-task`. Архитектура, выбор стека и
команды запуска — в соседних файлах: [README.md](./README.md),
[0-deploy.md](./0-deploy.md), [router/architecture.md](./router/architecture.md).

## Коммиты (от старого к новому)

| Хеш | Сабжект |
|-----|---------|
| `1be249c` | COURSE: [M7] LiteLLM PII-router gateway + Presidio analyzer |
| `ee72391` | COURSE: [M7] Chat assistant — tool-calling, intent routing, per-route history isolation, ChatLog audit |
| `92487cc` | COURSE: [M7] AI Router Dashboard — admin-only ChatLog viewer |

## 1. `1be249c` — PII-router gateway + Presidio

Базовый слой: подняли LiteLLM-прокси и Presidio Analyzer; внутри LiteLLM
повесили custom callback (`pii_router.py`), который перехватывает запросы с
алиасом `model: smart-router` и переписывает на физический бэкенд по
результату детекции PII.

Что появилось в коммите:
- `litellm/Dockerfile` — образ на базе `ghcr.io/berriai/litellm:main-stable` + Presidio dependencies для совместимости импорта в callback;
- `litellm/config.yaml` — `qwen-local` (Ollama, `ollama_chat/qwen3:8b-q8_0`), `claude-haiku` (Anthropic), `callbacks: pii_router.pii_router_instance`;
- `litellm/pii_router.py` — pre-call hook: `_extract_text` → POST `presidio-analyzer:3000/analyze` → `_decide(spans, non_latin)` → `data["model"] = chosen`; post-call hook штампует `response.model` физическим именем;
- `docker-compose.yml` — добавлены сервисы `presidio-analyzer` (порт 5010 → 3000) и `litellm` (порт 4000) с healthcheck и `depends_on`;
- `.env.example` — `ANTHROPIC_API_KEY`, `MCP_BEARER_TOKEN`, `N8N_*`.

Особенности логики (детали в [router/architecture.md](./router/architecture.md)):
- белый список `SENSITIVE_ENTITIES` отфильтровывает шумные категории;
- защита от ложных PERSON на non-Latin: PERSON принимается только при `score ≥ PII_PERSON_NON_LATIN_MIN_SCORE` (0.95) — иначе кириллица постоянно ловится как «персональные данные»;
- три исхода: high-score PII → `qwen-local`; spans нет → `claude-haiku`; неопределённость → `qwen-local` (fail-safe).

Локальная модель и пример вызова из консоли — см. [0-deploy.md](./0-deploy.md).

## 2. `ee72391` — chat assistant с tool-calling + intent routing + audit

Поверх роутера собрали полную pipeline ассистента. Главные модули:

- **`backend/services/intentClassifier.js`** — qwen-local LLM-классификатор `personal | public`. Есть short-text fast-path и настраиваемый timeout (`CLASSIFIER_TIMEOUT_MS`, `CLASSIFIER_SHORT_BYPASS`). При ошибке/таймауте — fail-safe в `personal`.
- **`backend/services/toolRegistry.js`** — три инструмента: `getProducts` (public), `getMyOrders` / `getMyProfile` (personal). `userId` пробрасывается **сервером** из JWT в `ctx`; клиент не может передать его как аргумент.
- **`backend/services/toolLoop.js`** — LiteLLM tool-calling loop, `MAX_ITER=5`, `temperature=0`. Перед каждым tool-call: `JSON.parse(args)` → `stripForbiddenArgs` (выкидывает `userId`/`user`/`_id`) → whitelist by name → handler с инжектом `userId` из ctx.
- **`backend/routes/assistantRoutes.js`** — orchestrator: `protect` → `classifyIntent` → route-aware tool exposure → tool loop → `ChatLog.create(...)`.
- **`backend/models/chatLogModel.js`** — meta-поля (route, model, toolsUsed, latencyMs, costUsd, iterations, status, errorCode) + content-поля (message, reply, payloadMessages), которые пишутся только при `CHAT_LOG_CONTENT !== '0'`.
- **L2.5 history isolation** — widget тегирует каждый item в `history[]` полем `intentRoute`. На backend, если текущий запрос идёт `public`, отбрасываются все `personal`/без-тега items. Закрывает канал утечки персональной истории в облако.
- **`frontend/src/components/ChatWidget.js`** — виджет в правом нижнем углу: minimal XSS-safe markdown renderer (bold/italic/code/lists/headings, React-элементы, без innerHTML), бейдж модели + chips для tools used, propagation route в history items.
- **`litellm/pii_router.py`** — `PII_LOG_CONTENT=0` по умолчанию (не сливаем PII в stdout).

5-слойная защита (подробности в [README.md](./README.md)): L1 JWT → L2 intent → L2.5 history isolation → L3 tool exposure → L4 args sanitize + server-side userId → L5 LiteLLM Presidio.

## 3. `92487cc` — AI Router Dashboard (админка)

Этот коммит — отдельная подзадача: дать админу обзор того, что ассистент делает в проде.

Backend:
- `GET /api/assistant/logs` — добавили в `backend/routes/assistantRoutes.js`. Middleware `protect` + `admin`, поэтому не-админ получает 401 ещё до выборки;
- читает последние N записей `ChatLog` (limit ≤500, default 200), populates user (`name`, `email`);
- derives `modelRoute` ('local' | 'cloud') из имени модели: `qwen*` / `*local*` / `ollama*` → local, остальное → cloud;
- считает сводку: total, local, cloud, totalCostUsd, estimatedSavingsUsd (mean cloud cost × количество local вызовов);
- для local-строк cost обнуляется на API-слое — нельзя случайно показать ненулевую стоимость.

Frontend:
- `frontend/src/screens/AIRouterDashboardScreen.js` — новый screen. 5 карточек сверху (Total / Local / Cloud / Spent / Est. savings) + таблица (время, юзер, сообщение, PII, route, модель, ответ, латентность, $). Local-строки тонированы зелёным, cloud — синим;
- ячейки message и reply используют `-webkit-line-clamp: 3` плюс inline-кнопку **Show more / Collapse** — таблица не «прыгает», но текст можно прочитать полностью;
- per-row кнопка действия открывает модалку `FullTextModal` с полным сообщением + полным ответом + бейджами (route / model / latency / cost / PII / tools). Esc и клик по бэкдропу закрывают;
- `App.js` — добавлен route `/admin/ai-router`; `Header.js` — пункт `AI Router` в Admin-меню.

Скриншоты — в [demo/](./demo/).

## Чек-лист «готово»

- Локальная модель развёрнута и доступна (см. [0-deploy.md](./0-deploy.md)).
- PII-роутер маршрутизирует между qwen-local и claude-haiku, fail-safe в локалку.
- Виджет в UI, server-side tool execution с userId-инжектом, ChatLog audit.
- Админка `/admin/ai-router` показывает каждое сообщение, маршрут, модель, латентность, стоимость; не-админу — 401.
- Все секреты только на сервере (Anthropic key, LiteLLM master key, MCP bearer); браузер их не видит.
