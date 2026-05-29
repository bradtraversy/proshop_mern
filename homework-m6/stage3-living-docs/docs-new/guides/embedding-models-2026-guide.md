> **Language / Язык:** [English](embedding-models-2026-guide-en.md) · **Русский** (текущая версия)

---

# Embedding models в 2026 году — гайд по выбору для RAG

> **Аудитория:** разработчики, которые выбирают embedding model для production RAG.
> **Цель:** объяснить, что такое embedding models, сравнить лидеров 2026 года (OpenAI, Cohere, Voyage, Google, Jina, BAAI), дать честные числа по сценариям (текст / русский / код / multimodal / self-host / малый бюджет) и разобрать антипаттерны.
> **Дата:** 2026-04-27. Сверено с лидербордами MTEB v2 / MMTEB / RTEB / CCKM по состоянию на апрель 2026.

---

## TL;DR — выбор по сценарию

| Сценарий | Модель по умолчанию | Почему |
|---|---|---|
| Прототип, английский, ≤10K vectors | **OpenAI text-embedding-3-small** ($0.02/1M tok) | Дешевле всех, никакого setup, MTEB 62.3 |
| Multilingual production, включая русский | **Cohere Embed v4** API или **BGE-M3** self-hosted | v4 = 100+ языков, 128K context; BGE-M3 = MIT, бесплатно, dense+sparse+ColBERT |
| Multilingual, включая русский, EU-резидент | **BGE-M3** self-hosted или **Jina v4** (Берлин) | Cohere v4 тоже работает через AWS Bedrock EU profile |
| Поиск по коду | **voyage-code-3** (платный) или **Qwen3-Embedding-8B** (Apache 2.0) | voyage-code-3: +13.8% к OpenAI 3-large на CoIR; Qwen3 MTEB-Code 80.68 |
| Multimodal — текст + изображение + PDF + аудио + видео | **Google Gemini Embedding 2** (GA 22 апреля 2026) | Единственная коммерческая модель с нативной поддержкой 5 модальностей |
| Multimodal — текст + изображение, EU-резидент | **Cohere Embed v4** через AWS Bedrock EU profile | Gemini 2 пока недоступна в EU-регионах |
| Self-host на CPU или edge | **EmbeddingGemma-300M** или **Qwen3-Embedding-0.6B** | <1B параметров, multilingual, Apache/permissive |
| Команды, которым ToS Cohere/Voyage не подходит | **Qwen3-Embedding-8B** | Apache 2.0, лидер MMTEB, MTEB-Code 80.68 |
| KB с русским ≥30% | **GigaEmbeddings (SberDevices)** или **BGE-M3** | GigaEmbeddings: SOTA на ruMTEB (avg 69.1), проверьте лицензию; BGE-M3 универсальна |

---

## Часть 1 — Что такое embedding model

Для тех, кто видит этот термин впервые:

**Embedding model** превращает текст (или изображение, аудио, видео) в **vector** фиксированной длины — как правило, 768–3072 числа от −1 до 1. Два фрагмента со схожим смыслом дадут vectors, близкие в этом многомерном пространстве; расстояние между ними измеряется через cosine similarity.

Именно это делает vector search возможным. Вы однократно индексируете каждый чанк базы знаний, сохраняете vectors, а при запросе пользователя — embeddite его вопрос и достаёте ближайшие vectors.

Качество embedding model **напрямую ограничивает качество retrieval**, а значит — и качество любого ответа в RAG-системе. Никакой LLM не восстановит то, что retrieval упустил.

Три свойства важнее всего:

1. **На каких языках и модальностях обучена модель.** Модель, обученная преимущественно на английском, плохо справится с русским; text-only модель не embeddit изображения.
2. **Симметричная или асимметричная модель** (см. Часть 5). Асимметричные модели по-разному кодируют запросы и документы — им нужен флаг `input_type` при каждом API-вызове. Пропустить флаг — recall@10 молча упадёт на 5–15 пунктов.
3. **Размерность output vector.** Больше dimensions — больше памяти и медленнее поиск, но как правило выше качество. Многие модели 2026 года используют **Matryoshka Representation Learning (MRL)**: один vector можно усекать до меньших размерностей (например, 3072 → 768) без переобучения.

Три ключевых бенчмарка:

- **MTEB / MMTEB** (Multilingual Text Embedding Benchmark): публичный лидерборд, 131 задача, 250+ языков, рейтинг по Borda rank. Важная оговорка: **MTEB Avg ≠ качество retrieval**. Для RAG смотрите на retrieval sub-track (nDCG@10).
- **BEIR**: 18 retrieval-датасетов разных жанров. Сильные модели набирают 60+ против baseline BM25 ~42.
- **CCKM** ([Cheney Zhang, блог Milvus, март 2026](https://zc277584121.github.io/rag/2026/03/20/embedding-models-benchmark-2026.html)): независимый бенчмарк, который показал — **ранг в MTEB не предсказывает production-результат**. Всегда ведите собственный CI evaluation set из 200–500 запросов на вашем домене и языке.

---

## Часть 2 — Топ моделей в 2026 году

### 2.1 OpenAI text-embedding-3-small / large

**Статус:** вышли в январе 2024. **По состоянию на апрель 2026 замены нет** — `text-embedding-4` не существует, несмотря на эпизодические упоминания на сторонних трекерах.

| Модель | Dim (MRL range) | Max ctx | Цена | MTEB | Примечание |
|---|---|---|---|---|---|
| text-embedding-3-small | 1536 (256–1536) | 8 191 | $0.02/1M tok | 62.3 | Дешёвый вариант по умолчанию |
| text-embedding-3-large | 3072 (256–3072) | 8 191 | $0.13/1M tok | 64.6 | Силён на английском, слаб на русском |

**Сильные стороны:** зрелые SDK, самый дешёвый API для English-only, хорошо работает с кодом.

**Слабые стороны:**
- **Только symmetric** — нет асимметричного кодирования query/document (у Cohere, Voyage, E5 — есть).
- Посредственный multilingual — MIRACL 54.9 у 3-large против ~67 у Cohere v4 и ~67 у BGE-M3.
- Нет встроенной квантизации.
- Два года без обновлений — команда явно сосредоточилась на generation, а не на embeddings.

**Вердикт:** по-прежнему правильный выбор для английского прототипа, особенно `3-small` за $0.02/1M токенов. Для multilingual production — ищите другое.

### 2.2 Cohere Embed v3 / v4

**Статус:** v4 вышла в апреле 2025, остаётся флагманом в апреле 2026 (v5 не выходила; некоторые источники ошибочно пишут «Embed v5»). Проверено по документации Cohere.

| Модель | Dim (MRL) | Max ctx | Multilingual | Цена | Примечание |
|---|---|---|---|---|---|
| Embed v3 multilingual | 1024 | 512 | 100+ языков | $0.10/1M tok | Legacy, мигрируйте на v4 |
| **Embed v4** | 256/512/1024/**1536** | **128K — рекорд среди коммерческих** | 100+ языков | $0.10–0.12/1M tok + $0.47/1M image tok | Multimodal interleaved, нативный int8/binary |

**Сильные стороны:**
- **Самое большое контекстное окно среди коммерческих моделей (128K токенов)** — индексируйте длинные документы без агрессивного chunking.
- **Асимметричное кодирование** — при ingest обязательно передавайте `input_type="search_document"`, при retrieval — `input_type="search_query"`. Пропустить флаг — recall упадёт на 10–30%.
- Нативный multimodal с v4: текст + изображение + interleaved (PDF со скриншотами, графиками, таблицами).
- Доступна через 5 провайдеров: Cohere API, AWS Bedrock, SageMaker, Azure, Oracle.
- **AWS Bedrock cross-region EU inference profile** `eu.cohere.embed-v4:0` — единственный mainstream cloud-multimodal вариант с GDPR-защитой по состоянию на апрель 2026.
- Нативный int8 (4× экономия памяти, 99.99% retention по бенчмаркам Microsoft Azure) и binary (32× экономия, 90–98% retention при rescoring).

**Слабые стороны:**
- Закрытый исходный код — self-host недоступен.
- Vendor lock-in: в сентябре 2025 Cohere устарела classify/rerank/command-light fine-tuning, вынудив пользователей мигрировать.
- **Регуляторная заметка для России:** Cohere подпадает под экспортный контроль США и может быть недоступна для пользователей в России, Беларуси и других санкционных регионах. Проверьте доступность до принятия решения — команды из этих регионов обычно используют BGE-M3 self-hosted.

**Вердикт:** лидирующий multilingual production API для команд в EU/US/Азии. Для команд из России и СНГ — риск экспортного контроля делает выбор неприемлемым. Альтернативы: BGE-M3 или Qwen3-Embedding-8B.

### 2.3 BGE-M3 (Beijing Academy of AI)

**Статус:** вышла в феврале 2024; по состоянию на апрель 2026 — стандартный open-source вариант.

| Свойство | Значение |
|---|---|
| Dim | dense 1024 + sparse + ColBERT (multi-vector) |
| Max ctx | 8 192 |
| Языки | 100+ (лидер по multilingual, MIRACL 67.8) |
| MTEB | ~63.0 |
| Лицензия | **MIT** — коммерческое использование без ограничений |
| Стоимость | $0 (self-host на CPU или GPU) |

**Уникальная архитектурная особенность:** BGE-M3 за один forward pass возвращает **три представления одного текста** — dense (1024-dim), sparse (аналог BM25) и ColBERT-style multi-vector для late interaction. Hybrid search — это один вызов модели, а не два.

**Latency / throughput на распространённом железе:**

| Железо | Encode 1 query | Batch 32 chunks | Полная KB 28K элементов |
|---|---|---|---|
| VPS 4 vCPU, только CPU | ~150–300 ms | 6–10 сек | 2–3 часа |
| Mac M1 Pro, только CPU | ~15–25 ms | 700–900 ms | 30–40 мин |
| Mac M1 Pro с MPS | ~5–10 ms | ~250 ms | 12–15 мин |
| NVIDIA L4 GPU FP16 | ~5–15 ms | — | 15–30 мин |
| NVIDIA A100 FP16 | ~5–10 ms | — | минуты |

(Источники: [HuggingFace BGE-M3 model card](https://huggingface.co/BAAI/bge-m3); [FlagEmbedding GitHub issue #419](https://github.com/FlagOpen/FlagEmbedding/issues/419); Spheron benchmarks, апрель 2026.)

**Потребление памяти:** ~2.1 ГБ RAM при FP32, ~1.06 ГБ при FP16 (`use_fp16=True`).

**Production-стек на одном L4 GPU:**

```bash
docker run --gpus all -p 8080:80 -v $PWD/data:/data \
  ghcr.io/huggingface/text-embeddings-inference:cuda-1.9 \
  --model-id BAAI/bge-m3 --max-batch-tokens 65536 \
  --max-concurrent-requests 512 --dtype float16
```

Даёт устойчивые ~25K токенов/секунду.

**Вердикт:** безопасный self-host baseline для любого multilingual RAG, включая русскоязычные KB. Выбирайте BGE-M3, если нет явной причины платить за API.

### 2.4 Voyage AI (3-large, 4-large, multimodal-3.5, voyage-code-3)

**Статус:** куплена MongoDB в феврале 2025. Voyage-4 family вышла в январе 2026 с общим embedding space для вариантов `nano/lite/standard/large` — единственный коммерческий вендор, где можно менять размер модели без повторного embeddita.

| Модель | Dim (MRL) | Max ctx | Цена | Примечание |
|---|---|---|---|---|
| voyage-3-large | 1024 (256–2048) | 32K | $0.18/1M tok | Сильный multilingual, асимметричная |
| voyage-4-large | 1024 (256–2048) | 32K | $0.12, 200M tok бесплатно | Лидер RTEB по заявлению вендора |
| voyage-multimodal-3.5 | 256–2048 | 32K | $0.12 + per-pixel для изображений | Лучший video retrieval (обходит Gemini) |
| **voyage-code-3** | до 3072 | 32K | $0.18/1M tok | **+13.8% к OpenAI 3-large на CoIR** |

**Сильные стороны:**
- **Асимметричное кодирование** обязательно (`input_type="query"` / `"document"`).
- **Voyage 4 family использует общий embedding space** — масштабируйтесь вверх/вниз без повторного embeddita.
- voyage-code-3 — лидер production code search по независимым бенчмаркам.

**Скандал с RTEB, который стоит знать:** в начале 2026 мейнтейнеры MTEB временно убрали приватный RTEB-сплит — выяснилось, что Voyage AI (один из со-разработчиков) имела структурный доступ к закрытым тестовым данным ([GitHub issue #3934](https://github.com/embeddings-benchmark/mteb/issues/3934)). Все числа Voyage-4 — только от вендора, независимых воспроизведений пока нет. Относитесь к бенчмаркам Voyage скептически, хотя в слепых production-тестах модели показывают хорошие результаты.

**Вердикт:** конкурентоспособный multilingual API, лучший в классе для кода через `voyage-code-3`. Покупка MongoDB поднимает вопросы о долгосрочных ценах для клиентов вне Atlas — стоит следить.

### 2.5 Google Gemini Embedding 2 (multimodal flagship 2026)

**Статус:** public preview 10 марта 2026; **GA 22 апреля 2026** — за четыре дня до выхода этого гайда.

**Архитектура:** unified transformer encoder на базе Gemini, **не** CLIP-style dual-tower. Семантическое слияние происходит в глубоких скрытых слоях — это позволяет захватывать cross-modal связи, недоступные системам с раздельными encoderами.

| Модальность | Лимит |
|---|---|
| Текст | 8 192 токена, 100+ языков |
| Изображения | до 6 на запрос, PNG/JPEG/WebP/BMP |
| Видео | 80 с со звуком / 120 с без (preview); до 120 с в GA — проверяйте по SKU |
| Аудио | 80–180 с, MP3/WAV (нативно, без транскрипции) |
| PDF | 1 файл, до 6 страниц, layout-aware OCR |

**Output:** 3072-dim по умолчанию, MRL-усечение поддерживается на 128 / 256 / 512 / **768 (sweet spot)** / 1536 / 2048 / 3072.

**Цена:** $0.20–0.25 за 1M text-токенов (стандарт), $0.10 batch, плюс отдельные тарифы за image/audio/video. Источники расходятся в деталях (Vertex docs против сторонних трекеров) — проверяйте на billing-странице перед покупкой.

**Качество:** MTEB Multilingual 69.9 (первое место на лидерборде в момент GA), MTEB English 68.32, MTEB Code 84.0 (заявление вендора, независимого воспроизведения пока нет). По независимому CCKM-бенчмарку (март 2026) Gemini Embedding 2 набрала 0.928 — **уступает Qwen3-VL-Embedding-2B с 0.945**.

**Критическая оговорка для EU-резидентов:** по состоянию на 26 апреля 2026 модель работает **только в `us-central1`**. EU-регионы (`europe-west3` Франкфурт, `europe-west4` Нидерланды) не поддерживаются. С учётом **EU AI Act, вступающего в силу 2 августа 2026**, это жёсткий блокер для любого деплоя во Франкфурте.

**Production-миграции на Gemini Embedding 2:**
- **Sparkonomy:** заменил pipeline из трёх моделей (vision → text → embed) одним вызовом → −70% latency, семантическое сходство с 0.4 до 0.8.
- **Everlaw** (юридический поиск, 1.4M документов): +20% recall, 87% precision против 84% у Voyage и 73% у OpenAI.
- **Poke / Interaction Co.** (AI email assistant): −90.4% времени на embedding 100 писем против Voyage-2.
- **re:cap** (B2B fintech): F1 +1.9% на 21 500 примерах классификации транзакций.

**Вердикт:** будущее multimodal embeddingов — но для EU-команд региональное ограничение остаётся жёстким блокером до расширения. Для US/global команд — сильнейшее коммерческое multimodal-предложение сегодня.

### 2.6 Jina Embeddings v4 / v5

**Статус:** v4 вышла в июне 2025 (multimodal flagship), v5-text — в феврале 2026.

| Модель | Dim | Max ctx | Multimodal | Примечание |
|---|---|---|---|---|
| jina-embeddings-v4 | 2048 (MRL до 128) + multi-vector 128/token (ColBERT-style) | 32K | текст + изображения + визуально насыщенные документы | 30+ языков; **лицензия Qwen Research** — проверьте перед коммерческим использованием |
| jina-embeddings-v5-text | 64–1024 | 32K | только текст | MTEB v2 71.7, Apache 2.0 (small variant), CC BY-NC (full) |
| jina-embeddings-v5-small | 64–1024 | 32K | только текст | $0.05/1M tok через API |

**Сильные стороны:**
- **Берлинский провайдер** — самый естественный GDPR-compliant embedding API на рынке.
- v4 multi-vector mode — SOTA на JinaVDR и ViDoRe v2 для визуально насыщенных документов.
- Jina-clip-v2 поддерживается (89 языков, 512×512).

**Слабые стороны:**
- Веса v4 под лицензией Qwen Research — не Apache 2.0. Проверьте с юристом до коммерческого применения.
- Сообщество меньше, чем у Cohere/Voyage; production track record скромнее.

**Вердикт:** естественный выбор для EU-команд, которым нужен multimodal без отправки данных американским провайдерам.

### 2.7 Qwen3-Embedding family (Alibaba, Apache 2.0)

**Статус:** выходила в 2025 году; вариант 8B — лидер open-source бенчмарков в 2026.

| Модель | Размер | Dim | Max ctx | Примечание |
|---|---|---|---|---|
| Qwen3-Embedding-0.6B | 0.6B | 1024 | 32K | Edge-деплой, Apache 2.0 |
| Qwen3-Embedding-4B | 4B | до 7168 | 32K | Средний уровень |
| **Qwen3-Embedding-8B** | 8B | до 7168 | 32K | **Лидер MMTEB 70.58, MTEB-Code 80.68** |
| Qwen3-VL-Embedding-2B | 2B | varies | — | **#1 на CCKM (0.945) — обходит Gemini Embedding 2** |
| Qwen3-VL-Embedding-8B | 8.14B | varies | — | MMEB-V2 77.82 (SOTA среди open-source) |

**Требования к железу:**
- 0.6B: работает на CPU или GPU 4 ГБ.
- 8B: 16 ГБ VRAM при FP16 (минимум L4 / A10).

**Сильные стороны:**
- **Apache 2.0 везде** — никаких лицензионных ловушек.
- **Лидер MMTEB** среди open-source на размере 8B.
- Один из лучших результатов по коду.
- Multilingual, включая русский.

**Слабые стороны:**
- Часть европейских enterprise-клиентов включает модели китайского происхождения в risk review, несмотря на разрешительную лицензию.
- Крупная модель = выше стоимость inference по сравнению с API-альтернативами на малых объёмах.

**Вердикт:** сильнейший open-weight выбор в 2026 году, если есть возможность self-host.

### 2.8 GigaEmbeddings (SberDevices) — для русского языка

**Статус:** вышла в ноябре 2025. Основа — GigaChat-3B.

**Качество:** SOTA на ruMTEB, средний балл 69.1 по 23 задачам — лучший результат для русского текста.

**Оговорки:**
- Лицензия не Apache 2.0 — проверьте условия коммерческого использования.
- Международное сообщество небольшое, English-документация ограничена.

**Вердикт:** если KB преимущественно русскоязычная и лицензия подходит — локальный SOTA. Иначе BGE-M3 надёжнее как универсальный multilingual вариант.

### 2.9 Что не стоит выбирать в 2026 году

Модели, которые встречаются в лидербордах, но не должны быть выбором по умолчанию:

| Модель | Почему нет |
|---|---|
| **NV-Embed-v2** (NVIDIA) | CC-BY-NC-4.0 — только исследования. NVIDIA перенаправляет коммерческих пользователей на платный NeMo Retriever NIM. Жёсткая лицензионная ловушка для SaaS. |
| **Llama-Embed-Nemotron-8B** (NVIDIA) | CC-BY-NC. Та же ловушка. |
| **Microsoft Harrier-OSS-v1** | MIT, но **нет статьи, непрозрачные обучающие данные**. Возглавил MMTEB v2 (74.3) без независимой верификации. Скептицизм до воспроизведения. |
| **mistral-embed** | Не обновлялась с момента выхода; нет асимметричного кодирования; нет опубликованных ablation'ов на русском. |
| **OpenAI text-embedding-ada-002** | Устаревший путь в Azure. Если до сих пор на ada-002 — мигрируйте на 3-small. |

---

## Часть 3 — Сравнение по метрикам

### Топ MTEB v2 / MMTEB (апрель 2026)

| Место | Модель | MTEB Avg | Retrieval nDCG@10 | Примечание |
|---|---|---|---|---|
| 1 | Gemini Embedding 001 / 2 | 68.32 EN | 67.71 | +5.09 к #2; закрытая |
| 2 | Microsoft Harrier-OSS-v1 (27B) | 74.3 MMTEB v2 | — | MIT, нет статьи ⚠️ |
| 3 | Qwen3-Embedding-8B | 70.58 MMTEB | 69.8 | Apache 2.0; MTEB-Code 80.68 |
| 4 | Llama-Embed-Nemotron-8B | SOTA Borda окт. 2025 | — | CC-BY-NC |
| 5 | gte-Qwen3-8B | 68.1 | 67.4 | Open |
| 6 | NV-Embed-v2 | 72.31 | 62.65 | CC-BY-NC; **retrieval сильно ниже avg** |
| 7 | Voyage-4-large | 67.2 (вендор) | 71.8 (вендор) | Проблема RTEB |
| 8 | Jina v5-small | 71.7 | 65.5 | $0.05/1M через API |
| 9 | Cohere Embed v4 | ~65–66 | ~61 | 128K context |
| 10 | OpenAI 3-large | 64.6 | 62.2 | Symmetric, без асимметрии |
| 11 | BGE-M3 | ~63.0 | ~58.0 | MIT, dense+sparse+ColBERT |

**Важная оговорка:** MTEB Avg ≠ качество retrieval. У NV-Embed-v2 средний балл 72.31, а retrieval — 62.65: разрыв 10 пунктов. Для RAG всегда смотрите на retrieval sub-track.

### Latency / стоимость по сценариям

KB из 34K элементов, единоразовый embedding (~17M токенов):

| Модель | Разовая стоимость | Latency p50 | Self-host? |
|---|---|---|---|
| OpenAI text-embedding-3-small | $0.34 | 35–70 ms | Нет |
| OpenAI text-embedding-3-large | $2.21 | 50–200 ms | Нет |
| Cohere Embed v4 | ~$1.70–2.04 | ~50–150 ms | Нет |
| Voyage-3-large | $3.06 | ~90 ms | Нет |
| Gemini Embedding 001 | $2.55 | ~50 ms | Нет |
| Gemini Embedding 2 | $3.40 стандарт / $1.70 batch | preview, без SLA | Нет (только US) |
| BGE-M3 self-hosted | ~$2–5 GPU-часов | ~5–30 ms | Да |
| Qwen3-Embedding-8B self-hosted | $4–10 GPU-часов | ~50–150 ms | Да |

**Главный вывод:** для KB в 34K элементов разовая стоимость ingest незначительна у всех вариантов. Решение принимается исходя из текущих latency и стоимости запросов, multilingual-качества, лицензии и пути миграции — не начальной суммы.

---

## Часть 4 — Matryoshka Representation Learning (MRL): 12× меньше памяти при −8% качества

MRL — самая важная практическая техника в embedding-моделях с 2024 года. Модели, обученные с MRL, **усекаются до меньших dimensions без повторного прогона** — первые dimensions vector несут наибольшую информацию.

**Результат MRL для OpenAI text-embedding-3-large:** усечение с 3072 до 256 dimensions (в 12 раз меньше) теряет **лишь ~8% MTEB-качества**. Для большинства production RAG компромисс оправдан.

**Результат MRL для Voyage-3-large:** при 256 dims — **на +1.16% выше OpenAI 3-large при полных 3072 dims** (при rescoring на небольшом множестве кандидатов).

**Как применять MRL на практике:**

1. Всегда сохраняйте vector полной размерности (или хотя бы максимальной из нужных).
2. Стройте search index на меньшей размерности (например, 256) — для быстрой фильтрации.
3. Re-скорируйте топ-N кандидатов по полноразмерному vector.

Этот паттерн (часто называют «funnel search») описан в [Milvus tutorial on MRL](https://milvus.io/docs/funnel_search_with_matryoshka.md) и нативно поддерживается в Qdrant через named vectors + Query API prefetch.

**Математика памяти для 34K элементов при 1024-dim:**

| Формат | На один vector | Итого | Сжатие |
|---|---|---|---|
| float32 | 4096 Б | 139 МБ | 1× |
| float16 / halfvec | 2048 Б | 70 МБ | 2× |
| int8 / scalar | 1024 Б | 35 МБ | 4× |
| binary | 128 Б | 4.4 МБ | **32×** |
| MRL 1024 → 256 fp32 | 1024 Б | 35 МБ | 4× |
| MRL 1024 → 256 + binary | 32 Б | **1.1 МБ** | **128×** |

**Практические правила (консенсус из документации Cohere, Qdrant, Weaviate):**
- **halfvec / fp16** при >5M vectors: почти бесплатно, потери ≤1%, экономия 2×.
- **int8** при >50M vectors: Qdrant называет это production default, ~99% retention.
- **Binary** — только при >100M vectors И dim ≥1024 И модель обучена с учётом квантизации (Cohere v3+, Voyage 3+, mxbai-embed-large). На меньших моделях recall резко падает.
- **Binary всегда с rescoring:** топ-100 binary → топ-10 полной точности. Нативно в Qdrant и Weaviate.

---

## Часть 5 — Антипаттерны

### Антипаттерн 1: Замена embedding model на лету

Каждая embedding model живёт в своём пространстве Гильберта. Cosine similarity между OpenAI 3072-dim vector и Cohere 1024-dim vector **математически бессмысленна**. Смена embedder — это **полное повторное индексирование всего корпуса**.

При необходимости мигрировать:
- **Версионированные namespace'ы:** `docs_v1_bge_m3`, `docs_v2_voyage_3_large`.
- **Dual-write / shadow index** (паттерн Notion): пишете новые embeddingi в новый индекс, оцениваете recall@k на held-out тест-сете, переключаетесь.
- **Blue-green swap:** атомарное переключение, временно требует 2× хранилища.

Единственное исключение — **Voyage 4 family** (nano/lite/standard/large): общий embedding space для всех размеров.

### Антипаттерн 2: Cohere или Voyage из санкционного региона

Оба вендора зарегистрированы в США и подпадают под экспортный контроль. Для команд в России, Беларуси и других санкционных регионах возникают риски с доступностью и оплатой. Используйте BGE-M3 self-hosted или Qwen3-Embedding-8B.

### Антипаттерн 3: Модели на ImageNet для поиска по коду

Модель, обученная преимущественно на тексте и изображениях (CLIP, ImageBind, классические SBERT-модели), плохо справится с code retrieval. Используйте **voyage-code-3**, **Qwen3-Embedding-8B** или **Codestral Embed** — специально обученные на коде.

### Антипаттерн 4: Symmetric model там, где нужна асимметричная

Самый частый «тихий убийца» качества. Если ваша модель асимметричная (Cohere v3/v4, Voyage v2/v3/v4, E5, multilingual-e5, Nomic, Snowflake) — **обязательно** передавайте флаг `input_type`:

| Модель | Тип | Что делать |
|---|---|---|
| Cohere v3/v4 | Асимметричная, обязательно | `input_type="search_query"` или `"search_document"` |
| Voyage v2/v3/v4 | Асимметричная, обязательно | `input_type="query"` или `"document"` |
| OpenAI 3-small/large | Symmetric | один encoder, флаг не нужен |
| BGE v1.5 EN | Опционально асимметричная | добавляйте к запросам префикс `Represent this sentence for searching relevant passages:` |
| **BGE-M3** | **Symmetric** — подтверждено мейнтейнерами | префиксы не нужны |
| E5 / multilingual-e5 / E5-Mistral | Асимметричная, обязательно | префиксы `query: ` и `passage: ` |
| Nomic v1/v2, Snowflake Arctic | Асимметричная | `search_query: ` / `search_document: ` |

**Пропустить флаг — молча потерять recall@10 на 5–15 пунктов.** Безопасная обёртка:

```python
def embed(text: str, role: Literal["query", "doc"]) -> list[float]:
    if MODEL.startswith("cohere"):
        itype = "search_query" if role == "query" else "search_document"
        return co.embed(texts=[text], model=MODEL, input_type=itype).embeddings[0]
    if MODEL.startswith("voyage"):
        return voyage.embed([text], model=MODEL, input_type=role).embeddings[0]
    if MODEL.startswith("intfloat/e5"):
        prefix = "query: " if role == "query" else "passage: "
        return e5.encode(prefix + text, normalize_embeddings=True)
    # OpenAI / BGE-M3 / mistral-embed — symmetric
    return openai.embeddings.create(model=MODEL, input=text).data[0].embedding
```

### Антипаттерн 5: Доверять рангу MTEB в production

Лидерборд MTEB **самостоятельно отчитывается** без независимой проверки. MTEB v2 в 2025 году появился именно из-за подозрений в утечке данных из v1. Шесть известных проблем:

1. Self-reporting без верификации.
2. Доля zero-shot теперь видна — `e5-mistral` показал 95% zero-shot на v2 (видел ~5% train splits).
3. MTEB v2 введён из-за contamination v1.
4. Юридический сплит MTEB признан на 25% методологически некорректным (Isaacus, февраль 2026).
5. Приватный RTEB-сплит убран из-за конфликта интересов с Voyage.
6. Бенчмарк CCKM (Milvus, 2026) показал: ранг в MTEB не предсказывает production-результат.

**Вывод:** ведите собственный CI evaluation set из 200–500 запросов на вашем домене и языке. MTEB — для предварительного отбора, но не для финального решения.

### Антипаттерн 6: Cohere v4 для on-prem или строгой EU-резидентности вне AWS Bedrock EU

Cohere v4 — закрытый исходный код. Единственный EU-compliant путь: AWS Bedrock cross-region inference profile (`eu.cohere.embed-v4:0`). Для чистого on-prem или регионов кроме `eu-central-1` / `eu-west-1` — нужен self-host: BGE-M3, Jina v4 или Qwen3-Embedding.

### Антипаттерн 7: Принимать числа Voyage 4 без независимой проверки

Скандал 2026 с RTEB (Voyage участвовала в разработке бенчмарка и имела структурный доступ к закрытым тестовым данным) означает: текущие числа Voyage 4 — только от вендора. Независимые воспроизведения ещё не опубликованы. Модель хорошая — production case studies реальные, — но конкретные benchmark-числа дисконтируйте.

---

## Часть 6 — Готовые рецепты

### Рецепт 1: Text-only English RAG, прототип до ~10K элементов

**Стек:** OpenAI text-embedding-3-small + Chroma (in-memory) + GPT-4o-mini.

**Стоимость:** $0.02/1M токенов для embedding, ~$0.34 за корпус 17M токенов. Vector DB бесплатно.

**Когда обновляться:** при переходе за 100K vectors → мигрируйте на pgvector. Нужен multilingual → переходите на BGE-M3 или Cohere v4.

### Рецепт 2: Multilingual production RAG с русским

**Стек (cloud, EU-friendly):** Cohere Embed v4 API + Qdrant Cloud (Франкфурт) + reranker `bge-reranker-v2-m3` self-hosted.

**Стек (санкционный регион или строгая резидентность):** BGE-M3 self-hosted через TEI на одном L4 GPU + Qdrant self-host + bge-reranker-v2-m3.

**Стоимость (cloud-вариант, 34K элементов, ~10 запросов/мин):** $20–50/мес.

**Зачем два варианта?** 5 vector backends параллельно (BGE-M3 ×3 + Cohere v4 ×2 через Qdrant / Weaviate / pgvector) — учебная архитектура; в production обычно выбирают одну ingest-модель и одну query-модель и придерживаются её.

### Рецепт 3: Code search RAG

**Стек:** voyage-code-3 (платный) или Qwen3-Embedding-8B (открытый) + Qdrant + reranker.

**Оговорка:** если вы строите coding agent (а не продукт для поиска по коду), grep + ripgrep + tree-sitter обычно обходят vector search. Cole Medin: *«Единственная причина, по которой традиционный RAG мёртв для AI-кодинга — это структурированность наших кодовых баз».*

Исключение — Cursor: для UX «волшебной кнопки» над репозиторием из 1000+ файлов кастомный code embedder + Turbopuffer + Merkle-tree delta indexing + reranker дают **+12.5% к точности** против grep. Это продуктовое решение, а не выбор ML-стека.

### Рецепт 4: Multimodal RAG (текст + изображение + PDF)

**Стек (US/global):** Gemini Embedding 2 + Qdrant или Weaviate + Claude или GPT-5 для синтеза.

**Стек (EU-резидентность):** Cohere Embed v4 через AWS Bedrock EU profile + Qdrant Cloud (Франкфурт).

**Выгода упрощения pipeline:** нативные multimodal-модели сокращают код подготовки данных на **70–80%** (300+ строк → 50–80 строк). Старая схема LlamaParse + Tesseract + VLM captioning + Whisper + text embedder сворачивается в один API-вызов с сырыми байтами.

**Когда не стоит переходить на multimodal:** text-heavy KB с ≤10% визуального контента. Старый text-embed pipeline дешевле, проще дебажить и быстрее.

### Рецепт 5: Полный self-host на одном L4 GPU

**Стек:** BGE-M3 + bge-reranker-v2-m3 в одном контейнере TEI 1.9, Qdrant self-hosted на том же сервере, FastAPI gateway.

**Throughput:** ~25K токенов/секунду для embeddingов, ~145–300 ms на reranking 100 кандидатов.

**Стоимость:** ~€50–80/мес на GPU-инстансе Hetzner.

**Когда подходит:** GDPR/152-ФЗ резидентность; коммерческая чувствительность данных; высокий объём запросов, при котором API-стоимость становится доминирующей.

### Рецепт 6: Low-budget личная KB

**Стек:** Ollama + bge-m3 (`ollama pull bge-m3`) + Chroma persistent + локальная Llama 3.

**Время развёртывания:** до 30 минут.

**Ограничение:** до 100K vectors, один пользователь.

**Оговорка:** GGUF-квантизация Ollama может снижать качество на длинном контексте (>4K токенов). Для реального production переходите на TEI.

---

## Источники

**Документация вендоров (проверено апрель 2026):**
- OpenAI embeddings: https://platform.openai.com/docs/guides/embeddings
- Cohere Embed v4: https://docs.cohere.com/docs/embed-v4
- Voyage AI: https://docs.voyageai.com
- Google Gemini Embedding: https://ai.google.dev/gemini-api/docs/embeddings
- Jina Embeddings: https://jina.ai/embeddings
- BAAI BGE-M3: https://huggingface.co/BAAI/bge-m3
- Qwen3-Embedding: https://huggingface.co/Qwen/Qwen3-Embedding-8B

**Бенчмарки:**
- MTEB / MMTEB: https://github.com/embeddings-benchmark/mteb
- BEIR: https://github.com/beir-cellar/beir
- CCKM (Milvus, март 2026): https://zc277584121.github.io/rag/2026/03/20/embedding-models-benchmark-2026.html
- DRAGON (русский бенчмарк): https://arxiv.org/html/2507.05713v2
- ruMTEB: https://habr.com/ru/companies/sberdevices/articles/777268/
- ColPali (ICLR 2025): https://arxiv.org/abs/2407.01449
- «Lost in OCR Translation» (май 2025): https://arxiv.org/html/2505.05666

**Production case studies:**
- Notion vector search: https://www.notion.com/blog/two-years-of-vector-search-at-notion
- Cursor secure indexing: https://cursor.com/blog/secure-codebase-indexing
- Intercom Fin: https://fin.ai/research/do-you-really-need-a-vector-search-database/
- Glean fine-tuned embeddings: https://jxnl.co/writing/2025/03/06/fine-tuning-embedding-models-for-enterprise-rag-lessons-from-glean/
- Sparkonomy / Everlaw / Poke (Gemini Embedding 2 launch partners): Google Developer Blog, март–апрель 2026

**Критические инциденты:**
- Скандал с RTEB: https://github.com/embeddings-benchmark/mteb/issues/3934
- BGE-M3 Mac MPS benchmarks: https://github.com/FlagOpen/FlagEmbedding/issues/419

**Инструменты self-hosting:**
- HuggingFace TEI: https://github.com/huggingface/text-embeddings-inference
- Infinity (multi-model embed+rerank+CLIP+ColPali): https://github.com/michaelfeil/infinity
- vLLM (с embedding pooling): https://docs.vllm.ai
- NVIDIA NIM Embeddings: https://docs.nvidia.com/nim/

---

*Версия 1.0 | 2026-04-27 | Гайд M3 для курса HSS AI-Driven Development Level 1.*
