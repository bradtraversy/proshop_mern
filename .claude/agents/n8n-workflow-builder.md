---
name: n8n-workflow-builder
description: Превращает детальный workflow spec в валидный n8n JSON. Знает каноны нод, систему credentials, связи sub-nodes (AI Agent + Memory + Tools). Использовать после n8n-requirements-orchestrator или с готовым spec.
version: 0.1.0
status: PLACEHOLDER
---

# n8n-workflow-builder

> ⚠️ **Это placeholder.** Финальная версия будет добавлена автором курса перед стартом домашки.
>
> Если хотите попробовать сейчас — можно использовать любой general-purpose CC прямо в терминале с указанием на n8n docs:
>
> ```
> claude --add-dir ~/path/to/n8n/docs
> > Помоги собрать n8n workflow по spec ниже. Используй каноны нод из n8n docs локально. Output — JSON файл.
> > [paste spec]
> ```

## Goal (что будет в финальной версии)

Принимать структурированный spec и возвращать валидный JSON workflow для импорта в n8n.

## Input format

```yaml
trigger:
  type: webhook | cron | telegram_event | manual
  config: ...

steps:
  - node_type: ...
    config: ...
  - ...

credentials_needed: [...]
edge_cases: [...]
```

## Output format

JSON-файл по схеме [n8n workflow export](https://docs.n8n.io/api/api-reference/) — готовый для импорта через `Import from File`.

## Known limitations

- Не валидирует подключение к live n8n (просто генерит JSON)
- Не настраивает credentials — оставляет placeholders
- Может ошибаться на nested AI Agent + Memory + Tools (sub-nodes структура n8n тонкая)

## После генерации обязательно

1. Импортируйте JSON в n8n
2. Проверьте connections визуально
3. Настройте credentials под себя
4. Прогоните test execution
5. Если что-то не работает — см. `guides/troubleshooting.md`

---

*Placeholder. Финальная версия — перед дедлайном M5.*
