---
name: n8n-requirements-orchestrator
description: Превращает абстрактную user story в детальный workflow spec через интерактивный диалог с уточняющими вопросами. Output — структурированный YAML/JSON spec для n8n-workflow-builder или ручной сборки в n8n.
version: 0.1.0
status: PLACEHOLDER
---

# n8n-requirements-orchestrator

> ⚠️ **Это placeholder.** Финальная версия будет добавлена автором курса перед стартом домашки.
>
> Если хотите попробовать сейчас — используйте general-purpose CC с явным запросом на уточняющие вопросы:
>
> ```
> claude
> > Выступи как product analyst для n8n workflow. Я расскажу user story, ты задавай уточняющие вопросы пока не получишь полный spec (триггер, ноды, integrations, edge cases). Минимум 5 вопросов перед финальным spec.
> > [paste user story]
> ```

## Goal (что будет в финальной версии)

Принимать user story → задавать уточняющие вопросы → выдавать детальный spec.

## Input format

Любая абстракция: «хочу чтобы при X происходило Y».

## Output format

Структурированный spec:

```yaml
trigger:
  type: ...
  config: ...
  filter: ...

steps:
  - node_type: ...
    purpose: ...
    config: ...

ai_agent_config:  # если применимо
  model: ...
  memory: ...
  tools: [...]
  system_prompt: GCAO_TEMPLATE_REF

credentials_needed: [...]
edge_cases:
  - case: ...
    handling: ...
```

## Какие вопросы задаёт

- **Trigger:** webhook / cron / event / manual? Какой источник?
- **Filter:** какие сообщения / события пропускать?
- **AI Agent:** нужен ли вообще? Если да — какая модель? Memory?
- **Tools:** какие интеграции? MCP / native node / HTTP?
- **Edge cases:** что делать при пустом input, спаме, временной недоступности сервиса?
- **Credentials:** какие сервисы нужны?
- **Output:** что делать с результатом? Возврат в UI / запись в БД / уведомление?

## Known limitations

- Может пропустить нетривиальные edge cases (sub-second latency, multi-tenant isolation)
- Не валидирует что предложенные tools существуют в n8n каталоге
- Может перегружать вопросами для простых задач

## После получения spec обязательно

1. Перечитайте spec — есть ли что-то невероятное? («каждые 100ms» — не реализуемо в cron)
2. Передайте в `n8n-workflow-builder` или соберите вручную
3. Если что-то ускользнуло — вернитесь в orchestrator с дополнительной информацией

---

*Placeholder. Финальная версия — перед дедлайном M5.*
