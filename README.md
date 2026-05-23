# ProShop

Интернет-магазин на MERN-стеке (MongoDB, Express, React, Node.js) с Redux. Учебный проект из курса Брэда Траверси. Поддерживает каталог товаров, корзину, оформление заказа с оплатой через PayPal, отзывы, панель администратора. Оригинальный репозиторий объявлен deprecated, есть [v2 на Redux Toolkit](https://github.com/bradtraversy/proshop-v2).

## Tech Stack

**Backend:** Node.js (ES modules), Express 4.17, Mongoose 5.10, JWT (jsonwebtoken 8.5), bcryptjs, multer, morgan

**Frontend:** React 16.13, Redux 4 + redux-thunk 2.3, React Router 5, React Bootstrap 1.3, react-scripts 3.4.3, axios 0.20

**Dev tools:** nodemon, concurrently 5.3

**База данных:** MongoDB

**RAG / AI:** Qdrant 1.14 (векторная БД), Cohere `embed-multilingual-v3.0` (эмбеддинги), MCP SDK 1.29 (`@modelcontextprotocol/sdk`)

## Структура проекта

```
├── backend/
│   ├── config/          # Подключение к MongoDB
│   ├── controllers/     # Бизнес-логика (products, users, orders)
│   ├── data/            # Сидовые данные (products.js, users.js)
│   ├── middleware/       # auth (JWT protect + admin), error handler
│   ├── models/          # Mongoose-схемы (User, Product, Order)
│   ├── routes/          # Express-роуты (/api/products, /users, /orders, /upload, /featureflags)
│   ├── utils/           # generateToken (JWT)
│   ├── features.json    # Feature flags (источник данных для /api/featureflags)
│   ├── seeder.js        # Импорт/удаление сидовых данных
│   └── server.js        # Точка входа
├── frontend/
│   └── src/
│       ├── actions/     # Redux async actions (API-вызовы через axios)
│       ├── components/  # Переиспользуемые UI-компоненты
│       ├── constants/   # Типы Redux-экшенов
│       ├── reducers/    # Redux-редьюсеры (product, user, order, cart, featureFlags)
│       ├── screens/     # Страницы (Home, Cart, Login, Order, Admin и т.д.)
│       ├── setupProxy.js  # Dev-proxy: /api и /uploads → backend (http-proxy-middleware v0.x)
│       ├── App.js         # Роутинг
│       ├── store.js       # Redux store (redux-thunk)
│       └── index.js       # Точка входа
├── mcp-features/        # MCP-сервер управления feature flags (stdio для Claude Code, SSE/HTTP для n8n через Docker)
│   ├── index.js         #   Двойной транспорт: stdio (локально) + StreamableHTTP (MCP_TRANSPORT=http)
│   ├── Dockerfile       #   Образ для Docker Compose (порт 7777)
│   └── package.json
├── mcp-rag/             # MCP-сервер семантического поиска по документации
│   ├── index.js         #   MCP-сервер: tool search_project_docs + resource proshop-docs-index
│   ├── ingest.js        #   Ingest pipeline: чанкинг → Cohere embeddings → Qdrant upsert
│   └── package.json
├── project-data/        # Markdown-документация проекта (индексируется RAG)
│   ├── adrs/            #   Architecture Decision Records
│   ├── api/             #   API-документация
│   ├── features/        #   Описания фич
│   ├── incidents/       #   Runbooks инцидентов
│   ├── pages/           #   Описания страниц
│   ├── runbooks/        #   Операционные runbooks
│   └── *.md             #   Архитектура, best practices, глоссарий и т.д.
├── docs/
│   └── rag/
│       ├── docker_qdrant.sh   # Скрипт запуска Qdrant с персистентным томом
│       └── qdrant-data/       # Данные Qdrant (в .gitignore)
├── uploads/             # Загруженные изображения товаров
├── .mcp.json            # Регистрация MCP-серверов (features, proshop-rag)
├── CLAUDE.md            # Правила для AI-ассистента
└── package.json         # Root: backend deps + concurrently-скрипты
```

## Установка и запуск

Проект поддерживает два способа запуска: через **Docker Compose** (рекомендуется) и **локально**.

---

### Способ 1 — Docker Compose (рекомендуется)

**Prerequisites:** только [Docker Desktop](https://www.docker.com/products/docker-desktop/)

#### 1. Создайте `.env` в корне проекта

```
NODE_ENV=development
PORT=5001
MONGO_URI=mongodb://localhost:27017/proshop
JWT_SECRET=your_jwt_secret
PAYPAL_CLIENT_ID=your_paypal_client_id
```

> `MONGO_URI` в `.env` используется только для локального запуска. В Docker Compose он автоматически переопределяется на `mongodb://mongo:27017/proshop`.

#### 2. Запустите

```bash
docker-compose up --build
```

При первом запуске автоматически:
- Поднимается MongoDB (с healthcheck)
- Запускается сидер и заполняет базу тестовыми данными
- Стартует backend (порт 5001) и frontend (порт 3000)

Компиляция frontend при первом запуске занимает 1–2 минуты.

> **Почему `stdin_open: true` в compose для frontend?** `webpack-dev-server 3.x` вызывает `process.exit()` при закрытии stdin. Docker Compose запускает контейнеры без TTY — stdin сразу закрывается, процесс молча завершается с кодом 0. `stdin_open: true` держит stdin открытым.

#### Доступ

| Сервис | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:5001/api |
| MongoDB | localhost:27017 |
| mcp-features (SSE/HTTP) | http://localhost:7777 |
| mcp-tunnel | публичный URL в логах (`docker compose logs mcp-tunnel`) |

#### Полезные команды

```bash
# Остановить все контейнеры
docker-compose down

# Остановить и удалить данные MongoDB (полный сброс)
docker-compose down -v

# Пересобрать образы после изменений в Dockerfile
docker-compose up --build

# Посмотреть логи конкретного сервиса
docker-compose logs -f backend
docker-compose logs -f frontend

# Запустить только mcp-features + Cloudflare tunnel (для n8n интеграции)
docker compose up -d mcp-features mcp-tunnel

# Найти публичный URL туннеля (нужен для MCP Client в n8n)
docker compose logs mcp-tunnel | grep trycloudflare.com
```

---

### Способ 2 — Локальный запуск

**Prerequisites:**

| Инструмент | Версия | Примечание |
|---|---|---|
| Node.js | v16+ (до v24 включительно) | При v17+ нужен флаг `--openssl-legacy-provider` (уже в скриптах) |
| MongoDB | 4.x+ | Локально или Docker |
| npm | 6+ | |

**Запуск MongoDB через Docker:**

```bash
docker run -d -p 27017:27017 --name mongo mongo:7
```

#### Env-переменные

Создайте файл `.env` в корне проекта:

```
NODE_ENV=development
PORT=5001
MONGO_URI=mongodb://localhost:27017/proshop
JWT_SECRET=your_jwt_secret
PAYPAL_CLIENT_ID=your_paypal_client_id
```

| Переменная | Где используется | Описание |
|---|---|---|
| `NODE_ENV` | `server.js`, `errorMiddleware.js` | Режим запуска (development/production) |
| `PORT` | `server.js` | Порт сервера. Используйте **5001**, порт 5000 занят AirPlay Receiver в macOS |
| `MONGO_URI` | `config/db.js` | Строка подключения к MongoDB (обязательно с `mongodb://` или `mongodb+srv://`) |
| `JWT_SECRET` | `utils/generateToken.js`, `authMiddleware.js` | Секрет для подписи JWT-токенов |
| `PAYPAL_CLIENT_ID` | `server.js` → `/api/config/paypal` | Client ID из PayPal Developer Dashboard (sandbox или live) |
| `COHERE_API_KEY` | `mcp-rag/ingest.js`, `mcp-rag/index.js` | API-ключ Cohere для генерации эмбеддингов. **Обязателен для RAG.** |
| `QDRANT_URL` | `mcp-rag/ingest.js`, `mcp-rag/index.js` | URL Qdrant. Дефолт: `http://localhost:6333` |
| `N8N_WEBHOOK_URL` | `backend/routes/autopilotRoutes.js` | Базовый URL n8n-инстанса (до пути). Пример: `https://eefimenko.app.n8n.cloud/webhook`. **Обязателен для AutoPilot.** |
| `N8N_API_KEY` | `backend/routes/autopilotRoutes.js` | `X-API-Key` для аутентификации на n8n webhook. Хранится только на сервере. |
| `MCP_BEARER_TOKEN` | `mcp-features/index.js` (Docker SSE-режим) | Bearer Token для HTTP-доступа к mcp-features из n8n. Если пустой — auth выключен. |

#### Установка зависимостей

```bash
# Установить backend-зависимости (корень)
npm install

# Установить frontend-зависимости
cd frontend
npm install
```

#### Запуск

```bash
# Backend + Frontend одновременно
npm run dev

# Только backend (порт из .env, по умолчанию 5001)
npm run server

# Только frontend (порт 3000)
npm run client
```

#### Первичная загрузка данных

```bash
# Импортировать тестовые товары и пользователей
npm run data:import

# Удалить все данные из базы
npm run data:destroy
```

---

### Тестовые аккаунты

Доступны после запуска через Docker Compose (сид автоматический) или после `npm run data:import`:

| Email | Пароль | Роль |
|---|---|---|
| admin@example.com | 123456 | Admin |
| john@example.com | 123456 | Customer |
| jane@example.com | 123456 | Customer |

## Troubleshooting

### `Error: Invalid connection string`

`MONGO_URI` указан без префикса. Должно быть:
```
MONGO_URI=mongodb://localhost:27017/proshop
```
Не `localhost:27017/proshop`.

### `Error: error:0308010C:digital envelope routines::unsupported`

Node.js v17+ использует OpenSSL 3, несовместимый с webpack 4 из react-scripts 3.4.3. Флаг уже добавлен в `package.json`:

```json
"client": "NODE_OPTIONS=--openssl-legacy-provider npm start --prefix frontend"
```

Если запускаете frontend вручную: `NODE_OPTIONS=--openssl-legacy-provider npm start --prefix frontend`.

### Запросы к API возвращают 403

1. Убедитесь что `PORT` в `.env` равен **5001** — локальный proxy по умолчанию идёт на `http://127.0.0.1:5001`.
2. Проверьте, что сервер реально запустился (нет ошибок в консоли).

### Proxy — как устроена маршрутизация API-запросов

Запросы к `/api` и `/uploads` автоматически проксируются с frontend dev-сервера на backend. Настройка в `frontend/src/setupProxy.js`:

```js
const target = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5001'
```

| Режим | `REACT_APP_API_URL` | Прокси идёт на |
|---|---|---|
| Локальный (`npm run dev`) | не задан | `http://127.0.0.1:5001` |
| Docker Compose | `http://backend:5001` (задан в compose) | Docker-сервис `backend` |

**Важно:** `react-scripts 3.4.3` тянет `http-proxy-middleware` **v0.19.x**. В этой версии нет `createProxyMiddleware` — используется API v0.x:

```js
// Правильно (v0.x)
const proxy = require('http-proxy-middleware')
app.use('/api', proxy({ target, changeOrigin: true }))

// Неправильно — сломает npm run dev (это API v1.x+)
const { createProxyMiddleware } = require('http-proxy-middleware')
```

### `Error: connect ECONNREFUSED 127.0.0.1:27017`

MongoDB не запущен. Проверьте:
```bash
# Если через Docker
docker ps | grep mongo

# Запустить, если не запущен
docker run -d -p 27017:27017 --name mongo mongo:7
```

### Port 5000 уже занят (macOS)

macOS Monterey+ использует порт 5000 для AirPlay Receiver. Решения:
- Использовать порт 5001 (рекомендуется, уже настроено)
- Или отключить: System Settings → General → AirDrop & Handoff → выключить AirPlay Receiver

### PayPal кнопка не отображается

- Для разработки используйте PayPal Sandbox: [developer.paypal.com](https://developer.paypal.com)
- Создайте sandbox-приложение, скопируйте Client ID в `.env`
- Для оплаты используйте sandbox-аккаунт покупателя (не реальный PayPal)
- Если PAYPAL_CLIENT_ID пустой, кнопка не отобразится, но остальной функционал работает

### Backend-импорты падают с "module not found"

Проект использует ES modules (`"type": "module"` в `package.json`). Все локальные импорты должны содержать расширение `.js`:

```js
// Правильно
import Product from '../models/productModel.js'

// Неправильно — ошибка
import Product from '../models/productModel'
```

## RAG — семантический поиск по документации

Система позволяет AI-ассистенту (Claude Code) искать информацию в `project-data/` через MCP-инструмент `search_project_docs`.

### Компоненты

| Компонент | Что делает |
|---|---|
| **Qdrant** | Векторная БД, хранит эмбеддинги чанков. Запускается через Docker. |
| **Cohere** | Генерирует 1024-мерные мультиязычные эмбеддинги (`embed-multilingual-v3.0`). |
| **`mcp-rag/ingest.js`** | Читает все `.md` из `project-data/`, режет на чанки, загружает в Qdrant. |
| **`mcp-rag/index.js`** | MCP-сервер с инструментом поиска и ресурсом-индексом. |

### Настройка

#### 1. Добавьте переменные в `.env`

```
COHERE_API_KEY=your_cohere_api_key
QDRANT_URL=http://localhost:6333
```

Ключ Cohere: [dashboard.cohere.com](https://dashboard.cohere.com) → API Keys.

#### 2. Запустите Qdrant

```bash
bash docs/rag/docker_qdrant.sh
```

Данные сохраняются в `docs/rag/qdrant-data/` (персистентный том, в `.gitignore`).

#### 3. Установите зависимости и проиндексируйте документы

```bash
cd mcp-rag && npm install
node ingest.js
```

Вывод: `N vectors indexed in 'proshop_docs'`. Повторный запуск полностью переиндексирует коллекцию (идемпотентно).

Дамп чанков в `mcp-rag/chunks.jsonl` без обращения к Qdrant/Cohere (для ревью качества chunking):

```bash
cd mcp-rag && node ingest.js --dump
```

#### 4. MCP-сервер стартует автоматически

`proshop-rag` зарегистрирован в `.mcp.json` — Claude Code запускает его при открытии проекта.

### Использование

Задайте вопрос Claude Code на русском или английском:

- *«Как задеплоить приложение в production?»*
- *«Почему выбрали MongoDB вместо PostgreSQL?»*
- *«Как работает feature flag `dark_mode`?»*

Claude автоматически вызовет `search_project_docs` и ответит на основе документации проекта.

### Структура `project-data/`

Тип чанка определяется по директории:

| Путь | Тип |
|---|---|
| `runbooks/` | `runbook` |
| `incidents/` | `incident` |
| `adrs/` | `adr` |
| `features/` | `feature` |
| `api/` | `api` |
| `pages/` | `page` |
| остальное | `doc` |

---

## Feature Flags

Флаги хранятся в `backend/features.json` (25 штук). При старте приложения они загружаются в Redux (`state.featureFlags`) и доступны во всех компонентах.

**Просмотр:** войти под админом → меню Admin → Feature Dashboard (`/admin/featuredashboard`).

**Обновление флага вручную:** через UI Feature Dashboard (toggle статуса + slider traffic %, пишет в `backend/features.json` через `PATCH /api/featureflags/:key`), либо отредактировать `backend/features.json` напрямую или через MCP. Изменения вступают в силу после перезагрузки страницы — рестарт сервера не нужен.

**AutoPilot (n8n WF1):** страница Feature Flags (`/admin/featureflags`) — выбрать флаг → появляется панель AutoPilot с кнопками `Run check`, `Testing mode`, `Rollback feature`. Кнопки вызывают `POST /api/autopilot/feature-control`, который проксирует запрос в n8n WF1. Требует заполненных `N8N_WEBHOOK_URL` и `N8N_API_KEY` в `.env`.

Структура одного флага:

```json
{
  "flag_key": {
    "name": "Человекочитаемое название",
    "description": "Описание фичи",
    "status": "Enabled | Testing | Disabled",
    "traffic_percentage": 0,
    "rollout_strategy": "canary | ab_test | full_release",
    "targeted_segments": ["all"],
    "last_modified": "YYYY-MM-DD",
    "dependencies": ["other_flag_key"]
  }
}
```

> `dependencies` — опциональное поле. `backend/features.json` монтируется в Docker Compose автоматически через `./backend:/app/backend`.

## License

MIT — Copyright (c) 2020 Traversy Media