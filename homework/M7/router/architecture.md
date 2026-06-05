# Архитектура роутера (LiteLLM + Presidio + Ollama)

Документ описывает устройство PII-aware роутера между локальной моделью
(`qwen3:8b` через Ollama) и облачной (`claude-haiku-4-5` через Anthropic).
Скрипты лежат рядом: [config.yaml](./config.yaml),
[pii_router.py](./pii_router.py), [Dockerfile](./Dockerfile).

## Идея

Один логический алиас `smart-router`. Клиент (backend `/api/assistant/chat`)
обращается в LiteLLM с `model: smart-router`. На pre-call хуке LiteLLM
вызывается Presidio Analyzer; по результатам анализа `data["model"]`
переписывается на физический бэкенд:

- найдены чувствительные сущности с высоким score → `qwen-local` (Ollama, локально)
- сущностей нет → `claude-haiku` (Anthropic API, облако)
- найдены сущности с низким score → `qwen-local` (default, fail-safe в локалку)
- пустой текст или ошибка анализатора → `qwen-local` (fail-safe)

Это safety net **поверх** доменного классификатора (`personal` / `public`),
который backend уже принял на уровне intent. Даже если intent ушёл в `public`,
а пользователь зашил в сообщение email/телефон — Presidio перехватит и
маршрутизирует в локалку.

## Поток запроса

```
client → backend /api/assistant/chat
  ├─ JWT protect
  ├─ classifyIntent(message) → 'personal' | 'public'
  ├─ getToolsForRoute(route)
  └─ toolLoop({ model: PERSONAL_MODEL | PUBLIC_MODEL })
        │
        ▼
   LiteLLM :4000  (model = "smart-router" для public)
        ├─ pii_router.async_pre_call_hook
        │     ├─ extract_text(messages)
        │     ├─ POST presidio-analyzer:3000/analyze
        │     ├─ _decide(spans, non_latin) → physical model
        │     └─ data["model"] = chosen
        ├─ → Ollama  (qwen-local)
        └─ → Anthropic API  (claude-haiku)
```

## Компоненты

### LiteLLM proxy
- Образ: см. [Dockerfile](./Dockerfile) — `ghcr.io/berriai/litellm:main-stable` + `presidio-analyzer`/`presidio-anonymizer` (для совместимости импорта в callback).
- Конфиг: [config.yaml](./config.yaml) — два физических модели и `smart-router` через `callbacks: pii_router.pii_router_instance`.
- Порт: `4000`. `master_key` через `LITELLM_MASTER_KEY` env.

### Presidio Analyzer
- Отдельный сервис, образ `mcr.microsoft.com/presidio-analyzer:latest`.
- Порт: `5010` (наружу) → `3000` (внутри).
- Вызывается LiteLLM-хуком через `PRESIDIO_ANALYZER_URL=http://presidio-analyzer:3000`.

### Ollama (host)
- Запущен на хосте на `127.0.0.1:11434`, доступен из контейнера через `host.docker.internal:11434`.
- Модель `qwen3:8b-q8_0` (capabilities: completion, tools, thinking).

### Anthropic
- `claude-haiku-4-5-20251001`, ключ через `ANTHROPIC_API_KEY`.

## Логика решения ([pii_router.py](./pii_router.py))

`_decide(spans, non_latin)`:
1. фильтр по белому списку `SENSITIVE_ENTITIES` (CREDIT_CARD, EMAIL_ADDRESS, PHONE_NUMBER, US_SSN, IBAN_CODE, и др.);
2. отдельная защита от ложных PERSON на non-Latin (кириллица): требует score ≥ `PII_PERSON_NON_LATIN_MIN_SCORE` (по умолчанию 0.95);
3. если есть spans с `score ≥ PII_SCORE_THRESHOLD_HIGH` (0.6) → `MODEL_PII` (qwen-local);
4. spans есть, но score низкий → `MODEL_DEFAULT` (qwen-local, fail-safe);
5. spans нет → `MODEL_CLEAN` (claude-haiku).

`async_post_call_success_hook` штампует `response.model` физическим именем — backend и frontend видят реальный бэкенд, не алиас.

## ENV-переменные

| Имя | Назначение | Значение |
|-----|-----------|----------|
| `PRESIDIO_ANALYZER_URL` | URL анализатора | `http://presidio-analyzer:3000` |
| `PII_SCORE_THRESHOLD_HIGH` | Порог high-confidence | `0.6` |
| `PII_PERSON_NON_LATIN_MIN_SCORE` | Порог для PERSON на non-Latin | `0.95` |
| `ROUTE_PII_MODEL` | Куда роутить PII | `qwen-local` |
| `ROUTE_CLEAN_MODEL` | Куда роутить чистые запросы | `claude-haiku` |
| `ROUTE_DEFAULT_MODEL` | Default / fail-safe | `qwen-local` |
| `PII_LOG_CONTENT` | Логировать ли исходный текст | `0` (off) |
| `LITELLM_MASTER_KEY` | Master-key для прокси | секрет |
| `ANTHROPIC_API_KEY` | Ключ Anthropic | секрет |

## Принципы

1. **Fail-safe в локалку** — любая ошибка/неопределённость → qwen-local. Облако работает только при явном «чисто».
2. **No content logs** — `PII_LOG_CONTENT=0` по умолчанию. Stdout содержит только тип сущности и решение.
3. **Алиас, а не маршрутизация на стороне клиента** — клиент не знает, какая модель ответит. Решение полностью на LiteLLM.
4. **Stamping реальной модели** — `response.model` переписывается в физическое имя, чтобы аудит в `ChatLog` отражал правду.
5. **Защитный слой, не первичный фильтр** — основной выбор делает intent-классификатор на backend. Presidio — последний рубеж против утечки PII в облако.
