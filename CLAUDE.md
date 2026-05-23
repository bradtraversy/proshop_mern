# CLAUDE.md

This file provides guidance when working with code in this repository.

## Design System — read before any frontend work

**[DESIGN.md](./DESIGN.md)** is the single source of truth for visual language, component patterns, spacing, typography, color tokens, and interactive states (hover / focus / loading / empty / error). It also encodes the anti-AI-slop guards from `homework/M4` (no Inter, no box-shadows, no `dark:` prefixes, no gradients, no 2-column comparison blocks, semantic tokens only, etc.).

**Read DESIGN.md every time you:**
- modify anything under `frontend/` (screens, components, styles, hooks that affect UI)
- propose, sketch, or implement a new design / redesign / visual change
- add a new screen, card, button, input, badge, modal, or any other UI element
- touch `frontend/src/index.css`, `bootstrap.min.css` overrides, or any future `tokens.css`
- review a frontend PR or write a frontend code review

If a code value conflicts with DESIGN.md, **DESIGN.md wins** and the code is wrong — fix the code, do not edit DESIGN.md to match drift. Changes to DESIGN.md itself require an explicit user decision, not a side effect of an implementation task.

## Commands

```bash
# Development (runs both server + client concurrently)
npm run dev

# Run backend only (nodemon)
npm run server

# Run frontend only
npm run client

# Seed database with sample data
npm run data:import

# Wipe all database data
npm run data:destroy

# Production build
cd frontend && npm run build

# RAG — запустить Qdrant (однократно, данные в docs/rag/qdrant-data/)
bash docs/rag/docker_qdrant.sh

# RAG — проиндексировать project-data/ в Qdrant (повторно — полная переиндексация)
cd mcp-rag && node ingest.js

# RAG — smoke-тест чанкера без обращения к Qdrant/Cohere
cd mcp-rag && node ingest.js --test

# RAG — дамп всех чанков в mcp-rag/chunks.jsonl (без Qdrant/Cohere), опц. путь: --dump path/to/file.jsonl
cd mcp-rag && node ingest.js --dump
```

No test framework is configured.

## Architecture

MERN e-commerce app (ProShop). The project is **deprecated** — the author has a v2 using Redux Toolkit.

### Backend (`backend/`)

Express + MongoDB (Mongoose). Uses ES modules (`"type": "module"` in root `package.json`), so all local imports require `.js` extensions.

- **Entry:** `backend/server.js` — loads env, connects DB, mounts middleware/routes
- **Models:** `backend/models/` — `userModel` (with bcrypt password hashing + JWT `matchPassword` method), `productModel`, `orderModel`
- **Routes → Controllers:** RESTful pattern. Routes in `backend/routes/`, logic in `backend/controllers/`. Endpoints:
  - `/api/products` — CRUD + reviews
  - `/api/users` — auth (register/login/profile update)
  - `/api/orders` — create, pay (PayPal), deliver, list
  - `/api/upload` — multer file uploads to `/uploads/`
  - `/api/config/paypal` — returns client ID
  - `/api/featureflags` — returns `backend/features.json` as JSON (no auth); `PATCH /:key` — update status/traffic (admin only, atomic write via tmp+rename)
  - `/api/autopilot` — server-side proxy to n8n WF1 webhook (`POST /feature-control`); reads `N8N_WEBHOOK_URL` + `N8N_API_KEY` from env; browser never sees secrets
- **Middleware:** `backend/middleware/authMiddleware.js` — JWT `protect` + `admin` guards. `errorMiddleware.js` — global error handler.
- **Config:** `backend/config/db.js` — Mongoose connection using `MONGO_URI` env var

### Feature Flags MCP Server (`mcp-features/`)

Два транспорта из одного `index.js`:

- **stdio** (локальный, по умолчанию) — Claude Code и Cursor спавнят процесс напрямую через `.mcp.json`. `MCP_TRANSPORT` не задан → stdio.
- **StreamableHTTP** (Docker) — `MCP_TRANSPORT=http`, порт `MCP_HTTP_PORT` (дефолт 7777). Используется в `mcp-features` Docker-сервисе для доступа из n8n через Cloudflare Tunnel.

Оба режима пишут в один `backend/features.json` (атомарно: tmp + `renameSync`). Конфликтов нет.

`mcp-features/Dockerfile` — образ node:20-alpine, `EXPOSE 7777`. Монтируется `./backend/features.json` через Docker Compose volume.

`MCP_BEARER_TOKEN` в Docker SSE-режиме — Express middleware проверяет `Authorization: Bearer <token>`, 401 если не совпадает.

### RAG MCP Server (`mcp-rag/`)

Semantic search over `project-data/` docs. Зарегистрирован в `.mcp.json` как `proshop-rag`.

- **`ingest.js`** — pipeline: читает все `.md` из `project-data/`, нарезает на чанки по `## `-секциям (≤512 токенов), эмбеддит через Cohere `embed-multilingual-v3.0` (1024-мерный вектор), загружает в Qdrant коллекцию `proshop_docs`. Запускать вручную при добавлении/изменении документов.
- **`index.js`** — MCP-сервер. Инструмент `search_project_docs(query, top_k)` — принимает вопрос на русском/английском, возвращает top-k чанков с полями `score`, `source_file`, `section`, `type`, `text`. Ресурс `proshop-docs-index` — список проиндексированных файлов.
- **`docs/rag/docker_qdrant.sh`** — запуск Qdrant v1.14.0 с персистентным томом `docs/rag/qdrant-data/` (в `.gitignore`, кроме `.gitkeep`).
- **Тип документа** определяется по пути: `runbooks/` → `runbook`, `incidents/` → `incident`, `adrs/` → `adr`, `features/` → `feature`, `api/` → `api`, `pages/` → `page`, остальное → `doc`.

### Frontend (`frontend/`)

Create React App (react-scripts 3.4.3) + Redux + React Router v5.

- **State:** Redux store (`frontend/src/store.js`) with `redux-thunk`. Reducers in `frontend/src/reducers/` for products, users, orders, cart, featureFlags. Cart and user auth state persisted to localStorage. Feature flags loaded into Redux on app mount (`App.js` dispatches `loadFeatureFlags` via `useEffect`).
- **Actions:** `frontend/src/actions/` — async action creators calling the backend API via axios
- **Screens:** `frontend/src/screens/` — page-level components (Home, Product, Cart, Login, Register, Shipping, Payment, PlaceOrder, Order, Profile, Admin screens)
- **Components:** `frontend/src/components/` — reusable UI (Header, Footer, Rating, etc.)
- **Hooks:** `frontend/src/hooks/` — `useDarkMode` (theme toggle), `useFeatureEnabled` (feature flag check with traffic bucket)
- **Proxy:** `frontend/src/setupProxy.js` проксирует `/api` и `/uploads` на backend. Адрес берётся из `REACT_APP_API_URL` (если задан) или дефолт `http://127.0.0.1:5001` для локального запуска. В Docker Compose `REACT_APP_API_URL=http://backend:5001` задаётся в `docker-compose.yml`.

### Environment (`.env`)

```
NODE_ENV=development
PORT=5001
MONGO_URI=mongodb://localhost:27017/proshop
JWT_SECRET=...
PAYPAL_CLIENT_ID=...
COHERE_API_KEY=...
QDRANT_URL=http://localhost:6333
N8N_WEBHOOK_URL=https://your-n8n.cloud/webhook
N8N_API_KEY=...
MCP_BEARER_TOKEN=...
```

Port 5001 instead of 5000 — macOS AirPlay Receiver occupies 5000.

`COHERE_API_KEY` — требуется для `mcp-rag/ingest.js` и `mcp-rag/index.js`. Без него RAG-сервер завершится при старте. `QDRANT_URL` опционален, дефолт `http://localhost:6333`.

`N8N_WEBHOOK_URL` — базовый URL n8n-инстанса (без пути). `autopilotRoutes.js` дописывает `/feature-control`. Без него `/api/autopilot` вернёт 500. `N8N_API_KEY` — значение `X-API-Key`; только сервер его знает, в браузерный bundle не попадает.

`MCP_BEARER_TOKEN` — Bearer Token для Docker SSE-режима `mcp-features`. Если пустой — auth выключен (только для локального теста без туннеля).

### Key Patterns

- All backend imports use `.js` extension (required by ES modules)
- JWT auth: token stored in localStorage, sent via `Authorization: Bearer` header
- Admin routes protected by `protect` + `admin` middleware chain
- Product images: uploaded via multer to `uploads/`, served as static files
- Frontend uses `NODE_OPTIONS=--openssl-legacy-provider` for Node.js v17+ compatibility with old webpack
- Feature flags: always check via `useFeatureEnabled('key')` hook — never use raw `flags.find(...)?.status`. The hook handles `Enabled`, `Disabled`, and `Testing` with traffic percentage (`sessionStorage ff_traffic_bucket`).
- Backend feature flags: use `isFeatureEnabled(flagKey, { isAdmin })` from `backend/utils/featureFlag.js` — never inline-read `features.json` in controllers. Mirrors frontend logic: `Enabled` → always true, `Testing` → true for admins or by traffic %, `Disabled` → always false.
- RAG ingest is idempotent — каждый запуск удаляет и пересоздаёт коллекцию `proshop_docs`. Запускать после добавления новых `.md` файлов в `project-data/`.
- RAG MCP сервер (`proshop-rag`) автостартует через `.mcp.json`. Если Qdrant не запущен или коллекция не проиндексирована — инструмент вернёт `isError: true` с понятным сообщением.
- Чанкер `ingest.js` экспортирует `buildChunks()` — можно импортировать отдельно без запуска full ingest pipeline (используй `--test` флаг для smoke-теста).
- `mcp-rag/ingest.js --dump [path]` — дамп всех чанков в JSONL без обращения к Qdrant/Cohere. Дефолтный путь — `mcp-rag/chunks.jsonl`. Файл закоммичен в репо для ревью качества chunking без поднятия инфраструктуры. Перегенерировать после изменения `project-data/` или логики чанкера.
- AutoPilot proxy: `POST /api/autopilot/feature-control` — backend проксирует в n8n, добавляя `X-API-Key`. Frontend не хранит и не видит секрет. CORS preflight не проблема — браузер идёт на свой origin. На сетевую ошибку backend возвращает 502/504, на успех — upstream JSON as-is.

## Commit Conventions

Every commit message must be prefixed with `COURSE:`:

```
COURSE: Fix cart calculation for discounted items
COURSE: Add product review validation
```

Example of a good commit:

```
COURSE: Fix dev environment setup for modern Node.js

  - Add NODE_OPTIONS=--openssl-legacy-provider for webpack compatibility with Node v24
  - Change dev server port from 5000 to 5001 to avoid macOS AirPlay conflict
  - Add .idea to .gitignore
  - Add Docker script for local MongoDB
  - Update package-lock files
```

## Local Gotchas

- After adding a new Mongoose model or changing a schema, run `npm run data:import` to re-seed the database
- MongoDB must be running locally before starting the server (`docker run -d -p 27017:27017 --name mongo mongo:7` or local `mongod`)
- Port 5000 is occupied by macOS AirPlay Receiver — use 5001 instead
- Node.js v17+ requires `NODE_OPTIONS=--openssl-legacy-provider` (already in `package.json` client script)
- `.env` is required but not committed — copy from teammate or create manually
- API proxy настроен в `frontend/src/setupProxy.js` — читает `REACT_APP_API_URL` или дефолт `http://127.0.0.1:5001`. Не трогать `"proxy"` в `frontend/package.json` — его там нет намеренно.
- `setupProxy.js` использует `http-proxy-middleware` **v0.x** API: `const proxy = require('http-proxy-middleware')`. Не использовать `{ createProxyMiddleware }` — это v1.x, сломает `npm run dev`.
- `authMiddleware.js` проверяет `req.user` на `null` после `User.findById()` — если пользователь удалён из БД, а токен в localStorage ещё живой, без этой проверки будет краш. Пользователю нужно разлогиниться.
- Docker Compose: frontend требует `stdin_open: true` — без него `webpack-dev-server 3.x` завершается с кодом 0 сразу после старта (stdin закрывается в non-TTY окружении). MongoDB требует healthcheck — `seeder` и `backend` стартуют только после `service_healthy`.
- `backend/features.json` — источник данных для feature flags. Путь в роуте вычисляется через `import.meta.url` (не через `process.cwd()`), поэтому файл должен лежать рядом с `backend/routes/featureFlagRoutes.js` (т.е. на уровень выше — `backend/`). Docker Compose монтирует `./backend:/app/backend`, поэтому файл доступен в контейнере автоматически. MCP-интеграция пишет в этот файл; пользователь видит изменения после перезагрузки страницы.
- RAG MCP: `mcp-rag/ingest.js` использует `import.meta.url` для вычисления пути к `project-data/` — файлы ищутся относительно расположения скрипта, не `process.cwd()`. При запуске из любой директории путь всегда корректен.
- `docs/rag/qdrant-data/` игнорируется в git (кроме `.gitkeep`) — данные Qdrant не коммитятся. После клонирования репозитория нужно запустить Qdrant и выполнить `node mcp-rag/ingest.js` заново.
- `N8N_WEBHOOK_URL` и `N8N_API_KEY` обязательны для работы AutoPilot. Без `N8N_WEBHOOK_URL` `/api/autopilot` вернёт 500 при любом запросе.
- `mcp-features` в Docker Compose: `docker compose up -d mcp-features mcp-tunnel`. URL туннеля — в логах `mcp-tunnel` (grep trycloudflare.com). URL эфемерный — меняется при каждом рестарте контейнера; n8n credentials нужно обновлять руками.
- `mcp-features` в Docker использует `MCP_TRANSPORT=http` и `MCP_HTTP_PORT=7777`. Локально (Claude Code/Cursor) — stdio через `.mcp.json`, `MCP_TRANSPORT` не задан.

## MR Review Checklist

### 1. Security
- No hardcoded secrets (JWT_SECRET, DB credentials, API keys)
- User input validation (NoSQL injection, XSS)
- Proper auth/authorization (JWT, middleware chain, role checks)
- Dependencies with known vulnerabilities (`npm audit`)

### 2. Structure & Architecture
- Separation of concerns (routes → controllers → models)
- No business logic in routes or thin-controller pass-throughs
- Proper middleware usage and ordering
- ES modules consistency — all imports with `.js` extension

### 3. Error Handling
- Global error handler catches unhandled errors
- Async functions use `express-async-handler` or try/catch
- Correct HTTP status codes (400, 401, 403, 404, 422, 500)
- Stack traces do not leak in production responses

### 4. Database
- No N+1 queries (check `.populate()` usage)
- Indexes on frequently queried fields
- Schema-level validation (Mongoose `required`, `match`, `enum`, etc.)
- Transactions where needed (multi-document operations)

### 5. Performance
- Pagination for list endpoints
- Caching where appropriate
- No blocking synchronous operations in request handlers
- Connection pool configured properly

### 6. Code Quality
- Clear variable/function naming
- DRY — no duplicated logic
- Single responsibility per function/component
- Consistent style (ESLint, formatting)

### 7. DevOps / Infrastructure
- `.env` not in git
- `node_modules` in `.gitignore`
- `package.json` scripts for common operations
- Proper `.dockerignore` / `Dockerfile` if applicable