# M6 — Домашка «Агент-Контролёр»

> **4 stages, ~7-9 часов общее время, дедлайн перед M7.** Применяешь на своём fork `proshop_mern`.

---


## TL;DR — что нужно сделать

**4 stages, ~7-9 часов общее время, дедлайн перед M7.**

| # | Stage | Что делаем | Время | Что сдаём |
|---|---|---|---|---|
| 1 | **Multi-Agent Code Review** | Запускаем 3 sub-agents последовательно (security → performance → architecture) + final synthesizer → получаем `synthesis.md` | 1.5-2 ч | Все промежуточные review + `synthesis.md` |
| 2 | **Fix Top-3** | Из `synthesis.md` берём 3 самых критичных findings, чиним через safe-refactor recipe | 1.5-2 ч | 3 diff'а + characterization tests прошли |
| 3 | **Legacy Audit + Living Documentation** | Входим в роль `legacy-auditor-mate` (plan-mode orchestrator) и даём ему **КОНТЕКСТ ПРОЕКТА** про твой fork. Он сам walks структуру, аудитит существующую docs/ (✅/🔄/📦/❌), планирует, после approval использует готовый Stage 1 synthesis.md как findings-вход и делает 4-step reverse engineering по всем модулям проекта, собирает project-index.json + новую docs-структуру + update_project_index.py + секции в корневой конфиг (AGENTS.md/CLAUDE.md). Старые доки — только то что 📦/❌ — архивируем. | 2.5-3.5 ч | project-index.json + specs + update_project_index.py + корневой конфиг с секциями + (опц.) hook |
| 4 | **Tests Agent** | Создаём `test-writer-mate.md`, прогоняем на 2 сервисах из своего кода | 1-1.5 ч | Agent definition + сгенерированные тесты + прогон |

**Все ссылки на агентов и шаблоны** — в студ-репо `aidev-course-materials/M6/`.

---

## Pre-requisites (ДО старта домашки)

- [ ] Свой fork `proshop_mern` с твоим кодом M3-M5 (MCP / RAG / feature flags / dashboard)
- [ ] Claude Code установлен, `claude --version` ≥ v2.1.32
- [ ] `ANTHROPIC_API_KEY` в env или login сделан (`claude /login`)
- [ ] Скопируй mate-агентов в свой fork:
  ```bash
  mkdir -p .claude/agents
  cp aidev-course-materials/M6/agents/*.md .claude/agents/
  # optional, only if you plan to run legacy-auditor with the template:
  cp -r aidev-course-materials/M6/agents/templates .claude/agents/templates
  ```
  > Команды `cp` выше предполагают, что `aidev-course-materials/` доступен по этому относительному пути от корня твоего форка. Если он лежит в другом месте — подставь свой путь до него.

  Все 5 mate-агентов (security / architecture / performance / legacy-auditor / test-writer) — **универсальные**, работают на любом репо и любом стеке. Project-specific контекст (имена сервисов, язык, scope из Шага 0) ты передаёшь в spawn-промптах / role-entry (см. Stage 1 и Stage 3).
- [ ] Свободный slot времени 7-9 часов на следующие 2 недели

---

## 🗺️ Шаг 0 — карта твоего форка (заполни ПЕРЕД стартом)

> **Важно.** Пути и шаблоны ниже написаны на примере одной из эталонных раскладок `proshop_mern`. **Твой форк после M3-M5 почти наверняка устроен иначе** — ты сам выбирал имена сервисов, язык и файлы ещё в M3. Это норма, а не «ты что-то сломал». Заполни таблицу один раз — и дальше подставляй СВОИ значения везде, где в шаблонах стоит `<...>` или пример-путь.

| Что | Пример (варианты раскладок) | Твой форк (заполни) |
|---|---|---|
| MCP-сервер (папка/файл) | `mcp/feature_flags_server.py` **или** `mcp-features/index.js` | `<...>` |
| RAG-сервер (папка/файл) | `rag/server.js` **или** `mcp-rag/index.js` | `<...>` |
| Слой feature flags | `feature flags/` **или** `backend/features.json` | `<...>` |
| Язык MCP/RAG | Python **или** Node/JS | `<...>` |
| Test framework | `pytest` (Python) / `jest` (JS) | `<...>` |
| Mutation tool (опц.) | `mutmut` (Python) / `stryker` (JS) | `<...>` |
| Файл правил твоего AI-агента | Claude: `AGENTS.md` / `CLAUDE.md` (бывает в `.claude/`) · Cursor: `.cursor/rules/*.mdc` или `.cursorrules` · Copilot: `.github/copilot-instructions.md` · Codex: `.codex/` · OpenCode: `opencode.json` | `<...>` |
| Папка существующих docs | `docs/` **или** `project-data/` | `<...>` |
| Папка ADR | `docs/adr/` **или** `project-data/adrs/` | `<...>` |

**Про MCP/RAG-сервисы:** их расположение у всех разное — бывают top-level (`mcp/`, `mcp-servers/`, `mcp-feature-flags/`, `mcp-rag/`, `mcp-docs-search/` и десятки других имён), бывают **вложены** (`ai/mcp-*`, `backend/mcp/`, `scripts/`), на Python или на Node — **нередко оба сразу** (один сервис на Python, другой на JS, тогда и test framework для них разный). А если до MCP/RAG ты в M3-M5 ещё не дошёл — просто отметь это и ревьюй то, что есть (backend-контроллеры, middleware, routes). Не подгоняй под пример — впиши свою реальность.

**Про файл правил агента:** где лежат твои правила — зависит от инструмента: **Claude** — `AGENTS.md`/`CLAUDE.md` (иногда в `.claude/`), **Cursor** — `.cursor/rules/*.mdc` или `.cursorrules`, **Copilot** — `.github/copilot-instructions.md`, **Codex** — `.codex/`, **OpenCode** — `opencode.json`. Везде ниже, где написано «AGENTS.md», читай как «твой главный файл правил». В Stage 3 ты добавишь в него две секции (а если такого файла нет — создашь подходящий твоему агенту). Симлинк `ln -s CLAUDE.md AGENTS.md` — опционально.

---

## Карта папки сдачи

```
proshop_mern/homework-m6/
├── stage1-code-review/
│   ├── security-review.md           ← output security-mate
│   ├── performance-review.md        ← output performance-mate
│   ├── architecture-review.md       ← output architecture-mate
│   └── synthesis.md                 ← final synthesizer output
├── stage2-fix-top3/
│   ├── fix-1-<topic>.md             ← description + diff + reasoning
│   ├── fix-2-<topic>.md
│   ├── fix-3-<topic>.md
│   └── tests/                       ← characterization tests (ДО фиксов)
├── stage3-living-docs/
│   ├── 00-plan.md                   ← output /plan brainstorm — что и в каком порядке
│   ├── docs-audit.md                ← ⭐ verdict per existing doc (✅/🔄/📦/❌)
│   ├── project-index.json           ← готовый файл (копия из корня fork)
│   ├── update_project_index.py      ← скрипт обновления (копия из .claude/scripts/)
│   ├── docs-new/                    ← новая структура docs/ (копия из корня fork)
│   │   ├── README.md                ← индекс
│   │   ├── specs/                   ← *-spec.md per module
│   │   ├── adr/                     ← перенесённые из archive важные ADR
│   │   └── architecture/            ← high-level overview
│   ├── docs-archived/               ← старая docs/ как была до stage 3
│   ├── AGENTS.md (или CLAUDE.md)    ← копия корневого конфига с двумя новыми секциями
│   └── hook-screenshot.png          ← (опц.) hook сработал [update-index hook] ✅
└── stage4-tests-agent/
    ├── test-writer-mate.md          ← новое agent definition (копия из .claude/agents/)
    ├── service-1-tests/             ← сгенерированные тесты для service 1
    ├── service-2-tests/             ← сгенерированные тесты для service 2
    └── coverage-report.png          ← скриншот прохождения тестов
```

---

## ⭐ Stage 1 — Multi-Agent Code Review (~1.5-2 часа)

### 🎯 Цель

Прогнать **3 специализированных sub-agents** последовательно по своему forked-проекту и получить **synthesis.md** с топ-findings. Это контрольный документ для Stage 2.

### Почему 3 sub-agents, а не один универсальный

- Универсальный агент **расфокусирован** — найдёт ~5-7 проблем
- 3 специалиста дают **15-30 findings** (security + perf + arch)
- Final synthesizer группирует, убирает дубли, выставляет приоритеты
- В live demo вы видели Agent Team — это **production-уровень** этого паттерна

### Как именно запускать — 2 опции (выбери одну)

- **Опция A — последовательно** (рекомендуется): 3 mate'а по очереди + синтез. Проще, дешевле, контролируемо.
- **Опция B — параллельно через Agent Team**: 3 mate'а разом, обмен находками через mailbox. Быстрее, дороже по токенам, нужен experimental-флаг.

> **📌 Про размер репо и модель — важно.** В этой домашке проект небольшой. Если ты на Opus с большим контекстным окном (~1M токенов) — агент спокойно «съедает» весь репозиторий за один проход и делает полноценное ревью. Мы так и делаем здесь **умышленно**: контекста хватает на весь проект.
>
> **Но если у тебя репозиторий большой ИЛИ модель с маленьким контекстом** (например GLM, GPT-класс на ~200K токенов) — не пытайся прогнать всё одним заходом: агент захлебнётся и пропустит половину. Делай сразу по-нормальному:
> 1. Войди в **plan mode** → пусть главный агент составит план ревью (какие части репо в каком порядке).
> 2. Запускай security / performance / architecture **батчами или через sub-агентов** — по части репозитория на агента (каждый держит в контексте свой кусок).
> 3. Собери все findings в общий `synthesis.md`.
>
> Это тот же приём, что в Stage 3 для аудита больших репо (см. там «🗒️ Ноут: аудит больших репо через sub-агентов»).

#### Опция A: Sequential через Claude Code (рекомендуется)

В CC сессии запускаешь по очереди:

> **Важно про универсальность.** System prompts всех 5 mate-агентов — **полностью project-agnostic**. Project-specific контекст (стек, ADR-папка, scope) ты передаёшь в **каждом** spawn-промпте. Ниже шаблоны содержат блок `📥 КОНТЕКСТ ПРОЕКТА` на примере одной из раскладок `proshop_mern` — **подставь свои значения из Шага 0** (имена MCP/RAG-сервисов, язык, реальные пути). У каждого студента они свои — это ожидаемо.

**Шаг 1.1 — Security review:**

```
Запусти через Agent tool агента security-mate (.claude/agents/security-mate.md).

🎯 ЦЕЛЬ
Провести security-ревью всего репозитория: выдать 8-20 findings, у каждого — file:line, severity, OWASP-категория, рекомендуемый фикс.

📥 КОНТЕКСТ ПРОЕКТА (подставь свои значения из Шага 0)
- Репозиторий: форк proshop_mern (MERN + добавленные тобой сервисы: MCP / RAG / feature-flags и любые другие)
- Стек: Node + Express + Mongoose + MongoDB + React + <твой MCP: Python или Node> + <твой RAG>
- Файл правил агента (прочитать ПЕРВЫМ): <AGENTS.md / CLAUDE.md / .cursor/rules / .github/copilot-instructions.md / .codex/ …>
- ADR-папка (если есть, прочитать ПЕРВОЙ): <docs/adr/ ИЛИ project-data/adrs/>
- Авторизация: JWT, пароли через bcrypt

🔧 ШАГИ
1. Прочитай файл правил агента и ADR-папку (если есть).
2. Пройди по файлам из раздела «Файлы для ревью» ниже, ищи уязвимости: auth/доступы, инъекции, секреты в коде, небезопасные зависимости.
3. Для каждого finding укажи: file:line, severity (HIGH/MEDIUM/LOW), OWASP-категорию, рекомендуемый фикс.

🔍 ФАЙЛЫ ДЛЯ РЕВЬЮ — весь репозиторий
- Пройди по всему форку: backend/, frontend/ и все сервисы, что ты добавлял (MCP / RAG / feature-flags / dashboard / любые другие папки). Ревьюим проект целиком, а не отдельные модули.
- Вне scope: tests/ и __tests__/ (тесты пишем в Stage 4), scripts/, frontend/public/, node_modules/, build/dist

📤 РЕЗУЛЬТАТ
- homework-m6/stage1-code-review/security-findings.jsonl  — findings в JSONL
- homework-m6/stage1-code-review/security-review.md       — отчёт, сгруппированный по severity

⛔ ОГРАНИЧЕНИЯ
- Только чтение, код не меняй.
- Цель — 8-20 качественных findings (не общие фразы «в backend есть проблемы»).
```

**📋 Что произойдёт под этим промптом**
- Кто запускает: твой главный CC-агент спавнит sub-агента security-mate (один проход).
- Порядок: шаг 1.1 из 4 → потом 1.2 performance → 1.3 architecture → 1.4 синтез.
- Появятся файлы: `homework-m6/stage1-code-review/security-findings.jsonl` + `security-review.md`.
- Дальше: прочитай `security-review.md` ПЕРЕД запуском 1.2.

**Шаг 1.2 — Performance review:**

```
Запусти через Agent tool агента performance-mate (.claude/agents/performance-mate.md).

🎯 ЦЕЛЬ
Найти проблемы производительности по всему репозиторию: выдать findings с оценкой влияния.

📥 КОНТЕКСТ ПРОЕКТА (подставь свои значения из Шага 0)
- Репозиторий: форк proshop_mern (MERN + добавленные тобой сервисы: MCP / RAG / feature-flags и любые другие)
- Стек: Node + Express + Mongoose + MongoDB + React + <твой MCP: Python или Node> + <твой RAG>
- Файл правил агента (прочитать ПЕРВЫМ): <AGENTS.md / CLAUDE.md / .cursor/rules / .github/copilot-instructions.md / .codex/ …>
- ADR-папка (если есть, прочитать ПЕРВОЙ): <docs/adr/ ИЛИ project-data/adrs/>
- Авторизация: JWT, пароли через bcrypt
- Рантаймы в scope: Node.js event loop (Express + RAG) + Python sync (MCP-сервер).
- Известные горячие пути: /api/orders, /api/products (список), endpoint feature-flag в MCP.

🔧 ШАГИ
1. Пройди по файлам из раздела «Файлы для ревью» ниже.
2. Ищи: N+1 запросы, отсутствие пагинации, блокирующий I/O, отсутствие кэширования.
3. Для каждого finding укажи оценку влияния (например «+200ms p95» или «+5MB памяти») и рекомендуемый фикс.
4. Если есть пересечение с security-review.md (например ReDoS) — сошлись на него.

🔍 ФАЙЛЫ ДЛЯ РЕВЬЮ — весь репозиторий
- Пройди по всему форку: backend/, frontend/ и все сервисы, что ты добавлял (MCP / RAG / feature-flags / dashboard / любые другие папки). Ревьюим проект целиком, а не отдельные модули.
- Вне scope: tests/ и __tests__/ (тесты пишем в Stage 4), scripts/, frontend/public/, node_modules/, build/dist

📤 РЕЗУЛЬТАТ
- homework-m6/stage1-code-review/performance-findings.jsonl
- homework-m6/stage1-code-review/performance-review.md
```

**📋 Что произойдёт под этим промптом**
- Кто запускает: главный CC-агент спавнит sub-агента performance-mate (один проход).
- Порядок: шаг 1.2 из 4 → дальше 1.3 architecture.
- Появятся файлы: `performance-findings.jsonl` + `performance-review.md` в папке `homework-m6/stage1-code-review/`.

**Шаг 1.3 — Architecture review:**

```
Запусти через Agent tool агента architecture-mate (.claude/agents/architecture-mate.md).

🎯 ЦЕЛЬ
Оценить архитектуру всего репозитория: слои, границы, нарушения, кандидаты в новые ADR.

📥 КОНТЕКСТ ПРОЕКТА (подставь свои значения из Шага 0)
- Репозиторий: форк proshop_mern (MERN + добавленные тобой сервисы: MCP / RAG / feature-flags и любые другие)
- Стек: Node + Express + Mongoose + MongoDB + React + <твой MCP: Python или Node> + <твой RAG>
- Файл правил агента (прочитать ПЕРВЫМ): <AGENTS.md / CLAUDE.md / .cursor/rules / .github/copilot-instructions.md / .codex/ …>
- ADR-папка (если есть, прочитать ПЕРВОЙ): <docs/adr/ ИЛИ project-data/adrs/>
- Авторизация: JWT, пароли через bcrypt
- Конвенция слоёв: controller → service → model (Mongoose). MCP и RAG живут в своих папках со своей внутренней слоёвкой.
- Прочитай docs/adr/*.md ПЕРВЫМ, если есть.

🔧 ШАГИ
1. Прочитай существующие ADR (если есть).
2. Пройди по файлам из раздела «Файлы для ревью» ниже; оцени слои, связность, нарушения границ.
3. Для каждого finding укажи criticality (C1/C2/C3) и рекомендуемый фикс.
4. Предложи 1-2 новых ADR, если найдёшь недокументированные архитектурные решения.
5. Сошлись на security-review.md и performance-review.md при пересечениях.

🔍 ФАЙЛЫ ДЛЯ РЕВЬЮ — весь репозиторий
- Пройди по всему форку: backend/, frontend/ и все сервисы, что ты добавлял (MCP / RAG / feature-flags / dashboard / любые другие папки). Ревьюим проект целиком, а не отдельные модули.
- Вне scope: tests/ и __tests__/ (тесты пишем в Stage 4), scripts/, frontend/public/, node_modules/, build/dist

📤 РЕЗУЛЬТАТ
- homework-m6/stage1-code-review/architecture-findings.jsonl
- homework-m6/stage1-code-review/architecture-review.md
```

**📋 Что произойдёт под этим промптом**
- Кто запускает: главный CC-агент спавнит sub-агента architecture-mate (один проход).
- Порядок: шаг 1.3 из 4 → дальше 1.4 синтез.
- Появятся файлы: `architecture-findings.jsonl` + `architecture-review.md` + предложения ADR.

**Шаг 1.4 — Final synthesizer:**

```
🎯 ЦЕЛЬ
Собрать 3 отчёта в один контрольный synthesis.md с Top-3 для Stage 2.

🔧 ШАГИ
1. Прочитай все 3 отчёта (security-review.md, performance-review.md, architecture-review.md).
2. Сгруппируй findings по SEVERITY (HIGH / MEDIUM / LOW).
3. Внутри severity сгруппируй связанные (например все про auth).
4. Убери дубли между агентами (если security и architecture нашли одно и то же).
5. Добавь «Рекомендуемый порядок фиксов» — топ-5 чинить первыми.
6. Добавь «Top-3 для Stage 2» — явный список с file:line + предлагаемый подход к фиксу.

📤 РЕЗУЛЬТАТ
- homework-m6/stage1-code-review/synthesis.md
```

**📋 Что произойдёт под этим промптом**
- Кто запускает: главный CC-агент сам (читает 3 файла, без спавна).
- Порядок: шаг 1.4 из 4 — финал Stage 1.
- Появится файл: `synthesis.md` — он же вход для Stage 2 И для Stage 3 (переиспользуем, не пересчитываем).

#### Опция B: Agent Team (если включил experimental hook)

Если у тебя `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` в `.claude/settings.local.json` — вместо 4 последовательных запусков можно запустить команду из 3 mate'ов разом (они работают параллельно и обмениваются находками через mailbox). Промт целиком:

```
Запусти agent team из .claude/agents/ для ревью всего репозитория.

🎯 ЦЕЛЬ
Параллельно прогнать 3 mate'а (security / architecture / performance) по всему репозиторию,
дать им обмениваться кросс-категорийными находками через mailbox, затем собрать общий synthesis.md.

📥 КОНТЕКСТ ПРОЕКТА (подставь свои значения из Шага 0)
- Репозиторий: форк proshop_mern (MERN + добавленные тобой сервисы: MCP / RAG / feature-flags и любые другие)
- Стек: Node + Express + Mongoose + MongoDB + React + <твой MCP: Python или Node> + <твой RAG>
- Файл правил агента (прочитать ПЕРВЫМ): <AGENTS.md / CLAUDE.md / .cursor/rules / .github/copilot-instructions.md / .codex/ …>
- ADR-папка (если есть, прочитать ПЕРВОЙ): <docs/adr/ ИЛИ project-data/adrs/>
- Авторизация: JWT, пароли через bcrypt

👥 КОМАНДА (3 teammate'а из .claude/agents/)
- security-mate     → ищет уязвимости (auth/доступы, инъекции, секреты, OWASP)
- performance-mate  → ищет N+1, отсутствие пагинации, блокирующий I/O, кэширование
- architecture-mate → оценивает слои/границы/нарушения, предлагает 1-2 новых ADR

🔧 ШАГИ
1. Заспавни команду из 3 teammate'ов выше.
2. Каждый пишет свой отчёт: homework-m6/stage1-code-review/security-review.md /
   performance-review.md / architecture-review.md. У каждого finding — file:line, severity, рекомендуемый фикс.
3. Включи peer-to-peer mailbox: если один mate нашёл проблему вне своей категории — пусть пингует профильного.
4. Когда все 3 закончат — собери homework-m6/stage1-code-review/synthesis.md:
   - сгруппируй findings по SEVERITY (HIGH / MEDIUM / LOW);
   - внутри severity сгруппируй связанные (например все про auth);
   - убери дубли между mate'ами;
   - добавь «Рекомендуемый порядок фиксов» — топ-5 чинить первыми;
   - добавь «Top-3 для Stage 2» — явный список с file:line + предлагаемый подход к фиксу.

🔍 ФАЙЛЫ ДЛЯ РЕВЬЮ — весь репозиторий
- Пройди по всему форку: backend/, frontend/ и все сервисы, что ты добавлял (MCP / RAG / feature-flags / dashboard / любые другие папки). Ревьюим проект целиком, а не отдельные модули.
- Вне scope: tests/ и __tests__/ (тесты пишем в Stage 4), scripts/, frontend/public/, node_modules/, build/dist

📤 РЕЗУЛЬТАТ
- homework-m6/stage1-code-review/security-review.md
- homework-m6/stage1-code-review/performance-review.md
- homework-m6/stage1-code-review/architecture-review.md
- homework-m6/stage1-code-review/synthesis.md  (с секцией «Top-3 для Stage 2»)

⛔ ОГРАНИЧЕНИЯ
- Только чтение, код не меняй.
- Каждый mate — 8-20 качественных findings (file:line, не общие фразы).
```

**📋 Что произойдёт под этим промптом**
- Кто запускает: твой главный CC-агент создаёт agent team из 3 teammate'ов (работают параллельно, общаются через mailbox).
- Порядок: 3 mate'а параллельно → затем главный агент собирает synthesis.md.
- Появятся файлы: 3 *-review.md + synthesis.md в `homework-m6/stage1-code-review/`.
- Отличие от Опции A: те же 4 артефакта, но mate'ы бегут параллельно и обмениваются находками (дороже по токенам, быстрее по времени).

### Что должно появиться в `synthesis.md`

> *Пути и номера строк в примере ниже — иллюстративные (на примере одной из раскладок). У тебя будут твои файлы из Шага 0.*

```markdown
# Code Review Synthesis — proshop_mern (homework M6 Stage 1)

**Date:** 2026-MM-DD
**Reviewer:** 3-agent team (security + performance + architecture)
**Scope:** весь репозиторий

## HIGH severity (N findings)

1. **mcp/feature_flags_server.py:42** — Hardcoded JWT secret
   - Source: security-mate
   - Fix approach: move to env var + rotate
   - Estimated effort: 30 min

2. **rag/server.js:78** — N+1 query in /search endpoint
   - Source: performance-mate
   - Fix approach: batch .populate('vector_id')
   - Estimated effort: 1 hour

## MEDIUM severity (N findings)
...

## Top-3 для Stage 2

| # | File:line | Issue | Recommended fix | Effort |
|---|---|---|---|---|
| 1 | mcp/feature_flags_server.py:42 | Hardcoded JWT | Move to env | 30m |
| 2 | rag/server.js:78 | N+1 query | populate batch | 1h |
| 3 | backend/controllers/featureFlagController.js:23 | Direct file write violates AGENTS.md rule | Route through MCP | 30m |

## Cross-mate observations
...
```

### 📤 Output Checklist Stage 1 (бинарно — пройдитесь ПЕРЕД переходом на Stage 2)

#### Файлы

- [ ] `homework-m6/stage1-code-review/security-review.md` существует
- [ ] `homework-m6/stage1-code-review/performance-review.md` существует
- [ ] `homework-m6/stage1-code-review/architecture-review.md` существует
- [ ] `homework-m6/stage1-code-review/synthesis.md` существует

#### Security review

- [ ] ≥ 5 findings в `security-review.md`
- [ ] У каждого finding указан `file:line` (не общие фразы «в backend есть проблемы»)
- [ ] У каждого finding указан severity (HIGH / MEDIUM / LOW)
- [ ] У каждого finding указан OWASP category (если применимо)
- [ ] У каждого finding указан рекомендуемый fix approach

#### Performance review

- [ ] ≥ 5 findings в `performance-review.md`
- [ ] У каждого finding есть estimated impact (`+200ms p95` или `+5MB memory`)
- [ ] Минимум 1 finding касается N+1 / blocking I/O / memory
- [ ] У каждого finding указан рекомендуемый fix approach

#### Architecture review

- [ ] ≥ 5 findings в `architecture-review.md`
- [ ] Прочитаны существующие `docs/adr/*.md` (если есть) и упомянуты в reviews
- [ ] Найдены минимум 1-2 предложения новых ADR
- [ ] У каждого finding указан criticality (C1 / C2 / C3)

#### Synthesis.md

- [ ] Findings сгруппированы по SEVERITY (HIGH / MEDIUM / LOW секции)
- [ ] HIGH severity содержит **≥ 2 finding'а**
- [ ] Явная секция **«Top-3 для Stage 2»** с таблицей: file:line / issue / fix approach / effort estimate
- [ ] Cross-mate observations отмечены (минимум 1 finding флагнули ≥ 2 разных mate'а)
- [ ] Total token usage estimate (для cost awareness)

### Recipe-ссылки

- [`6.1-ai-code-review/claude-code-review-setup.md`](https://github.com/Serg1kk/aidev-course-materials/blob/main/M6/6.1-ai-code-review/claude-code-review-setup.md) — все 4 способа запуска review
- [`agents/`](https://github.com/Serg1kk/aidev-course-materials/tree/main/M6/agents) — готовые mate-агенты (security/architecture/performance/legacy-auditor/test-writer) + README со схемой вызова
- [`6.1-ai-code-review/honest-risks.md`](https://github.com/Serg1kk/aidev-course-materials/blob/main/M6/6.1-ai-code-review/honest-risks.md) — что не делать

---

## ⭐ Stage 2 — Fix Top-3 из synthesis.md (~1.5-2 часа)

### 🎯 Цель

Из `homework-m6/stage1-code-review/synthesis.md` берём **3 самых критичных findings** (из секции «Top-3») и чиним через safe-refactor recipe из Topic 6.3.

### Workflow для каждого из 3 fix'ов

#### Шаг 2.1 — Characterization tests ПЕРЕД фиксом

В CC сессии:

```
🎯 ЦЕЛЬ
Написать характеризационные тесты, фиксирующие ТЕКУЩЕЕ поведение кода для finding #1
(перед фиксом) — чтобы поймать непреднамеренные поломки при фиксе.

📥 КОНТЕКСТ
- Прочитай homework-m6/stage1-code-review/synthesis.md, возьми finding #1 (верх списка).
- Затронутый файл — например mcp/feature_flags_server.py.

🔧 ШАГИ
1. Сгенерируй характеризационные тесты, которые пинят ТЕКУЩЕЕ поведение — даже если оно неправильное.
2. Используй pytest (Python) или jest (JS).
3. Запусти тесты. Они ДОЛЖНЫ проходить на текущем коде. Если не проходят — правь ТЕСТ, а не код (мы фиксируем как есть сейчас).

📤 РЕЗУЛЬТАТ
- homework-m6/stage2-fix-top3/tests/test-<finding-1-short-name>.py (или .js)

⛔ ОГРАНИЧЕНИЯ
- Код не меняй — только пишем тесты.
```

**Важно:** характеризационные тесты пишутся ДО фикса и проходят на ТЕКУЩЕМ коде — фиксируют поведение «как есть сейчас».

⚠️ **Два типа тестов — держи разницу (это ключ к Stage 2):**
- **Тесты на поведение, которое ты НЕ меняешь** (смежная логика) → твоя «контрольная»: после фикса остаются зелёными. Упали — фикс задел лишнее.
- **Тест на ровно то поведение, которое ЧИНИШЬ** (напр. security: «админ-endpoint открыт всем» → «требует auth») → он запинил СТАРОЕ (неправильное) поведение и после фикса ОБЯЗАН упасть. Это не «ты сломал» — это сигнал, что намеренное изменение сработало. В Шаге 2.2 ты осознанно перепишешь его под новое корректное поведение.

#### Шаг 2.2 — Применить фикс с явными «Do NOT»

```
🎯 ЦЕЛЬ
Применить фикс для finding #1 безопасно (без задевания смежного кода).

📥 КОНТЕКСТ
- Вставь recommended_fix из synthesis.md для finding #1.

🔧 ШАГИ
1. Примени фикс по подходу из synthesis.md.
2. Соблюдай ограничения «Do NOT» (ниже).
3. Перезапусти характеризационные тесты из Шага 2.1 и разбери результат по правилам ниже.

⛔ ОГРАНИЧЕНИЯ (Do NOT)
- НЕ меняй публичный API файла (сигнатуры, формы ответов).
- НЕ трогай логику обработки ошибок (если это не сам фикс).
- НЕ удаляй существующее логирование.
- НЕ трогай другие файлы без явной необходимости.
- НЕ добавляй новые зависимости.

📤 РЕЗУЛЬТАТ — как читать перезапуск тестов
- Тесты на поведение, которое ты НЕ собирался менять → ДОЛЖНЫ остаться зелёными (доказывает: смежная логика цела).
- Тест(ы) на поведение, которое ты только что починил → теперь УПАДУТ, потому что ты намеренно изменил это поведение. ОБНОВИ их под НОВОЕ корректное поведение и добавь комментарий «intentional behavior change — см. fix-N.md».
- Если упал тест, который ты менять НЕ собирался → СТОП, объясни (скорее всего что-то сломал).
```

**Почему так:** правило «не подгоняй тесты под зелёное» относится к РЕФАКТОРИНГУ (поведение не меняется — упал тест = что-то сломал). Фикс бага/security — это НАМЕРЕННОЕ изменение поведения: тест на него положено обновить под новый корректный результат. Это правка спеки, а не жульничество.

#### Шаг 2.3 — Документация фикса

```
🎯 ЦЕЛЬ
Задокументировать фикс finding #1.

🔧 ШАГИ — создай homework-m6/stage2-fix-top3/fix-1-<short-name>.md с разделами:
1. Исходный finding (копия из synthesis.md)
2. Что изменил (diff)
3. Почему такой подход (trade-offs, 2-3 предложения)
4. Статус тестов (скриншот/вывод pytest/npm test)
5. Behavior change: было ли намеренно изменено поведение/контракт; какой тест обновлён и почему (если фикс чисто рефакторинг — «нет»)
6. Выводы (1-2 предложения про неочевидное)
```

#### Повторить шаги 2.1-2.3 для findings #2 и #3

### Recipe-ссылки

- [`6.3-legacy-strategies/recipe-risk-mitigation.md`](https://github.com/Serg1kk/aidev-course-materials/blob/main/M6/6.3-legacy-strategies/recipe-risk-mitigation.md) — 7 правил безопасного рефактора
- [`6.3-legacy-strategies/legacy-incidents.md`](https://github.com/Serg1kk/aidev-course-materials/blob/main/M6/6.3-legacy-strategies/legacy-incidents.md) — что бывает когда не пишешь характеризационные тесты

### 📤 Output Checklist Stage 2 (бинарно)

#### Файлы

- [ ] `homework-m6/stage2-fix-top3/fix-1-<short-name>.md` существует
- [ ] `homework-m6/stage2-fix-top3/fix-2-<short-name>.md` существует
- [ ] `homework-m6/stage2-fix-top3/fix-3-<short-name>.md` существует
- [ ] `homework-m6/stage2-fix-top3/tests/` папка содержит тесты для **всех 3** finding'ов

#### Per fix-N.md содержит

- [ ] **Original finding** — copy-paste из `synthesis.md`
- [ ] **What I changed** — git diff (или скриншот diff'а)
- [ ] **Why this approach** — 2-3 предложения trade-offs (почему так, а не иначе)
- [ ] **Test status** — скриншот / output `pytest` / `npm test` показывает все тесты passing
- [ ] **Lessons learned** — 1-2 предложения про неочевидное (что AI пропустил / что я понял)

#### Characterization tests

- [ ] Тесты написаны **ДО** фикса (в commit history видно что test commit раньше fix commit)
- [ ] Все тесты проходят на **исходном** коде (фиксируют поведение «как есть»)
- [ ] **Не-целевые** тесты (поведение, которое НЕ менял) проходят и на исправленном коде (фикс не задел смежное)
- [ ] **Целевой** тест (поведение, которое чинил) обновлён под новое корректное поведение + помечен «intentional behavior change» со ссылкой на fix-N.md
- [ ] Минимум 3 теста на каждый finding (happy path + 1 edge case + 1 error path)

#### Качество fix'ов

- [ ] Ни один fix не нарушил публичный API (signature функций, response shapes)
- [ ] Ни один fix не добавил новые dependencies
- [ ] Каждый fix < 200 строк изменений
- [ ] Каждый fix имеет отдельный git commit с conventional message: `fix(<scope>): ...`

#### Финал

- [ ] Все 3 fix'а закоммичены и запушены
- [ ] Все характеризационные тесты в CI зелёные (если CI настроен) или локально passing

---

## ⭐ Stage 3 — Legacy Audit + Living Documentation (через `/plan`) (~2.5-3.5 часа)

### 🎯 Цель

В CC сессии запустить `/plan` brainstorm и через него получить **полный living documentation pack** для своего fork`а:

1. `project-index.json` в корне (Layer 8 — машиночитаемая карта)
2. Новая структура `docs/` со spec'ами всех модулей проекта (Layer 5 — Architecture / Specs)
3. `update_project_index.py` для автообновления (Layer 8 maintenance)
4. (опц.) Claude Code hook на PostToolUse
5. Обновлённый `AGENTS.md` с секциями про project-index + 4-step pattern
6. Старая `docs/` папка заархивирована (`docs-archived-YYYY-MM-DD/`)

**Главная идея:** `project-index.json` не делается отдельно — он **рождается** из планирования audit'а проекта. План main agent'а **включает** создание индекса как один из шагов.

### Почему planning mode

На занятии я объяснил: для multi-step analysis НЕЛЬЗЯ просто говорить «проанализируй всё». Главный агент:

1. Сначала **планирует** что и в каком порядке делать
2. Создаёт TODO с конкретными подзадачами
3. Прогоняет 4-step паттерн на каждом модуле по очереди
4. Параллельно собирает project-index.json
5. В конце создаёт новую docs/ структуру и обновляет AGENTS.md

Это и есть `/plan` mode в Claude Code (Shift+Tab+Tab или `/plan` команда).

### Workflow

#### Шаг 3.1 — Найди свою папку с существующими docs (НЕ архивируй вслепую)

У тебя живые docs могут лежать в `docs/`, в `project-data/`, или раскиданы по корню — зависит от того, как ты строил M3-M5. Сначала найди их:

```bash
cd <your-fork>
ls docs/ 2>/dev/null; ls project-data/ 2>/dev/null   # где твоя живая структура?
```

⚠️ **Не делай `git mv docs/ docs-archived/` прямо сейчас.** Архивация — это **последний** шаг (Phase 4), а не первый. Сначала `legacy-auditor-mate` в **Phase 1.5** классифицирует каждый файл (✅/🔄/📦/❌), и только потом архивируется лишь то, что реально устарело (📦/❌). Если заархивируешь всё в начале — потеряешь актуальные доки, которые надо было сохранить. Просто впиши путь к своей docs-папке в Шаг 0.

#### Шаг 3.2 — Войти в роль `legacy-auditor-mate` (НЕ через Task!)

⭐ **Главное отличие от других стейджей:** мы используем **специального orchestrator-агента** (`legacy-auditor-mate`) который САМ планирует и запускает sub-agents.

⚠️ **КРИТИЧНО:** этого агента **НЕЛЬЗЯ запускать через Task tool как sub-agent**. Почему: sub-agent через Task получает ограниченный набор tools и **не может сам спавнить другие sub-agents**. А auditor должен спавнить security/performance/architecture mate'ов. Поэтому:

- ❌ **НЕ делай так:** `Use the Task tool to spawn legacy-auditor-mate`
- ✅ **Делай так:** в main CC сессии пишешь «Read .claude/agents/legacy-auditor-mate.md and act according to that role» — CC **входит в роль** auditor'а сам, оставаясь в главной сессии с полным набором tools (включая Task для дочерних спавнов).

Verify что у тебя в `.claude/agents/` уже лежат все 5 mate-файлов (после Pre-requisites):

```bash
ls .claude/agents/
# security-mate.md
# performance-mate.md
# architecture-mate.md
# legacy-auditor-mate.md  ← orchestrator для этого Stage
# test-writer-mate.md     ← пригодится в Stage 4
```

Если чего-то нет — пересмотри Pre-requisites выше (там `cp aidev-course-materials/M6/agents/*.md .claude/agents/`).

**Заметка про размер репо.** На маленьком репо (как proshop) auditor аудитит существующие доки сам — контекста хватает, один агент справляется и с планом, и с аудитом. На большом репо с кучей документов читать их все самому = переполнение контекста. Тогда выноси аудит доков в sub-агентов: по агенту на папку доков, каждый классифицирует свои файлы (✅/🔄/📦/❌) по шаблону `docs-audit.template.md` и возвращает вердикты. Готовый пример промта — в конце Stage 3 («Ноут: аудит больших репо»).

**Войди в роль auditor'а + активируй plan mode.** В main CC сессии:

1. **Включи plan mode:** нажми `Shift+Tab+Tab` (toggle) ИЛИ напиши `/plan` в начале промпта
2. **Вставь промпт role-entry** (контекст ниже подобран под `proshop_mern` — поправь поля под свой fork если изменил структуру):

```
/plan

Прочитай .claude/agents/legacy-auditor-mate.md и действуй согласно этой роли
до конца разговора. Следуй своему phase-workflow.

🎯 ЦЕЛЬ
Собрать living-documentation pack для моего форка: project-index.json + specs всех модулей проекта
+ обновлённый AGENTS.md + аккуратная чистка docs/. Аудитим и документируем весь репозиторий, а не
отдельные модули. Findings code-review берём готовыми из Stage 1 synthesis.md.

📥 КОНТЕКСТ ПРОЕКТА (подставь свои значения из Шага 0)
- Репозиторий: форк proshop_mern (MERN + добавленные тобой сервисы: MCP / RAG / feature-flags и любые другие)
- Тип: fullstack-monorepo
- Стек: Node + Express + Mongoose + MongoDB + React + <твой MCP: Python или Node> + <твой RAG>
- Подпроекты найди сам: backend/, frontend/, <твой MCP>, <твой RAG>, возможно другие.
  ⚠️ MCP/RAG бывают top-level, вложены (ai/, backend/, scripts/, .codex/) или отсутствуют — обойди всё дерево.
- Существующие доки: ищи сам (docs/, project-data/ или в корне) — аудируй аккуратно, не сноси вслепую.
- Scope аудита: весь репозиторий — весь код + вся документация (не только то, что добавлял в прошлых модулях).
- Папка результатов: homework-m6/stage3-living-docs/
- Готовый вход: homework-m6/stage1-code-review/synthesis.md (findings уже есть — переиспользуй).

🔧 ФАЗЫ (что делаешь по шагам)
1. Phase 1 — DISCOVERY: обойди структуру, определи стек по манифестам, найди подпроекты.
2. Phase 1.5 — АУДИТ ДОКОВ: классифицируй каждую docs-папку и top-level MD по
   ✅ ACCURATE / 🔄 PARTIALLY / 📦 HISTORICAL / ❌ STALE (шаблон .claude/agents/templates/docs-audit.template.md).
   На большом репо вынеси в sub-агентов (см. ноут в конце Stage 3). → homework-m6/stage3-living-docs/docs-audit.md
3. Phase 2 — PLAN: напиши homework-m6/stage3-living-docs/00-plan.md с полным TODO, ссылаясь на вердикты docs-audit.md. ОСТАНОВИСЬ на approval.
4. Phase 3 — REVERSE-ENG: findings уже собраны на Stage 1 — используй готовый
   homework-m6/stage1-code-review/synthesis.md как findings-вход. Сделай 4-step reverse engineering по каждому
   модулю (сам serial — или sub-агентами на большом репо). Specs → docs/specs/<module>-spec.md в корне форка
   (в submission попадут как docs-new/specs/ — см. Шаг 3.7).
5. Phase 4 — AGGREGATE: собери specs + findings из synthesis.md в НОВЫЙ файл
   homework-m6/stage3-living-docs/stage3-synthesis.md (Stage 1 synthesis.md используй только на чтение —
   это оценённый артефакт). Собери docs-new/ из ✅/🔄 доков + новых specs. В КОНЦЕ: твою живую docs-папку
   (docs/ ИЛИ project-data/) → docs-archived-YYYY-MM-DD/ (архивируй 📦/❌ по вердиктам Phase 1.5).
6. Phase 5 — AUTOMATE: создай project-index.json, скопируй update_project_index.py, настрой hook, обнови AGENTS.md.

⛔ ОГРАНИЧЕНИЯ
- В Phase 1, 1.5, 2 — только Plan mode (read-only). Жди моего approval перед Phase 3-5.
- НЕ сноси все доки — решай по вердиктам Phase 1.5.
- Спавни sub-агентов через Task (ты главная сессия, у тебя полный набор tools).
- ADR-папку не трогай; характеризационные тесты не удаляй.
- Явно объявляй переход между фазами.

📎 Прочитать в Phase 1:
- .claude/agents/templates/docs-audit.template.md
- aidev-course-materials/M6/6.2-living-documentation/{multi-level-docs-stack,keeping-docs-current,project-index.example.json}
- aidev-course-materials/M6/6.3-legacy-strategies/recipe-cc-reverse-engineering.md
- aidev-course-materials/M6/6.2-living-documentation/example-hooks/update_project_index.py
```

**📋 Что произойдёт под этим промптом**
- Кто запускает: твой главный CC-агент ВХОДИТ В РОЛЬ auditor (не через Task!) и сам оркестрирует.
- Порядок: Phase 1 → 1.5 → 2 (Plan mode, сам) → [твой approval] → Phase 3 reverse-eng (сам serial или sub-агентами) → Phase 4 сборка docs → Phase 5 project-index + hook + AGENTS.md.
- Появятся файлы: `homework-m6/stage3-living-docs/{00-plan.md, docs-audit.md, project-index.json, update_project_index.py, docs-new/, docs-archived/}` + секции в AGENTS.md.
- Важно: Phase 3 НЕ гоняет security/perf/arch заново — берёт готовый Stage 1 `synthesis.md`.

`legacy-auditor-mate` (твой main CC в этой роли) выполнит **Phase 1 + 1.5 (Existing Docs Audit) + Phase 2** и **остановится** на запросе approval. Прочитай **сначала `docs-audit.md`** (что предлагается сохранить / обновить / архивировать) — это самое важное решение в этом стейдже. Потом `00-plan.md` с TODO. Если согласен:

```
План одобрен. Переключайся в EXECUTE mode и выполняй Phase 3-5.
Обновляй 00-plan.md галочками по мере выполнения каждого TODO.
```

Auditor сам:
- **Использует** готовый `homework-m6/stage1-code-review/synthesis.md` как findings-вход (findings со Stage 1 берёт готовыми)
- Применяет 4-step reverse engineering на каждом модуле (сам serial — или sub-агентами на большом репо)
- Синтезирует specs + findings в `stage3-synthesis.md`
- Строит `project-index.json`
- Создаёт новую `docs/` структуру (из ✅/🔄 доков + новых specs)
- Настраивает script + hook
- Обновляет AGENTS.md

**Если что-то пошло не так** — auditor обновит `00-plan.md` с пометкой проблемы и спросит тебя. Не пытайся всё делать руками — позволь orchestrator работать.

#### Шаг 3.3 — Per-module reverse engineering (4-step pattern из 6.3)

**Это часть основного аудита, а не отдельный запуск.** Отдельно этот промт копировать НЕ нужно. Auditor выполняет 4-step reverse engineering сам внутри Phase 3 (в том же одном прогоне, что ты запустил в Шаге 3.2): после него он и specs соберёт, и доки задокументирует. Определение 4 шагов auditor берёт из файла `recipe-cc-reverse-engineering.md` — он читает его в Phase 1 (ссылка есть в role-entry промте Шага 3.2, блок «📎 Прочитать в Phase 1»). Поэтому отдельный промт ему не передаётся — рецепт уже у него.

Ниже показано, **что именно** auditor делает по каждому модулю — чтобы ты мог проверить его output. А если захочешь прогнать один модуль вручную (например auditor его пропустил) — скопируй этот промт и подставь путь модуля.

**Маленький / средний репо** (как proshop) — auditor делает сам, по одному модулю за раз (serial). Контекста хватает.

**Большой репо** (много модулей/доков) — auditor не тянет всё сам в один контекст. Тогда он спавнит параллельных sub-агентов: по одному на модуль, каждому даёт промт ниже. До ~10 параллельно работает стабильно. Готовый пример промта для дисптача — в конце Stage 3 («Ноут: аудит больших репо»).

**Что auditor делает по каждому модулю (можешь скопировать для ручного прогона одного модуля):**

```
🎯 ЦЕЛЬ
Reverse-engineering одного модуля (<module-path>, например mcp/feature_flags_server.py):
понять логику и собрать spec.

📥 КОНТЕКСТ
- Прочитай AGENTS.md первым (конвенции проекта).

🔧 ШАГИ
1. UNDERSTAND (~2 мин): опиши бизнес-логику простым языком — какие endpoints/функции, какие правила, edge cases, допущения о данных. Вывод: ~300 слов markdown.
2. DECISION TABLE (~2 мин): таблица решений по всем условным конструкциям. Колонки: condition / then-action / else-action / edge_case. 10-15 строк.
3. MERMAID DIAGRAM (~2 мин): sequenceDiagram для основного потока + 1 путь ошибки. Включи middleware, запросы к БД, ответ.
4. EDGE CASES (~1.5 мин): перечисли ВСЕ edge cases — гонки, частичные сбои, вредоносный ввод, обход auth, эскалация прав. 15-30 пунктов.

📤 РЕЗУЛЬТАТ — docs/specs/<module>-spec.md с разделами:
1. # Overview (шаг 1)
2. ## Decision Table (шаг 2)
3. ## Sequence Diagram (шаг 3 — mermaid-блок)
4. ## Edge Cases (шаг 4)
5. ## Open Questions (что осталось неясно)
6. ## Suggested Characterization Tests (на основе edge cases)
```

**📋 Что произойдёт под этим промптом**
- Кто запускает: auditor сам (serial) на маленьком репо, ИЛИ по sub-агенту на модуль на большом.
- Порядок: внутри Phase 3, после approval плана.
- Появится файл: `docs/specs/<module>-spec.md` (в submission попадёт как `docs-new/specs/`).

#### Шаг 3.4 — project-index.json и update script (CC делает в рамках плана)

CC сам создаст `project-index.json` на основе walked структуры репо. Проверь что включено:

- `name`, `type`, `description`, `tech_stack`
- `subprojects` — annotated (mcp, rag, backend, frontend, feature flags)
- `system_folders` — `.claude/`, `docs/`, `uploads/`
- `root_files` — annotated
- `hard_rules` — минимум 5 (включая «ALWAYS read project-index.json FIRST»)
- `ai_routing` — какие MCP-tools для каких вопросов
- `filesystem_tree` — depth 4
- `last_updated` — ISO timestamp

Скрипт `update_project_index.py` копируется из (папки `.claude/scripts/` может ещё не быть — создаём):

```bash
mkdir -p .claude/scripts
cp aidev-course-materials/M6/6.2-living-documentation/example-hooks/update_project_index.py \
   .claude/scripts/update_project_index.py
chmod +x .claude/scripts/update_project_index.py
```

**Адаптируй `WATCH_PATHS`** в скрипте под СВОИ критичные директории (из Шага 0 — у тебя они называются иначе):

```python
# подставь свои реальные имена папок:
WATCH_PATHS = ("backend/", "frontend/src/", "<твой-mcp>/", "<твой-rag>/", "<твой-feature-flags-путь>/")
# пример для одной из раскладок: ("backend/", "frontend/src/", "mcp-features/", "mcp-rag/", "backend/")
```

Тест standalone:

```bash
python3 .claude/scripts/update_project_index.py
# Должно вывести: [update-index manual] ✅ updated project-index.json
# Или: [update-index manual] no structural change, last_updated NOT bumped
```

#### Шаг 3.5 (опционально) — Подключить Claude Code hook

В `.claude/settings.json` (или `settings.local.json`) добавь:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit|Bash",
        "hooks": [
          {
            "type": "command",
            "command": "python3 \"$CLAUDE_PROJECT_DIR/.claude/scripts/update_project_index.py\""
          }
        ]
      }
    ],
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "echo '✅ Read project-index.json first for repo structure.'"
          }
        ]
      }
    ]
  }
}
```

**Тест:** в свежей CC сессии попроси «создай test файл в backend/services/`. На stderr должно появиться:

```
[update-index hook] triggered by Write on backend/services/test.js
[update-index hook] ✅ updated project-index.json (tree + last_updated)
```

Скриншот этого момента → `homework-m6/stage3-living-docs/hook-screenshot.png`.

#### Шаг 3.6 — Обновить корневой AI-конфиг (AGENTS.md ИЛИ CLAUDE.md) (CC делает в рамках плана)

> Добавляй секции в свой файл правил агента из Шага 0 (`CLAUDE.md`/`AGENTS.md`, `.cursor/rules/`, `.github/copilot-instructions.md`, `.codex/`, `opencode.json`…). Нет такого файла — создай подходящий твоему инструменту. Главное — чтобы обе секции реально присутствовали; это и проверяется в чеклисте (никакой diff сдавать не нужно).

CC добавит две секции в начало твоего корневого конфига:

```markdown
## ⭐ НАЧНИ ОТСЮДА — навигация по репо

**ВСЕГДА читай `project-index.json` ПЕРВЫМ** в начале каждой сессии.

В нём:
- subprojects — аннотированная карта всех подпроектов
- system_folders — .claude/, docs/, uploads/ с назначением
- hard_rules — правила проекта
- filesystem_tree — полное дерево (автообновляется, глубина 4)

Это быстрее find/tree/ls, точно и машиночитаемо.

## ⭐ Держи project-index.json актуальным — ОБЯЗАТЕЛЬНО

**ВСЕГДА** обновляй `project-index.json` когда:
- создаёшь файл/папку
- удаляешь/переименовываешь файлы или папки
- меняешь назначение подпроекта

Как: `python3 .claude/scripts/update_project_index.py`
Или: автоматически через PostToolUse hook (см. .claude/settings.local.json)

Для 4-step анализа новых модулей — примеры в docs/specs/.
```

#### Шаг 3.7 — Скопировать всё в submission папку

```bash
mkdir -p homework-m6/stage3-living-docs
cp project-index.json homework-m6/stage3-living-docs/
cp .claude/scripts/update_project_index.py homework-m6/stage3-living-docs/
# твоя НОВАЯ docs-структура (та, что собрал auditor) → docs-new/:
cp -r docs/ homework-m6/stage3-living-docs/docs-new/
mv docs-archived-* homework-m6/stage3-living-docs/docs-archived/  # если ещё не было
# Копию обновлённого файла правил агента — для проверки секций (подставь свой путь из Шага 0):
#   например: cp AGENTS.md ...  |  cp CLAUDE.md ...  |  cp .github/copilot-instructions.md ...  |  cp -r .cursor/rules ...
cp AGENTS.md homework-m6/stage3-living-docs/ 2>/dev/null || cp CLAUDE.md homework-m6/stage3-living-docs/ 2>/dev/null || true
```

### 🗒️ Ноут: аудит больших репо через sub-агентов (пример, не обязательно для ДЗ)

На занятии репо был небольшой — один агент сам составил план и выполнил аудит. Если проект большой, разнеси работу по sub-агентам. Пример промта (auditor в роли оркестратора, Execute mode):

```
🎯 ЦЕЛЬ
Распараллелить аудит доков и reverse-eng по модулям через sub-агентов.

🔧 ШАГИ
1. Из плана (00-plan.md) возьми список модулей и папок доков.
2. На КАЖДУЮ папку доков спавни через Task отдельного sub-агента:
   «Классифицируй все файлы в <папка> по docs-audit.template.md (✅/🔄/📦/❌). Верни таблицу вердиктов.»
3. На КАЖДЫЙ модуль спавни через Task отдельного sub-агента с промтом 4-step reverse engineering (см. Шаг 3.3).
4. Запускай батчами до ~10 параллельных агентов. Дождись отчётов, собери в synthesis/specs.

📤 РЕЗУЛЬТАТ
- homework-m6/stage3-living-docs/docs-audit.md — собранные вердикты по докам
- homework-m6/stage3-living-docs/specs/<module>-spec.md × N — specs по модулям
```

**📋 Что произойдёт под этим промптом**
- Кто запускает: главный агент в роли auditor спавнит N sub-агентов через Task (параллельно, батчами).
- Порядок: сначала аудит доков, потом reverse-eng по модулям; затем агрегация (Phase 4).
- Зачем: на большом репо один агент переполнит контекст — sub-агенты держат каждый свой кусок.

### Recipe-ссылки

- [`6.2-living-documentation/multi-level-docs-stack.md`](https://github.com/Serg1kk/aidev-course-materials/blob/main/M6/6.2-living-documentation/multi-level-docs-stack.md) — 8 уровней docs
- [`6.2-living-documentation/keeping-docs-current.md`](https://github.com/Serg1kk/aidev-course-materials/blob/main/M6/6.2-living-documentation/keeping-docs-current.md) — 3 уровня enforcement
- [`6.2-living-documentation/example-hooks/`](https://github.com/Serg1kk/aidev-course-materials/tree/main/M6/6.2-living-documentation/example-hooks) — готовый скрипт + settings
- [`6.2-living-documentation/hooks-reference/`](https://github.com/Serg1kk/aidev-course-materials/tree/main/M6/6.2-living-documentation/hooks-reference) — все 8 типов hooks + 7 примеров
- [`6.2-living-documentation/project-index.example.json`](https://github.com/Serg1kk/aidev-course-materials/blob/main/M6/6.2-living-documentation/project-index.example.json) — живой пример
- [`6.3-legacy-strategies/recipe-cc-reverse-engineering.md`](https://github.com/Serg1kk/aidev-course-materials/blob/main/M6/6.3-legacy-strategies/recipe-cc-reverse-engineering.md) — 4-step паттерн

### 📤 Output Checklist Stage 3 (бинарно)

#### Файлы в submission папке

- [ ] `homework-m6/stage3-living-docs/00-plan.md` (с галочками выполненных подзадач)
- [ ] `homework-m6/stage3-living-docs/docs-audit.md` ⭐ — verdict per existing doc folder/file (✅ ACCURATE / 🔄 PARTIALLY / 📦 HISTORICAL / ❌ STALE)
- [ ] `homework-m6/stage3-living-docs/project-index.json`
- [ ] `homework-m6/stage3-living-docs/update_project_index.py`
- [ ] `homework-m6/stage3-living-docs/docs-new/` (содержит README + specs + adr + architecture)
- [ ] `homework-m6/stage3-living-docs/docs-archived/` (старая docs)
- [ ] `homework-m6/stage3-living-docs/` — копия твоего файла правил агента (AGENTS.md / CLAUDE.md / copilot-instructions.md / …) с новыми секциями
- [ ] (опц.) `homework-m6/stage3-living-docs/hook-screenshot.png`

#### project-index.json содержит

- [ ] Валидный JSON (`python3 -m json.tool < project-index.json` без ошибок)
- [ ] `last_updated` — сегодняшний ISO timestamp
- [ ] `subprojects` — ≥ 3 annotated entries (mcp, rag, backend минимум)
- [ ] `system_folders` — ключевые отмечены (`.claude/`, твоя docs-папка `docs/` ИЛИ `project-data/`, `uploads/`)
- [ ] `hard_rules` — ≥ 5 правил, включая «ALWAYS read project-index.json FIRST»
- [ ] `ai_routing` — минимум 1 routing entry (например feature_flag_questions → MCP)
- [ ] `filesystem_tree` — содержит все ключевые папки fork`а

#### Per-module specs

- [ ] Минимум **2 module spec файла** в рабочей `docs/specs/` (в submission — `docs-new/specs/`)
- [ ] Каждый spec имеет 4-6 секций: Overview / Decision Table / Sequence Diagram / Edge Cases / Open Questions / Suggested Tests
- [ ] Mermaid диаграммы рендерятся (проверить в GitHub preview)
- [ ] Edge Cases section содержит **≥ 10 пунктов** на модуль

#### update_project_index.py

- [ ] Файл существует в `.claude/scripts/`
- [ ] Executable (`-rwxr-xr-x`)
- [ ] `WATCH_PATHS` адаптирован под мой fork
- [ ] Standalone запуск работает (вывод `[update-index manual] ...`)

#### Hook (опционально)

- [ ] `.claude/settings.json` (или `.local.json`) содержит `hooks.PostToolUse`
- [ ] Hook сработал хотя бы 1 раз (screenshot в submission)

#### Файл правил агента (AGENTS.md / CLAUDE.md / .cursor/rules / copilot-instructions.md / …)

- [ ] Секция «⭐ START HERE» добавлена
- [ ] Секция «⭐ Keeping project-index.json current» добавлена
- [ ] Размер файла по-прежнему разумный (не разрослось; для односекционных типа copilot-instructions — компактно)

#### Архив

- [ ] `docs-archived-YYYY-MM-DD/` создан в корне fork (старые доки `docs/` или `project-data/` целы)
- [ ] Архивировано только устаревшее (📦/❌ по вердиктам Phase 1.5), актуальное (✅/🔄) перенесено в новую структуру


## ⭐ Stage 4 — Tests Agent (~1-1.5 часа)

### 🎯 Цель

Использовать **отдельного sub-agent для написания тестов** + прогнать его на 2 сервисах из своего кода. Это естественное продолжение Stage 3: ты уже знаешь что код делает (через specs из reverse engineering), теперь пиши тесты которые это проверяют.

### Почему отдельный test-агент

- security-mate / performance-mate / architecture-mate — это **review-агенты** (find, not fix)
- test-writer-mate — это **write-агент** (генерирует код тестов)
- Разделение: review-агенты тестов **не пишут**, иначе они находят проблемы под свои же тесты (см. Topic 6.4 «Fake test coverage»)

### Шаг 4.1 — Проверить что `test-writer-mate` есть в `.claude/agents/`

Pre-built универсальный агент уже скопирован в твой fork (по Pre-requisites выше). Verify:

```bash
ls -1 .claude/agents/test-writer-mate.md
# должен показать файл
```

Если файла нет:

```bash
cp aidev-course-materials/M6/agents/test-writer-mate.md .claude/agents/
```

**System prompt этого агента — универсальный** (любой стек, любой test framework). Project-specific вещи (какой framework, какие конвенции, какой scope) передаются в **spawn-промпте**.

> При желании можешь адаптировать system prompt под свой стек (например, добавить специфику pytest fixtures для своих общих фикстур). Это опционально и не оценивается.

### Шаг 4.2 — Запустить test-writer на 2 сервисах

Выбери 2 модуля из своих M3-M5 — лучше всего те, что прошли через **Stage 3** reverse engineering (у тебя уже есть spec-файлы для них в `docs/specs/`).

В CC (подставь свои значения из Шага 0):

```
Запусти через Agent tool агента test-writer-mate (.claude/agents/test-writer-mate.md).

🎯 ЦЕЛЬ
Сгенерировать тесты для сервиса 1 на основе его spec из Stage 3.

📥 КОНТЕКСТ (подставь из Шага 0)
- Сервис 1: <твой MCP-сервер> (например mcp/feature_flags_server.py ИЛИ mcp-features/index.js)
- Reference spec: docs/specs/<module>-spec.md
- Test framework: <pytest или jest>

🔧 ШАГИ
1. Прочитай spec сервиса.
2. Напиши тесты, покрывающие: все публичные функции/endpoints из spec; топ-10 edge cases из раздела Edge Cases; 2-3 security-теста (если применимо).
3. Соблюдай существующий стиль тестов проекта. Если тестов ещё не было — заведи минимальную конвенцию (папка __tests__/ рядом с сервисом) и держись её для обоих сервисов.

📤 РЕЗУЛЬТАТ
- <твоя test-папка>/<test-файл>
  (пример Python: mcp/__tests__/test_feature_flags_server.py
   пример JS:     mcp-features/__tests__/index.test.js)
```

**📋 Что произойдёт под этим промптом**
- Кто запускает: главный CC-агент спавнит sub-агента test-writer-mate (write-агент, пишет тесты).
- Порядок: повтори для сервиса 2 (твой RAG-сервер). Потом Шаг 4.3 — прогон тестов.
- Появятся файлы: тест-файлы рядом с сервисами.

Повтори для service 2 (твой RAG-сервер — например `rag/server.js` ИЛИ `mcp-rag/index.js`).

### Шаг 4.3 — Прогнать тесты

```bash
# Python
pytest mcp/__tests__/ -v

# Node
npm test rag/__tests__/
```

Если что-то падает — НЕ исправляй код. Прочитай каждый fail:
- Если **тест неправильный** (не отражает реальное поведение) — попроси agent его исправить
- Если **тест прав, а код кривой** — это твой next finding для Stage 2 (но это уже не вашу домашку)

### Шаг 4.4 (опционально, для senior) — MSI замер (mutation testing)

**Что это и зачем.** Обычное покрытие (coverage) говорит лишь «эта строка выполнилась во время теста» — но НЕ «тест реально проверил результат». Можно иметь 100% coverage и при этом тесты, которые ничего толком не ассертят. **Mutation testing** ловит именно это: инструмент берёт твой код и вносит в него маленькие поломки — «мутанты» (например меняет `>` на `>=`, `true` на `false`, удаляет строку). Затем по каждому мутанту прогоняет твои тесты:
- хоть один тест **упал** → мутант «убит» ✅ (тест реально проверяет это поведение);
- все тесты **прошли** на сломанном коде → мутант «выжил» ❌ (значит эту логику тесты по-настоящему не проверяют — дырка в assertions).

**MSI (Mutation Score Indicator)** = доля убитых мутантов: `убитые / всего мутантов × 100%`. Это честная метрика силы тестов (в отличие от coverage). Цель — **MSI > 70%**.

Инструмент зависит от твоего стека (Шаг 0).

**Если Python (pytest):**

```bash
pip install mutmut==3.5.0
cd <твоя-mcp-папка>/
mutmut run --paths-to-mutate <твой-сервис>.py
mutmut results
```

**Если Node/JS (jest):** `mutmut` на JS НЕ работает — используй Stryker:

```bash
npm install --save-dev @stryker-mutator/core @stryker-mutator/jest-runner
npx stryker init   # один раз, сконфигурирует stryker.conf.json
npx stryker run
```

**Что делают эти команды** (логика одинакова для mutmut и Stryker):
1. `install` — ставит инструмент мутационного тестирования в проект.
2. `run` — главная команда: инструмент сам плодит мутантов из твоего сервиса и для КАЖДОГО прогоняет все твои тесты. Это занимает время (каждый мутант = отдельный прогон тестов).
3. `mutmut results` (Python) / HTML-отчёт `npx stryker run` (JS) — показывает итог: сколько мутантов убито/выжило, общий **MSI** и список **выживших** мутантов с файлом и строкой.

**Что делать с результатом:**
- **MSI > 70%** → тесты крепкие, ничего не трогаем, Шаг 4.4 закрыт.
- **MSI < 70%** → открой список **выживших** мутантов: каждый показывает место в коде, которое твои тесты не проверяют по-настоящему. Отдай этот список `test-writer-mate`, чтобы он точечно усилил assertions (не переписывая тесты с нуля):

```
🎯 ЦЕЛЬ
Усилить assertions под выжившие мутанты (поднять MSI > 70%).

🔧 ШАГИ
1. Прочитай выживших мутантов (mutmut/stryker) для <твой-сервис>.
2. Для каждого выжившего мутанта определи, какой тест ДОЛЖЕН был его поймать, но не поймал.
3. Усиль assertions в этом тесте.

📤 РЕЗУЛЬТАТ
- patch к существующему тест-файлу (тесты с нуля не переписывай).
```

**📋 Что произойдёт под этим промптом**
- Кто запускает: главный CC-агент спавнит test-writer-mate.
- Порядок: опционально, для senior, после прогона mutmut/stryker.
- Результат: усиленные assertions в существующих тестах.

### Recipe-ссылки

- [`6.4-synthetic-testing/recipe-mini-task.md`](https://github.com/Serg1kk/aidev-course-materials/blob/main/M6/6.4-synthetic-testing/recipe-mini-task.md) — детальный 75-минутный workflow
- [`6.4-synthetic-testing/coverage-vs-msi.md`](https://github.com/Serg1kk/aidev-course-materials/blob/main/M6/6.4-synthetic-testing/coverage-vs-msi.md) — что такое MSI
- [`6.4-synthetic-testing/tools-landscape.md`](https://github.com/Serg1kk/aidev-course-materials/blob/main/M6/6.4-synthetic-testing/tools-landscape.md) — mutmut / cosmic-ray / Diffblue / PromptFuzz

### 📤 Output Checklist Stage 4 (бинарно)

#### Файлы

- [ ] `.claude/agents/test-writer-mate.md` создан в моём fork
- [ ] `homework-m6/stage4-tests-agent/test-writer-mate.md` (копия для submission)
- [ ] `homework-m6/stage4-tests-agent/service-1-tests/` — тесты для сервиса 1
- [ ] `homework-m6/stage4-tests-agent/service-2-tests/` — тесты для сервиса 2
- [ ] `homework-m6/stage4-tests-agent/coverage-report.png` — скриншот прохождения тестов

#### test-writer-mate.md содержит

- [ ] YAML frontmatter (`name`, `description`, `model: claude-opus-4-7`, `tools`)
- [ ] **ROLE-LOCK** секция (только Write test code, никогда production code)
- [ ] **Strong test principles** секция (не `assert not None`)
- [ ] Шаблон 4 типов тестов per функционал: happy / edges / error / security
- [ ] **Anti-patterns to AVOID** секция (no try-catch wrappers, no mocking everything, etc.)
- [ ] Размер ≤ 250 строк (compact, не разрастающийся)

#### Сгенерированные тесты — качество

- [ ] **2 сервиса** покрыты (минимум) из моих M3-M5 модулей
- [ ] Per service ≥ **5 test cases**: 1 happy path + 2-3 edge cases + 1-2 error paths + (опц.) 1 security
- [ ] Assertions проверяют **VALUES**: `assert response.status == 200 and body['id'] == 42` — НЕ `assert response is not None`
- [ ] **Ни одного** теста с try-catch wrapper'ом который swallow'ит exceptions
- [ ] **Ни одного** trivial теста `assert 2+2 == 4`
- [ ] Test data реалистичная (не `"foo"` / `"bar"` — а production-like values)

#### Прогон

- [ ] Все тесты **проходят** на текущем коде
- [ ] Test runner (pytest / jest) показывает stats в `coverage-report.png`
- [ ] Если есть failing tests — explain в submission README **почему** (баг в коде vs test wrong assumption)

#### Bonus (для senior — опционально)

- [ ] `mutmut` запущен на тестируемом модуле
- [ ] **Starting MSI** замерен (`starting_msi.txt`)
- [ ] Assertions улучшены на survived mutants (повторный прогон)
- [ ] **Final MSI > 70%** (`final_msi.txt`)
- [ ] Краткий analysis 1-2 параграфа: какие mutations выживали чаще всего, какие assertions добавили

---

## Cross-stage связи (важно понять)

Stage'ы **не изолированы**, они **цепочка**:

```
Stage 1 (multi-agent review)  → synthesis.md с Top-3 findings
        ↓
Stage 2 (fix Top-3)           → исправили критичное, characterization tests прошли
        ↓
Stage 3 (living docs)         → project-index.json + новая docs/ + автообновление
        │  (через legacy-auditor-mate как orchestrator)
        ↓
Stage 4 (tests agent)         → test-writer-mate + защитили тестами 2 сервиса
```

К концу домашки у тебя:
- ✅ Понимаешь что нашли AI-агенты ревью (Stage 1)
- ✅ Исправил критичное (Stage 2)
- ✅ Задокументировал систему (project-index + specs) + автообновление (Stage 3)
- ✅ Защитил тестами (Stage 4)

Это **полный цикл качества** который ты применишь в production-проектах.

---

## Что сдавать (общая папка)

```
proshop_mern/homework-m6/
├── stage1-code-review/
├── stage2-fix-top3/
├── stage3-living-docs/
└── stage4-tests-agent/
```

Ссылку на папку / PR — в студенческом Telegram-канале с хэштегом `#m6-submission` + твоё имя.

---

## Дедлайн

**Перед стартом M7** (~2 недели после M6).

Если успеешь — раньше. Если нужно дольше — напиши в чат, согласуем.

---

## Cross-module hooks (что используется откуда)

| Из | В Stage | Что используется |
|---|---|---|
| M2 (IDE setup) | все | Claude Code установлен + настроен |
| M3 (MCP) | Stage 1, 4 | review своего MCP сервера, его спецификация |
| M4 (DESIGN.md) | Stage 4 | архитектурный контекст для reverse eng |
| M5 (sub-agents) | Stage 1, 3, 4 | паттерн запуска нескольких sub-agents (review-team, auditor-orchestrator, test-writer) |
| M6 — текущий | все | recipes из 6.1-6.4 |

---

## Полезные ссылки (студ-репо M6)

- [README.md](https://github.com/Serg1kk/aidev-course-materials/blob/main/M6/README.md) — overview модуля
- [6.1 AI Code Review](https://github.com/Serg1kk/aidev-course-materials/tree/main/M6/6.1-ai-code-review) — recipes, agents, tools-catalog
- [6.2 Living Documentation](https://github.com/Serg1kk/aidev-course-materials/tree/main/M6/6.2-living-documentation) — multi-level stack, hooks, project-index
- [6.3 Legacy Strategies](https://github.com/Serg1kk/aidev-course-materials/tree/main/M6/6.3-legacy-strategies) — reverse engineering, risk mitigation, incidents
- [6.4 Synthetic Testing](https://github.com/Serg1kk/aidev-course-materials/tree/main/M6/6.4-synthetic-testing) — recipes, tools, MSI / coverage

---

## ❓ FAQ

**Q: У меня MCP/RAG называются иначе (и/или на JS), а в ТЗ примеры с `mcp/…py`. Это норма?**
A: Да, абсолютно. Каждый строил M3-M5 со своими именами папок и своим стеком — у кого-то `mcp/` на Python, у кого-то `mcp-features/` на Node, доки в `docs/` или в `project-data/`, корневой конфиг `AGENTS.md` или `CLAUDE.md`. Заполни **Шаг 0** один раз и подставляй СВОИ значения везде, где видишь `<...>` или пример-путь. Оценивается работа на ТВОЁМ форке, а не совпадение с примером. Если структуру не знаешь — `legacy-auditor-mate` в Stage 3 Phase 1 сам её обнаружит и подскажет.

**Q: Можно делать стейджи не по порядку?**
A: Stage 2 требует Stage 1 (synthesis.md). Stage 4 (tests) проще делать после Stage 3 (есть specs модулей). Остальные — в любом порядке.

**Q: Что если у меня в M3-M5 мало кода / простой код?**
A: Возьми чужой код Brad Traversy слоя как backup: `backend/controllers/userController.js`, `orderController.js`. Они достаточно сложные.

**Q: Можно использовать GPT / Cursor вместо Claude Code?**
A: Можно, но recipes написаны под Claude Code (Agent tool, hooks). Адаптируй: Cursor — `Cmd+K` + chat mode, GPT — через ChatGPT app. Submission должна быть та же — папки + файлы.

**Q: Что если hook не срабатывает?**
A: Проверь `claude --version` ≥ v2.1.32, путь к скрипту, `chmod +x`, settings.json валидный. Если не получается — пропусти Stage 3 hook часть (это опционально), запускай `update_project_index.py` руками.

**Q: Сколько времени реально потратишь?**
A: Минимум **7 часов** если делаешь честно. Если поверхностно (без characterization tests, без MSI) — 4-5 часов, но reviewer (я) увидит и поставит ниже.
