# Деплой локальной модели

## Выбор стека

- **Runtime**: Ollama (на хосте, не в Docker — даёт прямой доступ к Metal/CUDA).
- **Модель**: `qwen3:8b-q8_0` (quantization Q8_0, 8.2B параметров, поддержка `tools` + `thinking`).
- **Доступ из контейнеров**: через `host.docker.internal:11434` (см. [router/architecture.md](./router/architecture.md)).
- **Шлюз**: LiteLLM proxy на `:4000` с алиасом `qwen-local` → `ollama_chat/qwen3:8b-q8_0`.

Почему Ollama, а не llama.cpp / vLLM напрямую:
- управление загрузкой моделей (`ollama pull` / `ollama list`);
- OpenAI-совместимый HTTP-эндпоинт + нативный `/api/chat`;
- поддержка tools и structured output из коробки;
- LiteLLM работает с ним через провайдер `ollama_chat` без обвязки.

## Установка

```bash
# macOS — установка через Homebrew
brew install ollama
brew services start ollama

# либо вручную — установить и запустить демона
ollama serve &

# проверить, что демон поднялся
curl -s http://127.0.0.1:11434/api/version
```

## Загрузка модели

```bash
ollama pull qwen3:8b-q8_0
ollama list
```

Размер ~8.5 GB. Загружается в `~/.ollama/models/`.

## Проверка через консоль (real run)

Команда:

```bash
curl -s --max-time 60 http://127.0.0.1:11434/api/chat -d '{
  "model": "qwen3:8b-q8_0",
  "messages": [
    {"role": "user", "content": "Дай очень короткий ответ одной фразой: какая столица Беларуси?"}
  ],
  "stream": false,
  "think": false
}'
```

Ответ (получен 2026-06-06 при подготовке отчёта):

```json
{
  "model": "qwen3:8b-q8_0",
  "created_at": "2026-06-05T20:41:03.951435Z",
  "message": { "role": "assistant", "content": "Минск." },
  "done": true,
  "done_reason": "stop",
  "total_duration": 10730191875,
  "load_duration": 10246417834,
  "prompt_eval_count": 39,
  "prompt_eval_duration": 173797000,
  "eval_count": 5,
  "eval_duration": 301335000
}
```

Что видно:
- `eval_count: 5` → 5 токенов в ответе («Минск.»);
- `total_duration ≈ 10.7s`, из них `load_duration ≈ 10.2s` — модель грузилась в память (первый вызов после простоя). Все последующие вызовы укладываются в ~300 ms;
- `think: false` отключает chain-of-thought вывод (Qwen3 умеет thinking, но для роутера он не нужен — лишние токены и время).

## Проверка через LiteLLM (тот же путь, что у backend)

После `docker compose up -d litellm presidio-analyzer`:

```bash
curl -s http://127.0.0.1:4000/v1/chat/completions \
  -H "Authorization: Bearer ${LITELLM_MASTER_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "smart-router",
    "messages": [{"role":"user","content":"какая столица Беларуси?"}]
  }' | jq .
```

`pii_router` обнаружит отсутствие PII → перепишет на `claude-haiku` → штампанёт
`response.model = "claude-haiku"`. Если задать что-то с email/телефоном, в
логах прокси будет `[pii_router] routed_to=qwen-local reason=high_score:EMAIL_ADDRESS`,
ответ будет от локального Qwen. Никаких изменений на стороне клиента не требуется.

## Запуск всего стека

```bash
# 1. На хосте — Ollama
ollama serve &

# 2. В Docker — Mongo, backend, frontend, LiteLLM, Presidio
docker compose up -d

# 3. Открыть http://localhost:3000, залогиниться, открыть чат
```

Подробнее — см. [README.md](./README.md).
