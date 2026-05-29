# M6 Agents — shared `.claude/agents/` library

> Универсальные sub-agents для аудита, ревью и генерации тестов на **любом** репозитории.
> Используются и в живом коде Topic 6.1 (AI Code Review), и в Topic 6.3 (Legacy Strategies), и в Topic 6.4 (Synthetic Testing), и в домашке (`../homework-spec.md`).
> System prompt каждого агента — **полностью project-agnostic**. Контекст конкретного репо передаётся в **user prompt при role-entry / Task spawn**.

---

## Список агентов

| Файл | Роль | Когда использовать |
|---|---|---|
| [`security-mate.md`](security-mate.md) | Security review (OWASP Top 10 + secrets + crypto) | PR review / point-in-time audit конкретных файлов |
| [`architecture-mate.md`](architecture-mate.md) | Architecture review (layer boundaries + ADR compliance + API stability) | PR review / arch-аудит модуля |
| [`performance-mate.md`](performance-mate.md) | Performance review (N+1 + blocking I/O + memory + throughput) | PR review / perf-аудит горячих путей |
| [`legacy-auditor-mate.md`](legacy-auditor-mate.md) ⭐ | Plan-mode orchestrator (discover repo → audit existing docs → dispatch 3 specialists → assemble living docs) | Старт работы над незнакомым/legacy репо, living docs setup |
| [`test-writer-mate.md`](test-writer-mate.md) | Генерация unit + integration тестов с value-checking assertions (high MSI > 70%) | Покрытие нового или отрефакторенного модуля тестами |

Все 5 — `claude-opus-4-7`. Все read-only кроме `test-writer-mate` (он `Write` для тест-файлов) и `legacy-auditor-mate` (он `Write/Task` в Execute mode после approval).

---

## Templates

| Файл | Что |
|---|---|
| [`templates/docs-audit.template.md`](templates/docs-audit.template.md) | Шаблон для Phase 1.5 output (`legacy-auditor-mate`) — `<output-dir>/docs-audit.md` |

---

## Как использовать в своём проекте

```bash
mkdir -p .claude/agents
cp aidev-course-materials/M6/agents/*.md .claude/agents/
cp -r aidev-course-materials/M6/agents/templates .claude/agents/templates  # optional, only if you plan to run legacy-auditor
```

В `.claude/settings.local.json` (опционально, для Agent Teams parallel mode):

```json
{ "env": { "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1" } }
```

---

## Два способа вызова

### A. Через `Task` tool — для review-агентов (security / architecture / performance / test-writer)

Эти агенты — sub-agents. Главный CC спавнит их через `Task` и передаёт **project context + scope + output paths** в spawn-промпте.

```
Use the Task tool with this prompt:
"Read .claude/agents/security-mate.md for your role.

PROJECT CONTEXT
- Stack: <node + express + mongoose + react>
- AGENTS.md at root (read first)
- ADRs at docs/adr/ (read first)

SCOPE
- Files: backend/controllers/*.js, mcp/feature_flags_server.py
- Out of scope: tests/, scripts/

OUTPUTS
- JSONL: .agent-team-reports/security-findings.jsonl
- Summary: .agent-team-reports/security-review.md

CONSTRAINTS
- Read-only.
- Aim for 8-20 findings."
```

### B. Через role-entry (`Read X.md and act according to that role`) — для `legacy-auditor-mate`

Auditor должен жить в **main session**, не как sub-agent, потому что ему самому нужен `Task` tool для Phase 3 dispatch. Поэтому его НЕЛЬЗЯ запускать через `Task`. Правильно так:

```
/plan

Read .claude/agents/legacy-auditor-mate.md and act according to that role.

PROJECT CONTEXT
- Repo: <name + 1-line description>
- Type: monorepo / single-app / library
- Stack (best guess): <list>
- Subprojects I expect you to find: <list or "discover yourself">
- Existing docs: <none / minimal / extensive — audit carefully>
- Audit scope: <"whole repo" / "these paths: X, Y, Z">
- Output directory: <e.g. .agent-team-reports/audit/>
- Extra constraints: <e.g. "do not touch docs/legacy-2018/">
```

Plan mode сначала (`Shift+Tab+Tab` или `/plan`). Auditor проходит Phase 1 → 1.5 → 2, останавливается на approval, потом переключается в EXECUTE mode и проходит Phase 3 → 4 → 5.

---

## Mailbox convention (peer-to-peer collaboration)

Все 4 review-агента (security / architecture / performance + auditor как координатор) могут писать друг другу через JSONL inbox:

```
.claude/teams/{team-id}/inboxes/<specialist-name>.jsonl
```

Используется для cross-domain вопросов («security found missing rate-limit — это ADR violation?»). Ожидание ответа ~30 сек, потом продолжение с best judgment.

---

## Версии и совместимость

- **Claude Code:** `v2.1.32+` (требуется для `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` flag).
- **Default model в frontmatter:** `claude-opus-4-7`. Sonnet 4.6 тоже работает — дешевле, чуть менее качественный output (приемлемо для PR-review default flow, см. `../6.1-ai-code-review/claude-code-review-setup.md`).
- **Tools** — у каждого агента в frontmatter. Не расширять без причины: ROLE-LOCK — главная защита от того что review-агент начнёт писать код.

---

## Связанные материалы

- [`../homework-spec.md`](../homework-spec.md) — домашка M6, использует всех 5 агентов
- [`../6.1-ai-code-review/claude-code-review-setup.md`](../6.1-ai-code-review/claude-code-review-setup.md) — 4 механизма запуска review (manual / hooks / GitHub Action / Agent Team)
- [`../6.1-ai-code-review/cloud-agent-team/`](../6.1-ai-code-review/cloud-agent-team/) — production-ready GitHub Actions workflow для cloud-режима
- [`../6.2-living-documentation/`](../6.2-living-documentation/) — multi-level docs stack, AGENTS.md/CLAUDE.md стандарт, hooks
- [`../6.3-legacy-strategies/recipe-cc-reverse-engineering.md`](../6.3-legacy-strategies/recipe-cc-reverse-engineering.md) — 4-step reverse engineering pattern, который использует `legacy-auditor-mate` в Phase 3
- [`../6.4-synthetic-testing/`](../6.4-synthetic-testing/) — теория за `test-writer-mate` (coverage vs MSI, strong assertions)
