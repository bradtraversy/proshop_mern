# M5 Homework — n8n Agentic Workflows

> **Статус:** реализованы WF1 (Manual trigger) и WF2 (Scheduled monitor).

---

## Архитектура

WF1 принимает команды управления feature flags через webhook (n8n.cloud). Браузер не ходит в n8n напрямую — Express-backend проксирует запрос, скрывая секреты и обходя CORS. n8n AI Agent вызывает MCP-инструменты (`mcp-features`) через Cloudflare Tunnel, читает и пишет в `backend/features.json`. M4 Dashboard отображает актуальное состояние флагов; AutoPilot-панель на странице Feature Flags запускает WF1 одной кнопкой из UI.

WF2 крутится по расписанию (Schedule Trigger, 1 минута), читает `logs.json` через второй Cloudflare Tunnel, считает `error_rate` за окно 60s, дергает MCP `get_feature_info` и в Switch-ноде детерминированно решает `deactivate / reenable / noop`. Алгоритм (порог + текущий статус) считается **до** AI Agent — модель только исполняет уже принятое решение и шлёт алерт в Telegram. Это «Algorithm-before-AI»: guards снаружи модели, чтобы LLM не могла зациклить toggle или проигнорировать threshold.

```
Browser (AutoPilotControls.js)
  │  POST /api/autopilot/feature-control
  ▼
Express backend  ←── N8N_WEBHOOK_URL, N8N_API_KEY из .env
  │  POST https://eefimenko.app.n8n.cloud/webhook/feature-control
  │  Header: X-API-Key: <secret>
  ▼
n8n WF1: Webhook → Switch (валидация) → AI Agent (Claude Sonnet 4.6)
  │  MCP tools: get_feature_info / set_feature_state / adjust_traffic_rollout
  ▼
mcp-features (Docker, SSE) ←── Cloudflare Tunnel (публичный HTTPS)
  │  read / write
  ▼
backend/features.json
```

---

## Стек

| Компонент | Выбор | Обоснование |
|-----------|-------|-------------|
| n8n | cloud (`eefimenko.app.n8n.cloud`) | zero-infra, встроенная очередь, UI для отладки |
| Chat Model | **Claude Sonnet 4.6** | интеграция с M3 MCP через Anthropic, структурированный output |
| Storage WF1 | нет (stateless webhook) | WF1 — разовые команды, history не нужна |
| Storage WF2 | `homework/M5/logs.json` (плоский JSON) | для домашки достаточно; cron stateless, нет нужды в Postgres/Redis Stream |
| MCP tunnel | Cloudflare quick tunnel | n8n.cloud не может достучаться до localhost; quick tunnel = 0 конфигурации |
| Logs tunnel (WF2) | Cloudflare quick tunnel + `python -m http.server` | n8n.cloud читает `logs.json` через публичный HTTPS, контейнер `logs-server` отдаёт read-only |
| Auth | X-API-Key (webhook) + Bearer Token (MCP) | секреты только на сервере, не в браузерном bundle |
| Telegram | Bot API через нативную n8n-ноду | штатный канал алертов, chat_id в credentials n8n |

---

## WF1 — Manual trigger

**Webhook URL:** `https://eefimenko.app.n8n.cloud/webhook/feature-control`  
**Auth:** `X-API-Key` (значение хранится в `.env` как `N8N_API_KEY`; ключ не публикуется)

### Что нового в Dashboard (M4)

- Страница **Feature Flags** (`/admin/featureflags`) — под гридом флагов появилась **AutoPilot панель** (компонент `AutoPilotControls.js`)
- Три кнопки: **Run check** (только чтение), **Testing mode** (→ `Testing`), **Rollback feature** (→ `Disabled`)
- После ответа n8n панель показывает `message` из ответа и обновляет состояние флага в UI без перезагрузки страницы

### Контракт

```http
POST /api/autopilot/feature-control
Content-Type: application/json

{ "feature_id": "search_v2", "action": "check" | "test" | "rollback" | "rollout", "target_state"?: "Testing" | "Disabled", "traffic_percentage"?: 0..100 }
```

```json
{ "success": true, "message": "...", "current_state": { "id": "...", "name": "...", "status": "Testing", "traffic_percentage": 50, "last_modified": "..." } }
```

### Файлы

| Файл | Роль |
|------|------|
| `backend/routes/autopilotRoutes.js` | Express-прокси → n8n, инжектит `X-API-Key` |
| `backend/server.js` | монтирует `/api/autopilot` |
| `frontend/src/components/AutoPilotControls.js` | AutoPilot панель с 3 кнопками |
| `frontend/src/screens/FeatureFlagsScreen.js` | селект флага + рендер AutoPilot |
| `homework/M5/wf1-manual-trigger.json` | экспорт n8n workflow (импортировать в n8n) |

---

## WF2 — Scheduled monitor

**Trigger:** `n8n-nodes-base.scheduleTrigger`, интервал **1 минута** (НЕ cron-нода).
**Threshold deactivate:** `error_rate > 5%`
**Threshold re-enable:** `error_rate < 1%`
**Logs storage:** `homework/M5/logs.json` (раздаётся через `logs-server` контейнер + Cloudflare Tunnel)
**Sine period симулятора:** `120s` для смок-прогона (`smoke`), `300s` для `demo`/`full`
**Telegram chat:** chat_id хранится в Telegram credential n8n (handle и chat_id публикую отдельно)

### Pipeline (одна ветка)

```
Schedule Trigger (1 min)
  → GET Logs (HTTP, Cloudflare tunnel → logs-server:8080/logs.json)
  → Read & Analyze Logs (Code: error_rate за окно 60s)
  → Init MCP (HTTP POST /mcp initialize)
  → Get Feature Status (HTTP POST /mcp tools/call get_feature_info)
  → Merge Responses (Code: объединить error_rate + current_status в один $json)
  → Switch (rules mode, 3 выхода):
      ├─ deactivate  (error_rate>0.05 && status!=Disabled) → Set "decision=deactivate" → AI Agent → Telegram
      ├─ reenable    (error_rate<0.01 && status==Disabled) → Set "decision=reenable"   → AI Agent → Telegram
      └─ fallback    (else) → NoOp (тупик, Telegram молчит)
```

Ключевые места:
- **Merge Responses** (Code-нода) стоит **между HTTP Request и Switch** — без неё Switch не видит сразу `error_rate` и `current_status` в одном `$json`.
- **Switch.fallbackOutput = "extra"** → третий выход. Подключён к ноде `No Operation, do nothing` (тип `n8n-nodes-base.noOp`), а не «обрыв в воздухе».
- **AI Agent** получает `decision` из payload и **не пересчитывает** порог. В system prompt прописано: если статус уже соответствует целевому — вернуть `action_taken="no_op"`, **не** вызывая `set_feature_state` (защита от спама).
- **Memory-ноды нет** — cron stateless, память между запусками бесполезна и только тратит токены.
- **Telegram-нода подключена только к `AI Agent.main`**, не к NoOp. При `decision=noop` алерт не отправляется (NoOp — leaf).

### Алгоритм-before-AI

Решение `deactivate / reenable / noop` принимается **детерминированно в Switch-ноде** (boolean-выражения на `error_rate` и `current_status`). LLM никогда не решает, выключать ли фичу — она только исполняет уже принятое решение через MCP и формирует текст алерта. Это исключает класс багов «модель проигнорировала threshold».

### Файлы

| Файл | Роль |
|------|------|
| `homework/M5/wf2-scheduled-monitor.json` | экспорт n8n workflow |
| `homework/M5/simulate_wf2.py` | генератор `logs.json` с sine-волной `error_rate` |
| `homework/M5/run_simulate_wf2.sh` | пресеты запуска симулятора |
| `homework/M5/logs.json` | пример лог-файла (success/error микс) |
| `docker-compose.yml` | сервисы `logs-server` (Python http.server) + `logs-tunnel` (cloudflared) |

---

## Защита от галлюцинаций

Защита стоит на **двух уровнях**:

1. **Switch-нода (n8n)** — детерминированная, без LLM. Отклоняет запрос с HTTP 400 если:
   - `feature_id` пустой
   - `action` пустой
   - `action` не из `["check","test","rollback","rollout"]`
   - `traffic_percentage` задан и выходит за `[0, 100]`

2. **Structured Output Parser (JSON Schema)** — принудительно валидирует ответ агента перед возвратом клиенту. Схема:
   ```json
   { "success": bool, "message": string, "current_state": object|null, "rejected_at": string|null }
   ```
   Поле `status` в `current_state` ограничено enum `["Enabled","Disabled","Testing"]`.

Агент также получает в системном промпте явный запрет: `traffic_percentage` вне `[0,100]` → возврат ошибки без вызова инструментов.

**В WF2** галлюцинационных рисков меньше (нет пользовательского input), но та же двухслойка применена:

1. **Switch-нода (детерминированно)** считает `decision` по boolean-выражениям на `error_rate` и `current_status`. LLM не может «решить» выключить фичу при `error_rate=1%` — Switch отправит запрос на NoOp-ветку, AI Agent даже не запустится.
2. **Structured Output Parser** WF2 валидирует ответ агента по JSON Schema: `action_taken` ∈ `["deactivated","reenabled","no_op","error"]`, `alert_message: string`, `error_rate_percent: number`. Произвольный текст не пройдёт.

Плюс system prompt AI Agent в WF2 требует **повторного** `get_feature_info` после `set_feature_state` (верификация), и явно запрещает `set_feature_state` если текущий статус уже целевой — защита от спама-toggle при гонке между Switch и Agent.

---

## MCP-сервис для n8n (Cloudflare Tunnel)

n8n.cloud не может достучаться до `localhost`. Решение — поднять `mcp-features` в Docker и опубликовать через cloudflared.

```bash
# Запустить mcp-features + tunnel
docker compose up -d mcp-features mcp-tunnel

# Найти публичный URL (новый при каждом перезапуске!)
docker compose logs mcp-tunnel | grep trycloudflare.com
```

В n8n → Credentials → MCP Client Tool:
- **SSE Endpoint:** `https://<random>.trycloudflare.com/mcp`
- **Authentication:** Bearer Token (`MCP_BEARER_TOKEN` из `.env`)

> URL эфемерный — меняется при каждом `docker compose restart mcp-tunnel`. После смены URL нужно обновить credentials в n8n вручную.

---

## Logs-сервис для n8n (WF2)

WF2 читает `logs.json` HTTP-запросом, поэтому файл нужно отдать в публичный HTTPS. В `docker-compose.yml` добавлены два сервиса:

```yaml
logs-server:    # python:3.12-alpine — отдаёт ./homework/M5/logs.json:ro на :8080
logs-tunnel:    # cloudflare/cloudflared — public URL → logs-server:8080
```

```bash
docker compose up -d logs-server logs-tunnel
docker compose logs logs-tunnel | grep trycloudflare.com
```

URL вставить в WF2 → нода **GET Logs** (поле `url`). URL эфемерный, после рестарта обновлять.

---

## Как запустить

### 1. Предварительные условия

```bash
# .env в корне репозитория — добавить строки:
N8N_WEBHOOK_URL=https://eefimenko.app.n8n.cloud/webhook
N8N_API_KEY=<твой X-API-Key>
MCP_BEARER_TOKEN=<твой Bearer Token для mcp-features>
```

### 2. Импорт workflow в n8n

1. Открыть n8n → **Workflows → Import from file**
2. Выбрать `homework/M5/wf1-manual-trigger.json` (и `wf2-scheduled-monitor.json`)
3. Создать credentials: **Header Auth** (`X-API-Key`), **Bearer Token** (для MCP Client), **Telegram API** (для WF2)
4. В нодах **MCP Client** / **Init MCP** / **Get Feature Status** обновить URL на актуальный Cloudflare MCP tunnel
5. В ноде **GET Logs** (WF2) обновить URL на актуальный Cloudflare logs tunnel
6. Активировать оба workflow (переключатель в правом верхнем углу)

### 3. Запуск MCP-туннеля и logs-туннеля

```bash
docker compose up -d mcp-features mcp-tunnel logs-server logs-tunnel
docker compose logs -f mcp-tunnel    # ждать строку trycloudflare.com — для MCP
docker compose logs -f logs-tunnel   # ждать строку trycloudflare.com — для WF2
```

### 4. Запуск приложения

```bash
npm run dev
# Открыть http://localhost:3000/admin/featureflags
# Выбрать флаг → AutoPilot панель → нажать кнопку
```

---

## Симулятор WF1 (`simulate_wf1.py`)

Скрипт циклически шлёт запросы в webhook с ротацией команд и sine-волной `traffic_percentage`.

### Быстрый старт (через shell-враппер)

Враппер читает `N8N_WEBHOOK_URL` и `N8N_API_KEY` из `.env` автоматически.

```bash
cd homework/M5
chmod +x run_simulate_wf1.sh

# Smoke — 30s, каждые 5s (убедиться что webhook живой)
./run_simulate_wf1.sh smoke

# Demo — 120s, каждые 10s (для screencast)
./run_simulate_wf1.sh demo

# Stress — 10 параллельных запросов одновременно
./run_simulate_wf1.sh stress

# Hallucination test — каждый 3-й запрос traffic_percentage=-50 (должен быть отклонён)
./run_simulate_wf1.sh hallucination

# Другой флаг:
FEATURE_ID=dark_mode ./run_simulate_wf1.sh demo

# Другое количество бёрстов:
BURST=20 ./run_simulate_wf1.sh stress
```

### Прямой вызов Python (ручные параметры)

```bash
# Установить зависимость (если не установлена)
pip install requests

# Базовый запуск
python3 simulate_wf1.py \
  --webhook-url https://eefimenko.app.n8n.cloud/webhook/feature-control \
  --api-key $N8N_API_KEY \
  --duration 120 \
  --interval 10

# Тест галлюцинаций (каждый 3-й запрос невалидный)
python3 simulate_wf1.py \
  --webhook-url https://eefimenko.app.n8n.cloud/webhook/feature-control \
  --api-key $N8N_API_KEY \
  --include-invalid \
  --invalid-every 3 \
  --duration 60

# Burst — 15 параллельных запросов, потом выход
python3 simulate_wf1.py \
  --webhook-url https://eefimenko.app.n8n.cloud/webhook/feature-control \
  --api-key $N8N_API_KEY \
  --burst 15

# Другой флаг, другой интервал
python3 simulate_wf1.py \
  --webhook-url https://eefimenko.app.n8n.cloud/webhook/feature-control \
  --api-key $N8N_API_KEY \
  --feature-id dark_mode \
  --duration 300 \
  --interval 15
```

### Аргументы симулятора

| Аргумент | По умолчанию | Описание |
|----------|-------------|----------|
| `--webhook-url` | обязательный | Полный URL `/feature-control` endpoint |
| `--api-key` | `$N8N_API_KEY` | Значение заголовка `X-API-Key` |
| `--feature-id` | `search_v2` | `feature_id` в теле запроса |
| `--duration` | `120` | Время работы в секундах |
| `--interval` | `10` | Пауза между запросами в секундах |
| `--include-invalid` | выключен | Включить тест-запросы с `traffic_percentage=-50` |
| `--invalid-every` | `3` | Каждый N-й запрос делать невалидным |
| `--burst` | `0` | N параллельных запросов, потом выход (отменяет loop-режим) |

### Ожидаемый вывод (hallucination test)

```
[2026-05-16T22:34:10] action=check payload={'feature_id': 'search_v2', 'action': 'check'}
  → status=200 success=True message=Фича search_v2 в статусе Testing, traffic=50%
[2026-05-16T22:34:20] action=test payload={'feature_id': 'search_v2', 'action': 'test', 'target_state': 'Testing'}
  → status=200 success=True message=Флаг переведён в Testing
[2026-05-16T22:34:30] [INVALID test] payload={'feature_id': 'search_v2', 'action': 'rollout', 'traffic_percentage': -50}
  → status=400 success=False message=Validation error
```

Невалидный запрос отклоняется на Switch-ноде с `400` — агент не вызывается.

---

## Симулятор WF2 (`simulate_wf2.py`)

Генератор событий `success`/`error` в `logs.json` с `error_rate` по синусоиде. WF2 видит переход через threshold туда и обратно → фича auto-toggle'ится.

```
error_rate(t) = clamp(0, 1, baseline + amplitude · sin(2π·t/period))
```

### Быстрый старт (через shell-враппер)

Враппер читает `FEATURE_ID` из `.env`, путь к `logs.json` — `homework/M5/logs.json`.

```bash
cd homework/M5
chmod +x run_simulate_wf2.sh

# Smoke — 2 минуты, period=60s — быстрый полный цикл toggle
./run_simulate_wf2.sh smoke

# Demo — 10 минут, period=300s — один полный sine-период для screencast
./run_simulate_wf2.sh demo

# Full — 30 минут, period=300s — 3 цикла
./run_simulate_wf2.sh full

# Stress — 5 минут, rps=20, period=60s — тест на конкурентную запись
./run_simulate_wf2.sh stress

# Переопределить feature_id / путь:
FEATURE_ID=search_autosuggest ./run_simulate_wf2.sh demo
OUTPUT=./custom/logs.json ./run_simulate_wf2.sh smoke
```

### Прямой вызов Python

```bash
python3 simulate_wf2.py \
  --output logs.json \
  --feature-id search_autosuggest \
  --duration 600 \
  --period 120 \
  --rps 5 \
  --amplitude 0.05 \
  --baseline 0.04
```

### Аргументы симулятора

| Аргумент | По умолчанию | Описание |
|----------|-------------|----------|
| `--output` | `logs.json` | Файл (тот же, что отдаёт `logs-server`) |
| `--feature-id` | `search_v2` | `feature_id` в каждом событии |
| `--duration` | `1800` | Время работы в секундах |
| `--rps` | `5` | Событий в секунду |
| `--period` | `300` | Период синусоиды (sec). Toggle происходит ~каждые `period/2` |
| `--amplitude` | `0.03` | Амплитуда синусоиды |
| `--baseline` | `0.03` | Базовая линия `error_rate` |

> **Важно:** при `baseline + amplitude ≤ 0.05` (threshold) WF2 не задеактивирует фичу. Для надёжного toggle: `baseline=0.04, amplitude=0.05` → диапазон `[-0.01, 0.09]` (≈`[0, 0.09]`), порог 5% пробивается на ~30% периода.

### Сценарий проверки toggle-цикла

```bash
# Терминал 1 — симулятор (10 мин, period=120s → 5 переходов через threshold)
./run_simulate_wf2.sh demo

# Терминал 2 — следить за features.json
watch -n 5 'cat ../../backend/features.json | python3 -c "import json,sys; d=json.load(sys.stdin)[\"search_autosuggest\"]; print(d[\"status\"], d[\"traffic_percentage\"])"'

# Терминал 3 — Telegram чат с ботом — приходят алерты на deactivate/reenable
```

Ожидаемо: за 10 минут — ~2 цикла `Enabled → Disabled → Enabled → Disabled`. На `decision=noop` Telegram молчит.

---

## Что было сложно

Суммарно домашка заняла ~15 часов, из них 12–13 ушло на ручную настройку workflow в n8n. Версия n8n отличалась от описания задания, формулировки местами неудобные — много времени потратил, выясняя через LLM и агентов, как правильно настраивать конкретные ноды. Закончились дефолтные LLM-токены в n8n.cloud — пришлось подключать собственный Anthropic API-ключ. Cloudflare quick tunnel — URL эфемерный, после каждого `docker compose restart` приходилось руками править host в MCP-нодах и `GET Logs` ноде WF2.

**Вывод по агентной автогенерации:** прогнал цепочку `orchestrator → spec → builder` только для WF1 — чтобы понять механику end-to-end (user story → YAML spec → валидный n8n JSON → импорт → работающий execution). На WF2 повторять не стал: суть подхода ясна, выигрыша над уже собранным вручную workflow нет, время дороже.

---

## Скриншоты

- WF1 — `homework/M5/screenshots_wf1/`
- WF2 — `homework/M5/screenshots_wf2/`
- WF1 (agentic build) — `homework/M5/screenshots_wf1_cc/`

## Скринкасты

Видео-демо работы фич — `homework/M5/screencasts/`:

| Файл | Что показано |
|------|--------------|
| `wf1-autopilots-components.mov` | AutoPilot панель на странице Feature Flags: 3 кнопки (Run check / Testing mode / Rollback), реакция UI на ответ n8n |
| `wf1-stress-test-reload-UI-after-n8n-changed.mov` | стресс-тест WF1: симулятор шлёт burst запросов, UI перезагружается и подтягивает новое состояние флага из `features.json` |
| `wf1-halucinations.mov` | hallucination test: невалидные payload-ы (`traffic_percentage=-50`) отклоняются Switch-нодой с 400, AI Agent не запускается |

---

## WF1 через агентов (n8n-requirements-orchestrator + n8n-workflow-builder)

WF1 дополнительно собран автоматически через цепочку из двух кастомных Claude-Code субагентов (см. `.claude/agents/`):

1. **`n8n-requirements-orchestrator`** — интерактивный диалог: из абстрактной user story («AutoPilot для feature flags») вытащил уточнения по триггеру, auth, MCP-инструментам, валидации, формату ответа и edge-кейсам. Output — структурированный spec `homework/M5/wf1-spec-cc.yaml` (трigger → IF validate → AI Agent + 3 MCP tools → Respond to Webhook, unified response contract).
2. **`n8n-workflow-builder`** — принял spec и сгенерировал валидный n8n JSON `homework/M5/wf1-manual-trigger-cc.json`: канонические типы нод, корректные `typeVersion`, sub-node связки (AI Agent ↔ Chat Model ↔ Memory ↔ Tools), credential placeholders.

### Файлы

| Файл | Роль |
|------|------|
| `.claude/agents/n8n-requirements-orchestrator.md` | агент 1 — user story → spec |
| `.claude/agents/n8n-workflow-builder.md` | агент 2 — spec → n8n JSON |
| `homework/M5/wf1-spec-cc.yaml` | детальный workflow spec (output агента 1) |
| `homework/M5/wf1-manual-trigger-cc.json` | импортируемый n8n workflow (output агента 2) |
| `homework/M5/screenshots_wf1_cc/Screenshot 2026-05-17 at 10.50.51.png` | пруф: workflow импортирован в n8n и успешно отрабатывает execution |

### Пруф работоспособности

Скриншот `homework/M5/screenshots_wf1_cc/Screenshot 2026-05-17 at 10.50.51.png` — сгенерированный агентами JSON импортирован в n8n, Workflow Execution отработал успешно: webhook принял запрос, IF-валидатор пропустил payload, AI Agent вызвал MCP-инструменты `mcp-features`, Respond to Webhook вернул ответ по контракту спеки.

### Правки после импорта (минимальные)

- **MCP Client нода заменена** на ноду со Streamable MCP transport — дефолтная из JSON не стартовала против `mcp-features` (HTTP/Streamable), пришлось переключить на корректный тип ноды; URL и Bearer Token перенесены как есть.
- **LLM не gpt-4o-mini** (как в spec) — n8n автоматически подцепил уже настроенный в инстансе credential **Claude Sonnet 4.5** с собственным Anthropic API-токеном. Модель не менял, оставил подгруженную.

### Сравнение с ручной сборкой (`wf1-manual-trigger.json`)

Оба JSON импортируются и работают. Различия:
- ручной — Switch-нода для валидации, Claude Sonnet 4.6, Structured Output Parser;
- агентный — IF-нода (бинарная валидация по spec), Claude Sonnet 4.5 (auto-loaded credential), Streamable MCP Client, унифицированный response через Set + Respond to Webhook.

Оба варианта закрывают требования M5. Агентный путь демонстрирует воспроизводимость спеки без ручной кликни-таски в n8n UI — правок после импорта две и обе тривиальные.
