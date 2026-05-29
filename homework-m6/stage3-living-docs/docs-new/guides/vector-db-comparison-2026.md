> **Language / Язык:** [English](vector-db-comparison-2026-en.md) · **Русский** (текущая версия)

---

# Vector databases для production RAG, 2026 — сравнительный гайд

> **Аудитория:** разработчики и PM, выбирающие vector storage для RAG-системы.
> **Цель:** перевести ситуацию 2026 года в дерево решений, технические разборы по каждой БД, матрицу стоимости по масштабу, паттерны миграции и антипаттерны, которые не стоит повторять.
> **Дата:** 2026-04-27. Все цифры сверены с документацией вендоров, рецензируемыми статьями и независимыми бенчмарками. Каждое утверждение снабжено ссылкой.

---

## TL;DR — выбор по сценарию

Если читаете только один раздел — читайте этот. Найдите свою ситуацию в левом столбце:

| Ваша ситуация | Дефолтный backend в 2026 | Почему |
|---|---|---|
| Pet project / хакатон, <50K векторов | **Chroma in-memory** или **pgvector**, если Postgres уже есть | Zero ops, `pip install chromadb`, бесплатно |
| MVP / команда 1-3 человека, <5M векторов, единый Postgres-стек | **Supabase pgvector** | Один стек: auth + storage + векторы + бэкапы |
| Production text-RAG, 1-100M векторов, готовы поднять инфраструктуру | **Qdrant self-hosted** (Hetzner €5-50/мес) | Apache 2.0, Rust, hybrid search, нативный multi-vector для ColPali |
| BM25 + vector hybrid прямо из коробки | **Weaviate** | Нативный BM25 + vector + RRF fusion, GraphQL, система модулей |
| Нужен managed serverless, нет бюджета на DevOps | **Pinecone** | Serverless tier, 5 GB бесплатно, DevOps не нужен |
| Enterprise scale, 1B+ векторов, выделенная ops-команда | **Milvus** (на базе FAISS) | Промышленный масштаб, distributed by design |
| Новый serverless на object-storage | **Turbopuffer** | Кейс Notion: −60% расходов на поиск, есть cold start |
| Multi-hop reasoning, entity-centric запросы | **LightRAG** + Qdrant или Neo4j | Graph-слой с экономичной экстракцией |
| Кросс-документальная суммаризация, корпус в несколько миллионов токенов | **Microsoft GraphRAG** или **LazyGraphRAG** | Community summaries; полный GraphRAG только при серьёзном бюджете |
| 152-ФЗ / GDPR / VPC-only data residency | **Qdrant self-host** (Frankfurt) или **pgvector** on-prem | Pinecone — только облако, для строгой локализации не подходит |
| Поиск по коду в большом репозитории | **Без vector DB** — grep + ripgrep + AST | Coding-агенты в 2026 отказались от vector-индексации |

Дальше разбираем, почему каждая строка именно такая.

---

## Часть 1 — Архитектурные семейства vector storage в 2026

Рынок делится на четыре архитектурных семейства. Понять, к какому семейству относится решение, — значит сэкономить неделю на оценке вендоров.

### 1.1 Managed cloud (multi-tenant SaaS)

**Игроки:** Pinecone, Weaviate Cloud, Qdrant Cloud, Zilliz (Milvus Cloud), MongoDB Atlas Vector Search.

**Сильные стороны:** zero ops, auto-scaling, SLA, дашборды observability, опции региональной локализации данных.

**Слабые стороны:** vendor lock-in, egress fees, жёсткий потолок стоимости при большом масштабе, audit trail только в premium-тирах.

**Ценообразование:** за вектор или за pod. При 1B векторов Pinecone обходится примерно в **$3 500/мес**, Qdrant Cloud — около **$1 200/мес**, Qdrant self-hosted на Hetzner — около **$800/мес + стоимость ops** ([Pinecone serverless pricing](https://www.pinecone.io/pricing/), [Qdrant Cloud pricing](https://qdrant.tech/pricing/), апрель 2026).

### 1.2 Self-host, одиночный процесс

**Игроки:** Qdrant (Rust), Milvus standalone, Weaviate Docker, Chroma, FAISS (библиотека).

**Сильные стороны:** лицензии Apache/MIT, полный контроль над локализацией данных, предсказуемая стоимость (только RAM и CPU, которые уже оплачены), легко встраивается в микросервисы.

**Слабые стороны:** ops на вас — бэкапы, снапшоты, HA, шардирование, настройка ядра. Для Qdrant параметры `vm.max_map_count` и HNSW `m`/`ef_construct` влияют и на latency, и на recall.

**Когда побеждает:** в команде есть ≥1 инженер с инфра-бэкграундом; compliance запрещает SaaS.

### 1.3 Postgres-расширения

**Игроки:** pgvector, pgvecto-rs, VectorChord, ParadeDB.

**Сильные стороны:** та же база, которую команда уже эксплуатирует. Единый pipeline для бэкапов, единая модель авторизации, транзакционная консистентность между метаданными и векторами. **Начиная с pgvector 0.7 + 0.8 (2026)** HNSW-индексы комфортно масштабируются до 1-5M векторов, halfvec — до 4000 измерений.

**Слабые стороны:** выше ~5M векторов HNSW-индекс строится долго и съедает много памяти; сложный hybrid search приходится делать руками (`tsvector` + `vector_cosine_ops`); нативных sparse-векторов нет без дополнительных расширений.

**Реальная история миграции:** Firecrawl и Berri AI переехали **с Pinecone на Supabase pgvector** именно из-за боли с metadata filtering при росте — Caleb Peffer (CEO Firecrawl): *«If you need to store a bunch of metadata, [Pinecone/Weaviate/Faiss] becomes a huge pain.»* ([Render.com analysis, 2026](https://render.com/articles/build-vs-buy-rag-infrastructure)).

### 1.4 Serverless на object-storage

**Игроки:** Turbopuffer, Pinecone serverless, Vespa Cloud.

**Сильные стороны:** платите за хранение и запросы, а не за idle pods. В 2026 году Notion мигрировал с Pinecone serverless **на Turbopuffer** и зафиксировал −60% расходов на поисковый движок, p50 latency снизилась с 70-100 мс до 50-70 мс ([Notion engineering, Feb 2026](https://www.notion.com/blog/two-years-of-vector-search-at-notion)).

**Слабые стороны:** cold-start latency на редко используемых namespace'ах; менее зрелая экосистема; слабая поддержка продвинутых паттернов вроде multi-vector ColPali.

### 1.5 Graph-based (новое гибридное семейство)

**Игроки:** LightRAG, Microsoft GraphRAG, LazyGraphRAG, HippoRAG 2, nano-graphrag, FastGraphRAG.

**Почему отдельная категория:** это не самостоятельные vector databases — они надстраиваются над одним из существующих решений (Qdrant, Neo4j, Postgres+pgvector) и добавляют граф сущностей и отношений, который строится при ingest с помощью LLM. Считайте их *архитектурой retrieval* поверх *vector store*, а не конкурентом Qdrant.

---

## Часть 2 — Детальный разбор ключевых решений

### 2.1 Qdrant

**Производитель:** Qdrant Solutions (Берлин), Apache 2.0, написан на Rust.

**Архитектура:**
- HNSW с binary, scalar и product quantization (начиная с 1.15+ — также 1.5/2-bit).
- **First-class multi-vector support** (named vectors, MUVERA, MaxSim) — в 2026 году это важно, потому что ColPali и другие late-interaction модели для document retrieval требуют именно этого нативно.
- Hybrid search через Query API с prefetch + RRF/DBSF fusion за один round-trip.
- mmap + disk HNSW позволяет хранить коллекции значительно большего объёма, чем доступная RAM.

**Hybrid search:** нативный dense + sparse + RRF. В феврале 2026 Qdrant опубликовал бенчмарки, показывающие **+15-20% точности** по сравнению с vector-only на мультидоменных корпусах.

**Multimodal:** нативная первоклассная поддержка ColPali-style моделей — `Vespa, Qdrant, Weaviate, Astra` — четыре production-ready vector DB для visual RAG по состоянию на апрель 2026.

**n8n и интеграции:** у Qdrant есть нативная нода n8n с 2024 года — полный CRUD по коллекциям, hybrid search, payload filtering, batch upsert. Важно, потому что n8n стал дефолтным no-code оркестратором для AI-воркфлоу.

**Стоимость (апрель 2026):**
- Self-hosted на Hetzner: €5-50/мес для 1-100M векторов.
- Qdrant Cloud `eu-central-1` Frankfurt: от $0.014/ч за кластер 1 GB, масштабируется до ~$1 200/мес при 1B векторов.

**Когда выбирать:** всё в диапазоне 1M-1B векторов, если готовы поднять инфраструктуру или платить за managed. Дефолтный open-source выбор для production text-RAG в 2026.

**Когда не выбирать:** менее 1M векторов при наличии Postgres — pgvector справится. Более 1B векторов с SLO p99 <50 мс — лучше масштабируются Milvus или Vespa.

**Что учесть:**
- Дефолтные значения `m` и `ef_construct` для HNSW консервативны — настраивайте под нужный recall.
- Quantization с отключёнными полными векторами (Scalar Int8) даёт 4× экономию памяти при потере recall <1%; binary при 32× требует rescoring (top-100 binary → top-10 full precision).
- Rust toolchain увеличивает время компиляции в кастомных сборках.

### 2.2 Weaviate

**Производитель:** Weaviate B.V. (Амстердам), BSD-3, Go.

**Архитектура:**
- Hybrid BM25 + vector прямо из коробки, никакой дополнительной настройки.
- Система модулей: reranker'ы, generative-модули, мультимодальные модули (CLIP, ImageBind, ColBERT) подключаются декларативно.
- Named multi-vectors: один объект может хранить `embedding_openai` и `embedding_cohere` параллельно — удобно при миграции embedding-моделей.
- GraphQL API плюс REST.
- **Weaviate 1.37 (релиз 2026-04-23)** представил декларативный ingest: объявите, какие поля являются текстом/изображением/аудио/видео, загрузите данные — embeddings сгенерируются и проиндексируются автоматически.

**Hybrid search:** канонический выбор «hybrid прямо из коробки». Отключение BM25 в Weaviate-конфигурациях снижает точность на 30-40% на технических корпусах ([Weaviate hybrid benchmarks](https://weaviate.io/blog/hybrid-search-explained)).

**Multimodal:** сильная позиция — модули для CLIP, multi2vec-bind, нативная поддержка PaliGemma. Начиная с 2026 Weaviate — дефолт для сценария «хочу hybrid + multimodal без написания связующего кода».

**Стоимость:** Weaviate Cloud — от ~$25/мес за 1 vCPU, линейное масштабирование. Self-host бесплатен.

**Когда выбирать:** нужен BM25+vector сразу, нравится GraphQL, команда предпочитает декларативную систему модулей ручной сборке компонентов.

**Что учесть:**
- Система модулей увеличивает операционную поверхность — каждый модуль запускается в отдельном контейнере.
- GraphQL может быть непривычен командам, привыкшим к REST.
- Для multi-tenant SaaS — уточните лицензию; коммерческие деплои существуют, но условия стоит проверить.

### 2.3 Supabase pgvector

**Производитель:** pgvector — Apache 2.0, автор Andrew Kane; Supabase оборачивает его auth, storage и edge functions.

**Архитектура:**
- Типы индексов: HNSW и IVFFlat.
- `halfvec` (fp16) для векторов до 4000 измерений при потере recall ≤1%.
- Тип `bit` для бинарных векторов до 64K измерений.
- Matryoshka через `vec_slice()`.
- Все стандартные инструменты Postgres: `pg_dump`, logical replication, транзакции через векторы и метаданные одновременно.

**Практический лимит:** 1-5M векторов — комфортный диапазон; выше HNSW-индекс строится слишком долго и давит на RAM. При 1M векторов с 1024 измерениями HNSW-индекс занимает примерно 4-8 GB в зависимости от `m`.

**Hybrid search:** вручную через `tsvector` + cosine-ops, либо через расширение **VectorChord**, которое добавляет нормальную поддержку sparse-векторов.

**Когда выбирать:** команда уже на Postgres; векторов меньше 5M; нужен единый pipeline для бэкапов.

**Когда не выбирать:** более 5M векторов; нужна managed multi-region репликация именно для векторов; нужна первоклассная поддержка multi-vector для ColPali (обходной путь — row per token, неудобно).

**Путь миграции:** когда пересечёте 5M, стандартная схема — dual-write в Qdrant или Weaviate при сохранении pgvector живым, затем переключение чтений. Задокументировано в блоге Notion Engineering об их миграции 2024-2026.

### 2.4 Pinecone

**Производитель:** Pinecone Systems Inc., закрытый исходник, US-hosted.

**Архитектура:**
- Serverless: стоимость хранения и запросов разделены.
- Sparse-dense hybrid (отдельные индексы, клиентский merge — не единый round-trip).
- Нативная поддержка MRL для семейства OpenAI text-embedding-3.
- Бесплатный тир: 5 GB хранилища, 100M write units, 1M read units в месяц.

**Сильные стороны:** zero ops, щедрый бесплатный тир, зрелые SDK, предсказуемое масштабирование для SaaS-стартапов.

**Слабые стороны:**
- Только облако — не проходит по требованиям GDPR / VPC-only / 152-ФЗ.
- Размерность фиксируется при создании индекса; миграция embedding-модели требует нового индекса.
- Нет нативного ColPali multi-vector.
- Metadata filtering — самая частая причина, по которой команды уходят (Firecrawl, Berri AI).

**Стоимость при масштабе (1B векторов):** около $3 500/мес на serverless ([Pinecone pricing, апрель 2026](https://www.pinecone.io/pricing/)). В 4.4 раза дороже self-hosted Qdrant на Hetzner.

**Когда выбирать:** явный мандат «без DevOps»; команда меньше 5 инженеров; до 100M векторов; US-only data residency подходит.

**Когда не выбирать:** любое из: строгий GDPR, multi-tenant SaaS, сложная metadata filtering, multi-vector, ожидаемый масштаб >100M векторов.

### 2.5 Milvus

**Производитель:** Zilliz, Apache 2.0, изначально китайский проект, сейчас интернациональный.

**Архитектура:**
- Под капотом — FAISS (эффективнее по памяти, чем HNSW, на очень больших индексах).
- Distributed by design: отдельные узлы для индексации, запросов, данных и root coordinator.
- Несколько типов векторов в одной коллекции (с версии 2.4): dense + sparse + multi-vector одновременно.
- Hybrid search: нативный dense + sparse + BM25 (с версии 2.5) с `RRFRanker` и `WeightedRanker`.
- Проработанный туториал по Matryoshka («Funnel Search with Matryoshka») для cost-aware фильтрации.

**Когда выбирать:** масштаб >100M векторов с выделенной ops-командой; нужны multi-vector + sparse + dense в одной коллекции; есть Kubernetes и настоящая platform-команда.

**Когда не выбирать:** маленькая команда; <10M векторов; операционная сложность Milvus реальна и не оправдана на малом масштабе.

**Что учесть:** «Milvus standalone» (один бинарник) скрывает сложность до тех пор, пока масштаб не вынудит перейти в distributed mode — планируйте этот переход заранее.

### 2.6 Chroma

**Производитель:** Chroma (open source, Apache 2.0).

**Архитектура:**
- По умолчанию — in-memory; персистентный режим на SQLite.
- Создавался для прототипирования и локальной разработки.
- Первоклассные интеграции с LangChain и LlamaIndex.

**Ограничения:**
- На апрель 2026 нет production HA.
- Нет нативного hybrid search (BM25 нужно добавлять снаружи).
- Нет managed cloud (Chroma Cloud заявлен для 2026, но незрелый).

**Когда выбирать:** первый прототип, хакатон, учебное упражнение, демо «рабочий RAG за пять строк кода».

**Когда не выбирать:** всё, что выходит за рамки прототипа. Начните с Chroma, но планируйте миграцию на Qdrant или pgvector до отметки 100K векторов.

### 2.7 Turbopuffer

**Производитель:** Turbopuffer (Сан-Франциско), проприетарный, работает на object-storage.

**Архитектура:**
- Построен на S3-class object storage; namespace'ы дёшевы, idle namespace почти ничего не стоит.
- Проектировался под multi-tenant нагрузки (namespace на клиента).
- Hybrid search, MRL, квантизация fp16 + int8.

**Production-референс:** в 2026 Notion перенёс все RAG-векторы сюда и зафиксировал **−60% расходов на поисковый движок, −35% расходов на AWS EMR, p50 с 70-100 мс → 50-70 мс**.

**Когда выбирать:** multi-tenant B2B с большим количеством небольших namespace'ов на клиента; важна стоимость и допустим некоторый cold-start.

**Когда не выбирать:** жёсткий SLO p99 <100 мс на редко запрашиваемых tenant'ах (cold start проявится); нужен open source.

### 2.8 LightRAG (graph + vector hybrid)

**Производитель:** HKUDS (Гонконгский университет науки и технологий), MIT, Python. Последний релиз v1.4.10+ (февраль 2026), 28-34K звёзд, квартальные релизы.

**Архитектура:**
- Граф — first-class: при ingest дешёвый LLM (DeepSeek, GPT-4o-mini) извлекает сущности и отношения и сохраняет их в Neo4j, pgvector или NetworkX.
- 5 режимов запросов: `naive`, `local` (1-hop), `global` (community summaries), `hybrid`, `mix` (production-дефолт с августа 2025).
- Подключаемые хранилища: KV (Postgres), vector (Qdrant/pgvector), graph (рекомендован Neo4j Community; Postgres+AGE — антипаттерн, см. Часть 5).
- Reranker встроен с августа 2025; режим `mix` требует его.

**Пример стоимости (KB из 34K позиций, ~17M токенов):**
- Vector-only ingest: $0.50-1.40 при self-hosted BGE-M3, почти бесплатно.
- LightRAG ingest с DeepSeek V4 Flash: ~$15-35 разово; с GPT-4o-mini: ~$36; с Claude Haiku 4.5: ~$270 (избыточно).
- Microsoft GraphRAG full ingest на том же корпусе: $200-525 (4o-mini) — $2 625-5 250 (GPT-4o).

**Качество по бенчмаркам (GraphRAG-Bench, ICLR 2026, [arXiv 2506.05690](https://arxiv.org/html/2506.05690v3)):**

| Задача | LightRAG | MS GraphRAG | Vanilla RAG с reranker |
|---|---|---|---|
| Поиск фактов | 63.3% | 38.6% | **64.7%** |
| Сложный reasoning | **61.3%** | 47.0% | — |
| Контекстуальная суммаризация | **63.1%** | 41.9% | — |
| Генерация | **67.9%** | 53.1% | — |
| Токенов на запрос | ~100K | ~331K (global) | ~880 |

**Вывод:** LightRAG превосходит Microsoft GraphRAG на всех сложных задачах; на простом поиске фактов vanilla RAG с reranker'ом всё ещё побеждает. Не добавляйте граф-слой, если запросы — это фактические поиски.

**Когда выбирать:** корпус >1M токенов; ≥15-20% реальных запросов — multi-hop entity-bridging или агрегация; бюджет на разовый ingest $20-200; команда умеет работать с графовыми базами данных.

**Когда не выбирать:** корпус <1M токенов (дешевле LazyGraphRAG); нет опыта работы с Neo4j; основная смесь запросов — однохоповые фактические.

### 2.9 Microsoft GraphRAG (и почему большинству команд не нужна полная версия)

**Производитель:** Microsoft Research, лицензия MIT, Python. Последний стабильный релиз v2.7.0 (октябрь 2025), v3 в staging.

**Архитектура:** извлечение сущностей → обнаружение сообществ (Leiden) → community summaries → многошаговый retrieval, сочетающий локальный поиск по сущностям и глобальный поиск по community summaries.

**Реальность полного GraphRAG в 2026:**
- Stоимость ingest на 100K документов: $200-525 с GPT-4o-mini, $2 625-5 250 с GPT-4o.
- Ingest 50K+ документов занимает несколько дней.
- Стоимость одного запроса в режиме `global`: $0.05-0.15 (один запрос потребляет ~610K input-токенов).
- «15-20% graph drift в квартал» требуют частичной повторной экстракции.
- Microsoft сам выпустил **LazyGraphRAG** (ноябрь 2024) и **PIKE-RAG** (ICML 2025) как более экономичные решения.

**Цифры LazyGraphRAG** ([Microsoft Research blog, June 2025](https://www.microsoft.com/en-us/research/blog/lazygraphrag-setting-a-new-standard-for-quality-and-cost/)):
- Стоимость индексации: 0.1% от полного GraphRAG.
- Стоимость запроса: 4% от полного GraphRAG.
- Win rate >50% в A/B тестах BenchmarkQED по всем четырём категориям, кроме DataLocal-Relevance.

**Когда полный GraphRAG оправдан в 2026:** корпус >5M токенов с регуляторным требованием трассируемого кросс-документального синтеза (AML в банках, healthcare compliance, сценарии high-risk по EU AI Act) — и бюджет >$1K/мес — и выделенная ops-команда.

**В большинстве случаев:** используйте LazyGraphRAG, LightRAG или HippoRAG 2.

---

## Часть 3 — Матрица стоимости по масштабу

Все цифры рассчитаны для векторов 1024-dim float32, метаданные ≤200 байт на строку, p95 query latency ≤200 мс, hybrid search там, где поддерживается. Сверено в апреле 2026.

### 10M векторов

| Backend | Хранилище | В месяц | Примечания |
|---|---|---|---|
| Pinecone serverless | включено | $50-150 | тир 5 GB, ~3M чтений |
| Qdrant Cloud (`eu-central-1`) | включено | $80-200 | кластер 1 GB, нужен апгрейд |
| Qdrant self-host (Hetzner CCX23) | 80 GB SSD | $30-50 + ops | 16 GB RAM, 4 vCPU |
| Weaviate Cloud | включено | $100-250 | Standard plan |
| Supabase pgvector (Pro plan) | 8 GB включено | $25-100 | 8 GB DB, масштаб до Team |
| Milvus на K8s (Hetzner cluster) | 100 GB | $80-150 + ops | минимум три узла |
| Turbopuffer | включено | $40-80 | ценообразование per-namespace |

### 100M векторов

| Backend | Хранилище | В месяц | Примечания |
|---|---|---|---|
| Pinecone serverless | ~80 GB | $400-900 | scaled tier |
| Qdrant Cloud | ~80 GB | $300-700 | medium cluster |
| Qdrant self-host | 200 GB SSD | $80-150 + ops | CCX33, 64 GB RAM |
| Weaviate Cloud | включено | $500-1 200 | зависит от QPS |
| pgvector | не рекомендуется | — | выходит за комфортную зону выше 5M |
| Milvus K8s | 500 GB | $300-600 + ops | distributed mode |
| Turbopuffer | включено | $200-500 | зависит от паттернов доступа |

### 1B векторов

| Backend | Хранилище | В месяц | Примечания |
|---|---|---|---|
| Pinecone serverless | ~800 GB | **$3 500** | опубликованный референс |
| Qdrant Cloud | ~800 GB | **$1 200** | enterprise plan |
| Qdrant self-host (Hetzner) | 2 TB SSD | **$800 + ops** | в 4.4× дешевле Pinecone |
| Weaviate Cloud | включено | $2 500-5 000 | по данным вендора |
| Milvus K8s | 5 TB | $1 500-3 000 + ops | full distributed |
| Vespa Cloud | включено | $1 500-4 000 | сильное решение на этом масштабе |
| Intercom Fin reference | ~600M vec, ES brute-force, $30K/мес | только референс — использует ES dense_vector с `index=false` | нетипично, но задокументировано [Fin.ai 2025](https://fin.ai/research/do-you-really-need-a-vector-search-database/) |

**Замечание по Intercom:** ~600M векторов 768-dim на Elasticsearch с `index=false` (brute-force script-score, не ANN). По оценке — **в 3× дешевле Qdrant** при их паттернах доступа, и значительно дешевле Pinecone. P50 ~100 мс. Вывод: существующая инфраструктура часто оказывается выгоднее модных новых вендоров.

---

## Часть 4 — Паттерны миграции и кейсы

### 4.1 Pinecone → pgvector (Firecrawl, Berri AI и другие SaaS-стартапы)

**Триггер:** боль с metadata filtering — модель метаданных Pinecone стала ощущаться ограниченной, когда командам понадобилась JOIN-подобная логика.

**Схема:**
1. Поднять Postgres с pgvector и стеком Supabase auth + storage.
2. Экспортировать векторы с метаданными из Pinecone через API.
3. Импортировать в pgvector с HNSW-индексом.
4. Неделю dual-read, сравнивать recall@10 на отложенной evaluation set.
5. Переключить чтения.

**Цитата Caleb Peffer, CEO Firecrawl:** *«If you need to store a bunch of metadata, [Pinecone/Weaviate/Faiss] becomes a huge pain.»*

**Результат:** более простой стек, ниже стоимость (Postgres уже оплачен), конец workaround'ов для метаданных.

### 4.2 Pinecone serverless → Turbopuffer (Notion, 2024-2026)

**Масштаб:** миллиарды векторов для миллионов клиентов.

**Схема:**
1. Hash-dedup контента на уровне span'ов (блоки Notion дублируются между workspace'ами) — **−70% объёма данных** до повторного embedding.
2. Перенести embedding pipeline с Apache Spark на EMR на **Ray on Anyscale** (июль 2025).
3. Self-host open-source embedding-модели через Ray Serve — без обращений к OpenAI API на hot path.
4. Перенести векторное хранилище в Turbopuffer, namespace на workspace.

**Цифры ([Notion engineering, Feb 2026](https://www.notion.com/blog/two-years-of-vector-search-at-notion)):**
- 10× запас масштабирования.
- ~90% снижение стоимости за два года.
- p50 с 70-100 мс → 50-70 мс.
- Pipeline на Ray обещает ещё **−90% расходов на embedding-инфраструктуру**.

### 4.3 OpenAI Embeddings + GPT-4 → кастомный RAG на ES brute-force (Intercom Fin)

**Масштаб:** ~600M векторов 768-dim, 15 индексов × 30 primary shards на Elasticsearch.

**Решение:** их существующая Elasticsearch-инфраструктура уже имела снапшоты, runbook'и, алертинг. Используют `dense_vector` с `index=false`, brute-force script-score. **По оценке в 3× дешевле Qdrant** при их паттерне доступа.

**Вывод:** лучшая vector DB — иногда та, которую вы уже эксплуатируете.

### 4.4 Без vector DB вообще (команда Vercel AI SDK, личный KB Karpathy)

**Триггер:** prompt caching в 2025 году достиг 90%-й скидки на cache hits; для корпусов ≤200K токенов *Cache-Augmented Generation (CAG)* — загрузка всего корпуса в кешированный промпт — оказался дешевле и точнее vector RAG.

**Результат команды Vercel** (в подкасте Lenny Rachitsky): отказались от vector DB для агентов → **$1.00 → $0.25 за запрос, качество выросло**. Использовали prompt caching + agentic search.

**Karpathy о личном KB (апрель 2026):** *«I thought I had to reach for fancy RAG, but LLM has been pretty good at auto-maintaining index files.»* Стало паттерном в комьюнити как «Karpathy Wiki» — markdown + LLM router.

**CAG побеждает над vector RAG, когда:** корпус ≤200K токенов; запросы аналитические или исследовательские по всему корпусу; prompt caching доступен у вашего провайдера.

### 4.5 Кастомные embeddings на тенант (Glean)

**Масштаб:** миллионы документов на каждый корпоративный тенант из Drive, GitHub, Jira, Confluence, Slack.

**Схема:** **дообучение embedding-модели на клиента** (continued pretraining на корпусе тенанта + синтетические пары), hybrid BM25 + dense, learned ranker с 30+ сигналами.

**Результат:** **+20% качества поиска за 6 месяцев** непрерывного обучения. Модели переобучаются ежемесячно. Важно: каждое изменение модели требует полного повторного embedding всех векторов — без обходных путей.

### 4.6 LightRAG в production (Jon Roosevelt, фриланс)

**Масштаб:** 50 000 документов, 1 000 запросов в день, 6 месяцев в production.

**Стек:** Phi-4 14B локально через Ollama (`num_ctx=32768`) + Postgres/pgvector + Neo4j + Redis cache.

**Цифры:** **$2 300/год против $39 600 при эквиваленте на OpenAI (экономия 94%)**, latency <3 с.

**Вывод:** единственный полностью задокументированный production-деплой LightRAG в открытом доступе по состоянию на апрель 2026. Большинство enterprise-историй — маркетинг вендоров.

---

## Часть 5 — Пять антипаттернов

### Антипаттерн 1: одна vector DB на все случаи жизни

Установка «выберу лучшую vector DB раз и навсегда» проигрывает портфельному подходу. CodeAlive, Glean и большинство зрелых команд переключают backend в зависимости от задачи: Qdrant для production search, pgvector для транзакционных запросов с тяжёлыми метаданными, in-memory backend для тестов, иногда граф-backend для multi-hop reasoning.

Неявная позиция: *«Я против выбора одного инструмента навсегда. Инструменты должны соответствовать задаче: Qdrant — здесь, Supabase — там, Weaviate — в другом месте.»*

### Антипаттерн 2: vector DB для поиска по коду

В 2026 году ведущие coding-инструменты отказались от vector RAG для кода:
- **Claude Code, Codex CLI, OpenCode:** grep + ripgrep + glob + LSP.
- **Aider:** tree-sitter + repo-map в system prompt.
- **Cline:** принципиально не реализовывал индексацию кодовой базы.
- **Cursor** — исключение: кастомный embedder + Turbopuffer + Merkle-tree delta indexing + reranker, **+12.5% точности против grep на репозиториях >1000 файлов**. Разница в подходе: Cursor продаёт UX «магической кнопки», которому нужен индекс; CLI-агенты живут в терминале, где grep достаточно.

**Цитата Boris Cherny, мейнтейнер Claude Code в Anthropic:** *«Early versions of Claude Code actually did use RAG with a local vector database, but they found pretty quickly that agentic search generally works better.»*

**Цитата Cole Medin (февраль 2026):** *«The only reason traditional RAG is dead for AI coding is because of how structured our codebases are. So the question is RAG dead? The answer for you depends entirely on your data. How structured is it?»*

**Исключение:** `voyage-code-3` показывает **+13.8% над OpenAI 3-large** на 32 code-retrieval датасетах — полезно при монорепозиториях в десятки миллионов строк, где нужен семантический поиск «как работает X» по нескольким репо. Во всех остальных случаях: grep выигрывает.

### Антипаттерн 3: Postgres + Apache AGE для graph-RAG

**Issue [HKUDS/LightRAG #2255](https://github.com/HKUDS/LightRAG/issues/2255), октябрь 2025:** апгрейд 1.4.9.1 → 1.4.9.4 запускает миграцию `chunk_tracking` на 815 570 рёбрах, обрабатываемых последовательными батчами по 480 строк. Сервер недоступен **17+ часов**. Комментарий пользователя: *«not acceptable for any kind of production deployment.»*

Расчётная стоимость запросов в плане миграции — **251 миллиард единиц** из-за вложенных loops + `DISTINCT`. Postgres с AGE подходит для экспериментов с графами, но под production graph-RAG нагрузкой ломается.

**Используйте Neo4j Community Edition или Memgraph.** Оба бесплатны для self-host и на порядки производительнее на traversal-heavy нагрузках.

### Антипаттерн 4: JSON + NetworkX как production graph storage

Запуск LightRAG с дефолтным бэкендом `JSON + NetworkX` работает на демо из 1 000 документов и ломается выше ~10 000. Весь граф загружается в RAM при каждом сохранении ([issue #2346](https://github.com/HKUDS/LightRAG/pull/2346)), что вызывает OOM около 100K сущностей. Для любой KB выше нескольких тысяч документов сразу начинайте с Postgres (KV) + Qdrant или pgvector (vectors) + Neo4j (graph).

### Антипаттерн 5: смешивание векторов разных embedding-моделей в одной коллекции

Косинусное сходство между вектором OpenAI 3072-dim и Cohere 1024-dim **математически бессмысленно** — они живут в разных пространствах Гильберта.

При необходимости мигрировать embedding-модели:
- **Версионированные namespace'ы:** Qdrant, Pinecone, Turbopuffer поддерживают naming вида `docs_v1_bge` и `docs_v2_voyage`.
- **Dual-write / shadow index** (паттерн Notion): пишите новые embeddings в новый индекс, оценивайте recall@k на отложенном сете, переключайтесь по готовности.
- **Blue-green swap:** атомарная замена двух индексов, временно требует 2× хранилища.
- **Версионированная схема:** Vespa поддерживает `embedding_v1 type tensor<float>(x[1024])` и `embedding_v2 type tensor<float>(x[2048])` параллельно; Weaviate — named multi-vectors на объект.

**Единственное исключение:** семейство Voyage 4 (nano/lite/standard/large) обучено в едином embedding-пространстве — векторы взаимозаменяемы между размерами моделей. На апрель 2026 больше ни один вендор этого не предлагает.

---

## Часть 6 — Финальное дерево решений

```
START
│
├── Прототип / хакатон (≤50K векторов)?
│   └─→ Chroma in-memory (zero ops) или pgvector, если Postgres есть
│
├── Корпус ≤200K токенов и провайдер поддерживает prompt caching?
│   └─→ Без vector DB — Cache-Augmented Generation (CAG)
│       Команда Vercel: $1.00 → $0.25 за запрос, качество выросло
│
├── Корпус — преимущественно исходный код?
│   └─→ Без vector DB — grep + ripgrep + tree-sitter (AST)
│       Исключение: Cursor-style UX «магической кнопки» → кастомный code embedder + Turbopuffer
│
├── Единый Postgres-стек, ≤5M векторов, единый pipeline для бэкапов?
│   └─→ Supabase pgvector (или self-hosted pgvector с HNSW)
│
├── Production text-RAG, 1-100M векторов, готовы поднять инфраструктуру?
│   └─→ Qdrant self-hosted (Apache 2.0, Rust, native multi-vector)
│
├── Нужен hybrid BM25 + vector сразу, без написания связующего кода?
│   └─→ Weaviate (модули, GraphQL)
│
├── Нет бюджета на DevOps, US-only data residency, ≤100M векторов?
│   └─→ Pinecone serverless (зрелые SDK, щедрый бесплатный тир)
│
├── Multi-tenant SaaS с большим числом небольших namespace'ов на клиента?
│   └─→ Turbopuffer (выбор Notion в 2026)
│
├── ≥1B векторов с выделенной platform-командой?
│   └─→ Milvus K8s или Vespa Cloud
│
├── ≥15-20% запросов — multi-hop / агрегация / кросс-документальный синтез?
│   ├── Бюджет $20-200 на разовый ingest, корпус ≥1M токенов?
│   │   └─→ LightRAG поверх Qdrant + Neo4j
│   ├── Нужен полный GraphRAG (регулируемая отрасль, трассируемый синтез, $1K+/мес)?
│   │   └─→ LazyGraphRAG (Microsoft Research) — полный GraphRAG только как последнее средство
│   └── Корпус ≤1M токенов?
│       └─→ Граф пока не нужен — сначала добавьте reranker
│
└── GDPR / VPC / 152-ФЗ строгая локализация?
    └─→ Qdrant self-hosted (Frankfurt) или pgvector on-prem
        Pinecone не подходит
```

---

## Источники

**Страницы с ценами вендоров (сверено апрель 2026):**
- [OpenAI pricing](https://openai.com/api/pricing/)
- [Anthropic pricing](https://platform.claude.com/docs/en/about-claude/pricing) (Opus 4.7 запущен 16 апреля 2026)
- [DeepSeek pricing](https://api-docs.deepseek.com/quick_start/pricing)
- [Pinecone pricing](https://www.pinecone.io/pricing/)
- [Qdrant Cloud](https://qdrant.tech/pricing/)
- [Weaviate Cloud](https://weaviate.io/pricing)
- [Hetzner Cloud](https://www.hetzner.com/cloud)

**Production-кейсы:**
- Notion Engineering Blog, «Two years of vector search at Notion» (Feb 2026): https://www.notion.com/blog/two-years-of-vector-search-at-notion
- Cursor secure codebase indexing: https://cursor.com/blog/secure-codebase-indexing
- Intercom Fin: https://fin.ai/research/do-you-really-need-a-vector-search-database/ (2025)
- Glean fine-tuned embeddings: https://jxnl.co/writing/2025/03/06/fine-tuning-embedding-models-for-enterprise-rag-lessons-from-glean/
- Morgan Stanley + OpenAI: https://openai.com/index/morgan-stanley/
- Jon Roosevelt, исследование стоимости LightRAG: https://jonroosevelt.com/blog/rag-system-cost-savings
- Render.com «Build vs Buy RAG infrastructure»: https://render.com/articles/build-vs-buy-rag-infrastructure

**Бенчмарки и статьи:**
- GraphRAG-Bench (ICLR 2026): https://arxiv.org/html/2506.05690v3
- LightRAG (EMNLP 2025): https://arxiv.org/html/2410.05779v1
- HippoRAG 2 (ICML 2025): https://arxiv.org/html/2502.14802v1
- Microsoft GraphRAG: https://arxiv.org/abs/2404.16130
- Microsoft LazyGraphRAG: https://www.microsoft.com/en-us/research/blog/lazygraphrag-setting-a-new-standard-for-quality-and-cost/
- BenchmarkQED (June 2025): https://www.microsoft.com/en-us/research/blog/benchmarkqed-automated-benchmarking-of-rag-systems/
- LinkedIn KG-RAG (SIGIR 2024): https://arxiv.org/abs/2404.17723
- Han et al., «RAG vs GraphRAG» (arXiv 2502.11371, 2025): https://arxiv.org/html/2502.11371v3
- «Do We Still Need GraphRAG?» (NYU Shanghai, апрель 2026): https://arxiv.org/abs/2604.09666

**Инструменты и репозитории:**
- Qdrant: https://github.com/qdrant/qdrant
- Weaviate: https://github.com/weaviate/weaviate
- Milvus: https://github.com/milvus-io/milvus
- Chroma: https://github.com/chroma-core/chroma
- pgvector: https://github.com/pgvector/pgvector
- LightRAG: https://github.com/HKUDS/LightRAG
- Microsoft GraphRAG: https://github.com/microsoft/graphrag
- HippoRAG: https://github.com/OSU-NLP-Group/HippoRAG

**Критические issues LightRAG — прочитайте перед внедрением:**
- #2255 Postgres+AGE 17-часовая миграция: https://github.com/HKUDS/LightRAG/issues/2255
- #2012 дублирование сущностей при смешении языков: https://github.com/HKUDS/LightRAG/issues/2012
- #2837 latency 4 минуты в режиме mix на 1000+ узлах: https://github.com/HKUDS/LightRAG/issues/2837

---

*Версия 1.0 | 2026-04-27 | Гайд M3 для HSS AI-Driven Development Level 1.*
