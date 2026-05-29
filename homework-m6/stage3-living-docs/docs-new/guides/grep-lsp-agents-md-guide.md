> **Language / Язык:** [English](grep-lsp-agents-md-guide-en.md) · **Русский** (текущая версия)

---

# `grep + LSP + Agents.md` — навигация по коду без vector RAG

## TL;DR

К началу 2026 года лидеры AI-coding (Anthropic Claude Code, Aider, Codex CLI, OpenCode, Cline, Continue) **отказались от классического vector RAG над кодовыми базами**. На замену пришла связка из трёх простых инструментов: **grep + LSP + Agents.md**. Она дешевле, точнее на identifiers и не требует индексации.

Эта триада — не противоположность RAG, а **отдельный паттерн для кода**. Для документации, FAQ, knowledge base — vector RAG по-прежнему стандарт. Для кода — другие законы.

---

## Три компонента

### 1. `grep` — текстовый поиск по файлам

Обычный текстовый поиск (`ripgrep` / `grep` / IDE Find in Files). Агент сам формирует запросы и читает релевантные файлы.

**Что даёт:**

- **Exact match для identifiers.** Имя функции, переменной, тип, константа — ищется точно, без семантической размытости. Vector embeddings часто промахиваются на коротких токенах.
- **Zero indexing.** Не нужно ничего предварительно векторизовать, обновлять индексы, следить за инвалидацией.
- **Freshness гарантирована.** Поиск всегда идёт по актуальному состоянию кода — `git pull` достаточно.
- **No security liability.** Код не уезжает в сторонние сервисы для embeddings — особенно важно для proprietary code.

**Ограничение:** для запросов типа «найди код, который делает X концептуально» — grep слаб. Здесь либо vector embeddings, либо просто читать `Agents.md` и догадываться по структуре.

**Пример** (Claude Code / Codex CLI):

```
User: «Где обрабатывается двойная оплата?»
Agent: grep -rn "duplicate.*payment\|idempot" .
       ↓ читает 3 файла
       ↓ возвращает ответ с ссылками на код
```

---

### 2. LSP — Language Server Protocol

Стандарт от Microsoft (2016), который дал IDE универсальный доступ к структурной информации о коде: типы, ссылки, определения, иерархия классов.

**Что даёт:**

- **`go-to-definition`** — где определён символ.
- **`find-references`** — кто вызывает эту функцию, где используется тип.
- **Type info** — какой тип у переменной в этой строке.
- **`rename-symbol`** — безопасное переименование с учётом всех вызовов.

Vector RAG в принципе **не умеет structural queries** — он работает на уровне семантической близости текста, а не графа вызовов. LSP даёт «структурное знание» о коде «бесплатно» — оно уже есть в любом языковом сервере (`tsserver`, `pyright`, `rust-analyzer`, `gopls`, `clangd`).

**Когда критично:** «найди всех потомков класса X», «где импортируется этот модуль», «какие функции возвращают тип Y». Vector embeddings здесь не работают.

**Где живёт:** агенты подключаются к LSP через MCP-серверы или встроенные интеграции IDE. Cursor, Continue, Claude Code (через расширение) умеют дёргать LSP под капотом.

---

### 3. `Agents.md` — Markdown-карта проекта для AI

Файл в корне репо с **высокоуровневым описанием проекта** для AI-агента. Альтернативные имена: `CLAUDE.md`, `AGENTS.md`, `.cursorrules` (Cursor), `WARP.md` (Warp). Стандарт `AGENTS.md` стал кросс-инструментальным к концу 2025.

**Что внутри:**

- **Архитектура одним абзацем.** «Frontend на React, бэк на Express+Mongoose, payments через PayPal SDK.»
- **Куда смотреть для X.** «Логика checkout — `frontend/src/screens/PlaceOrderScreen.js` и `backend/controllers/orderController.js`.»
- **Conventions.** Где живут tests, как именуются файлы, какие коммитные сообщения принимаются.
- **Domain glossary.** Сокращения и термины проекта (SKU, PSP, CRM, RBAC) с расшифровкой.
- **Что НЕ делать.** Грабли, deprecated пути, легаси-зоны.
- **Команды.** `npm run dev`, `npm test`, как запустить linter.

**Главное правило:** **≤ 200 строк**. Больше — агент не дочитает или раздуется контекст. Если нужно глубже — выносить во вложенные файлы (`docs/architecture.md`, `docs/conventions.md`) и ссылаться из `Agents.md`.

**Исследование Langchain:** агенты с `Claude.md` / `Agents.md` в репо показывают на **десятки процентов** лучшие результаты на задачах кодинга. Это самый дешёвый способ улучшить качество — один файл, час работы.

---

## Когда работает связка vs vector RAG для кода

| Сценарий | Что выбрать |
|----------|-------------|
| Агент пишет код в проекте до ~200K строк | grep + LSP + Agents.md |
| Поиск конкретного identifier (функция, тип, константа) | grep |
| «Кто вызывает эту функцию» / «всех потомков класса» | LSP |
| Концептуальный поиск «как устроена аутентификация» | Agents.md → ссылка на нужные файлы |
| Монорепо 1000+ файлов, multi-language, dependency graph | Knowledge graph (CodeAlive, GitHub Spec Index) или Cursor с custom embeddings |
| Документация по продукту / API / RFCs | **vector RAG** (это другой домен — не код) |

**Cursor** — особый случай. Использует кастомные code-embeddings + Turbopuffer + Merkle tree для инкрементального индекса. На монорепо >1000 файлов даёт **+12.5% accuracy** против чистого grep. Но это не классический vector RAG, а гибрид: grep + структурный embed.

---

## Production-инструменты

| Инструмент | Что использует | Подход |
|------------|----------------|--------|
| Anthropic Claude Code | grep + LSP (через MCP) + CLAUDE.md | Agentic search, без preindex |
| OpenAI Codex CLI | grep + AGENTS.md | То же — отказались от embedding-индекса |
| Aider | repo map + grep + конвенции из Agents.md | repo map = автогенерируемый skeleton проекта |
| Cline / OpenCode | grep + LSP + кастомный context | Open-source, тот же паттерн |
| Continue | grep + LSP + RAG как опция | Гибрид, vector — отключаемая фича |
| Cursor | Кастомные code-embeddings + grep | Единственный из топа с реальным vector |

---

## Setup на своём проекте (10 минут)

**1. Создайте `AGENTS.md` в корне.** Шаблон:

```markdown
# Project Name

## What this is
[One paragraph: что делает продукт, на чём написан, кто пользуется.]

## Architecture
- Frontend: React + Redux, в `frontend/src/`
- Backend: Node + Express + Mongoose, в `backend/`
- DB: MongoDB Atlas
- Payments: PayPal SDK

## Where to look
- Auth flow → `backend/middleware/authMiddleware.js`
- Order logic → `backend/controllers/orderController.js`
- Cart state → `frontend/src/reducers/cartReducers.js`

## Conventions
- Tests in `__tests__/` рядом с модулем
- Async/await, no callbacks
- Mongoose schemas — в `backend/models/`

## Don't
- Не правьте `seeder.js` без `data:destroy` сначала
- Не используйте `Date.now()` в тестах — нужен mock

## Commands
- `npm run dev` — frontend + backend
- `npm test`
- `npm run mongo:up` — поднять MongoDB локально
```

**2. Убедитесь, что LSP работает.** Откройте проект в IDE с расширением для языка (TypeScript, Python, Go и т.д.). Если `Cmd+Click` на функцию открывает её определение — LSP работает.

**3. Подключите к агенту.** Claude Code / Cursor / Continue **сами читают** `AGENTS.md` / `CLAUDE.md` при старте сессии. Для других — добавляйте в системный промпт через `--context` или вручную.

**4. Не индексируйте код в vector DB.** Для кода — это лишний слой. Для документации проекта (`docs/`, `README`, `wiki`) — да, но это другой домен.

---

## Антипаттерны

- **«Загнал весь код в Pinecone и теперь у меня RAG над кодбазой».** На 200+ файлов через 2 недели индекс stale (после нескольких рефакторингов), top-K возвращает чанки из удалённых функций. Cole Medin: «agentic search outperformed by a lot, surprising».
- **`Agents.md` на 1000 строк.** Агент или не дочитает, или съест половину контекстного окна. Жёсткий лимит — 200 строк, остальное в ссылки.
- **`AGENTS.md`, который никто не обновляет.** Через 3 месяца расходится с реальностью, агент по нему ошибается. Включите ревью `AGENTS.md` в Definition of Done каждой большой фичи.
- **Vector embeddings для search конкретной функции.** «Найди функцию `calculateTotal`» — это работа для grep, не для cosine similarity. Embedding shorter tokens плохо различает синонимы.

---

## Ключевые цитаты

> «agentic search outperformed by a lot, surprising»
> — Boris Cherny (Anthropic, Claude Code lead)

> «RAG dead — only for code. Enterprise RAG продолжает расти.»
> — Cole Medin, в видео «Why the best AI-coding tools abandoned RAG»

> «Code agents с доступом к Claude.md / Agents.md показывают существенно лучшие результаты — десятки процентов»
> — Langchain research, 2025

---

## Связь с остальным курсом

- **M3 (этот модуль)** — `grep + LSP + Agents.md` как контр-паттерн к классическому vector RAG. См. `vector-db-comparison-2026.md` секция «Когда vector DB НЕ нужен».
- **M4** — UI поверх MCP, который пишете в Части 1 домашки. Там `Agents.md` уровня UI-репо тоже полезен.
- **M6** — AI code review над `proshop_mern`. `Agents.md` критичен: без него review поверхностный, с ним — структурный.

---

## Источники

- Cole Medin, «Why the best AI-coding tools abandoned RAG» (YouTube, 2026-02-18)
- Anthropic Claude Code documentation: <https://docs.claude.com/en/docs/claude-code/memory>
- AGENTS.md cross-tool standard: <https://agents.md>
- Microsoft Language Server Protocol: <https://microsoft.github.io/language-server-protocol/>
- ripgrep (`rg`) — production-grade grep replacement: <https://github.com/BurntSushi/ripgrep>
- Aider repo map docs: <https://aider.chat/docs/repomap.html>
