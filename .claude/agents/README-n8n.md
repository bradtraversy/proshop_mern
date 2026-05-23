# Claude Code субагенты для разработки workflow в n8n

> Два специализированных Claude Code субагента для построения n8n-workflow из user story. Используются совместно или по отдельности.
>
> ⚠️ **Это субагенты, не скиллы.** Ставятся в `~/.claude/agents/<name>.md` (одиночные `.md` файлы), а не в `~/.claude/skills/<name>/SKILL.md`. Вызываются через основной CC-чат фразой «запусти субагента такого-то — задача...», а не через slash-команду.

---

## Зачем

Ручная сборка workflow в n8n — это:
1. Выяснить требования (триггер, ноды, integrations, edge cases)
2. Превратить требования в spec
3. Кликать в UI или писать JSON руками
4. Подключать credentials, проверять connections
5. Валидировать схему

Если шаг 1-2 делает один CC-субагент, а шаг 3-5 — второй, у вас остаётся только финальный review JSON и импорт в n8n.

---

## Два субагента

### `n8n-requirements-orchestrator.md`

**Что делает:** превращает абстрактную user story в детальный workflow spec.

**Input:**
- User story: «Хочу чтобы при mention в Slack #ideas записывалось в Google Sheet и приходило уведомление»

**Output (structured spec):**
```yaml
trigger:
  type: slack_event
  channel: "#ideas"
  filter: "message contains @YourBot"

steps:
  - read_message_metadata
  - extract_text_and_author
  - append_to_sheet:
      sheet_id: ENV.IDEAS_SHEET_ID
      columns: [timestamp, author, content, slack_url]
  - send_telegram_dm:
      chat_id: ENV.TG_CHAT_ID
      template: "💡 Новая идея от {author}: {preview}"

edge_cases:
  - empty_message: skip
  - bot_message: skip (avoid loops)
  - sheet_unavailable: log error, retry 3x

credentials_needed: [slack, google_sheets, telegram]
```

**Запрашивает уточнения** если что-то неясно («Какой формат preview? Сколько символов?»).

### `n8n-workflow-builder.md`

**Что делает:** превращает детальный spec в валидный n8n JSON workflow.

**Input:** spec из orchestrator (или вручную написанный)
**Output:** JSON-файл готовый к импорту в n8n

**Знает:**
- Каноны нод n8n (точные имена, типы, версии)
- Валидацию connections
- Систему credentials
- Различия между nodes vs sub-nodes (особенно AI Agent + Memory + Tools)

---

## Как использовать совместно

Субагенты вызываются из обычного CC-чата фразой, в которой явно назван агент. Основной Claude сам диспатчит задачу нужному субагенту через Task-tool.

### Вариант 1: Orchestrator → Builder

```text
# 1. В CC-чате запустите orchestrator с user story:
> Запусти субагента n8n-requirements-orchestrator. Войди в роль и собери spec по этой user story: [...]

# 2. Когда orchestrator вернул spec.yaml — передайте его builder'у:
> Запусти субагента n8n-workflow-builder. На вход — spec ниже, на выход — JSON workflow для n8n 2.x.
> [paste spec.yaml]

# 3. Импортируйте JSON в n8n (Settings → Import from File)
# 4. Настройте credentials под себя
```

### Вариант 2: Только Orchestrator (для сложных задач)

Если задача требует много уточнений — используйте только orchestrator в интерактивном режиме:
```text
> Запусти субагента n8n-requirements-orchestrator. Расскажу задачу — задавай уточняющие вопросы пока не получишь полный spec.
> [paste user story]
```

В конце получите spec.yaml который можно скопировать в n8n руками или передать builder'у.

### Вариант 3: Только Builder (если spec уже есть)

Если у вас уже есть детальный spec (из документации, ADR, ticket в Jira):
```text
> Запусти субагента n8n-workflow-builder. На вход — spec ниже, на выход — JSON workflow для n8n 2.x.
> [paste existing-spec.yaml]
```

---

## Установка

Субагенты — это одиночные `.md` файлы в `~/.claude/agents/` (user-level) или `.claude/agents/` (project-level). Никаких подпапок `<name>/SKILL.md`.

```bash
# Вариант A — user-level (доступны во всех проектах)
mkdir -p ~/.claude/agents
cp n8n-workflow-builder.md ~/.claude/agents/n8n-workflow-builder.md
cp n8n-requirements-orchestrator.md ~/.claude/agents/n8n-requirements-orchestrator.md

# Вариант B — project-level (только этот репозиторий)
# mkdir -p .claude/agents
# cp n8n-workflow-builder.md .claude/agents/
# cp n8n-requirements-orchestrator.md .claude/agents/

# Перезапустите Claude Code. Проверьте что агенты на месте:
ls ~/.claude/agents | grep n8n
# Ожидаемо: 2 файла — n8n-requirements-orchestrator.md, n8n-workflow-builder.md
```

> 💡 Внутри CC можно посмотреть список загруженных субагентов командой `/agents`.

---

## Применение в домашке M5

### WF1 — Manual trigger workflow

Spec для orchestrator:
> «Студент в Dashboard нажимает кнопку → POST /webhook/feature-control с {feature_id, action, target_state, traffic_percentage} → AI Agent через MCP M3 (3 tools: get_feature_info, set_feature_state, adjust_traffic_rollout) меняет state → возврат JSON в UI».

Orchestrator уточнит:
- Какие именно actions поддерживаются?
- Какой формат ответа?
- Что делать при invalid params (`-50%`)?
- Какая Memory? (Window Buffer length=5 — рекомендация)
- Нужен ли HITL? (опционально для бонуса)

Builder сгенерирует JSON workflow.

### WF2 — Scheduled monitor

Spec для orchestrator:
> «Cron каждую минуту → читает logs.json за последнюю минуту → считает error_rate → если >5% → AI Agent через MCP M3 деактивирует фичу + Telegram alert».

Orchestrator уточнит:
- Где живёт logs.json? (storage path)
- Threshold ровно 5%?
- Telegram chat_id где брать?
- Как избежать спама алертов? (check current state перед disable)

Builder сгенерирует JSON.

---

## Антипаттерн использования субагентов

❌ **Не используйте оба субагента подряд без review.** Builder может галлюцинировать имена нод (`AI Agent` vs `LangChain Agent` vs `Tools Agent`) — после генерации обязательно проверьте JSON в n8n UI до того как залить в production.

❌ **Не доверяйте orchestrator на edge cases.** Он хорошо собирает happy path, но edge cases требуют вашего внимания. Прочитайте spec перед передачей builder'у.

❌ **Не хардкодьте credentials.** В сгенерированном JSON credentials должны быть placeholders (`{{credentials.MCP_SERVER_TOKEN}}`), а не реальные значения. Builder это знает, но проверьте.

---

## Что в файлах субагентов

> Файлы `n8n-workflow-builder.md` и `n8n-requirements-orchestrator.md` будут добавлены в эту папку перед стартом домашки. Они содержат YAML-frontmatter (`name`, `description`) + полный system prompt + примеры использования + ограничения.
>
> Если у вас уже настроены другие CC-субагенты — формат знакомый: один `.md` файл на агента в `~/.claude/agents/`.

---

*M5 HSS AI-dev L1. Subagents built and tested by course author.*
