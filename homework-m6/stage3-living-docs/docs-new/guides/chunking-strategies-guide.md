> **Language / Язык:** [English](chunking-strategies-guide-en.md) · **Русский** (текущая версия)

---

# Стратегии chunking, hybrid search и reranking для production RAG, 2026

> **Аудитория:** разработчики, которые строят RAG-пайплайны под реальные нагрузки.
> **Цель:** дать проверенные числа, работающие стратегии и антипаттерны, которые стоят командам месяцев тихой деградации качества.
> **Дата:** 2026-04-27. Все цифры сверены минимум по двум независимым источникам (документация вендоров, бенчмарки, production кейсы). Каждое утверждение снабжено ссылкой.

---

## TL;DR — ключевые числа

Если читаете только один раздел — читайте этот.

| Параметр | Production-дефолт | Источник |
|---|---|---|
| Chunk size | **300–512 токенов**, recursive | Vecta/Prem AI benchmark 2026, Microsoft Azure docs |
| Overlap | **20% (50–100 токенов)** | Microsoft Azure: 512/128 |
| Top-K к LLM | **4–6 chunks** | Несколько источников: порог Context Bloat |
| Минимальный floor для semantic chunking | **200–400 токенов** | FloTorch benchmark |
| Hybrid против BM25-only | **+35%** | Исследование Chatsy/Medium 2025 |
| Hybrid против semantic-only | **+22%** | Exa Q5 production catalog |
| Совокупный top-10 | **87% релевантных** против 62% BM25 / 71% semantic | Chatsy 2026-03-30 |
| Выигрыш reranker (Cohere) | **+25% точности** за +100 мс задержки | Ailog 2025-02 |
| Рост MRR по стеку | 0.52 → 0.85 (базовый → полный пайплайн) | Chatsy 2026-03-30 |
| Contextual Retrieval | **−67% ошибок retrieval** | Блог Anthropic |
| Без metadata | **до 80% нерелевантных результатов** | Несколько источников |
| Naive embedding-RAG | **40–70% точности** | Production бенчмарки |

Полный пайплайн: **semantic chunking → hybrid BM25+dense → RRF fusion → reranker → top-4 к LLM.** Каждый этап усиливает предыдущий.

---

## Часть 1 — Стратегии chunking

### Почему chunking важнее всего остального

Качество chunks задаёт потолок для всех последующих компонентов. Ни одна embedding-модель, стратегия hybrid search или reranker не вернут информацию, потерянную из-за разреза предложения пополам или 40-токенного фрагмента без самостоятельного смысла.

Консенсус production-команд в 2026 году: начинайте с recursive character splitting, запускайте бенчмарки на собственных данных, и только там, где бенчмарк покажет явный выигрыш, добавляйте более сложные стратегии.

### 1.1 Fixed-size splitting

Самый простой подход: делим текст на части по N символов или токенов, не глядя на структуру контента.

**Когда работает:** короткие однородные документы (описания товаров, строки БД, стандартизированные формы) — там каждый chunk будет примерно одинаковой смысловой плотности.

**Когда не работает:** нарративный текст, техническая документация, любой контент, где смысл охватывает несколько абзацев. Фиксированный разрез часто приходится на середину предложения или концепции.

**Числа:**
- Минимальные вычислительные расходы среди всех стратегий.
- Качество на смешанных корпусах: на 10–15% ниже recursive splitting ([Prem AI benchmark, 2026-03](https://blog.premai.io/rag-chunking-strategies-the-2026-benchmark-guide/)).

**Пример кода (LangChain):**
```python
from langchain.text_splitter import CharacterTextSplitter

splitter = CharacterTextSplitter(
    separator="\n",
    chunk_size=512,
    chunk_overlap=100,
    length_function=len,
)
chunks = splitter.split_text(document)
```

### 1.2 Recursive character splitting — production-дефолт

Recursive splitting перебирает иерархию разделителей (`\n\n`, `\n`, ` `, ``) по порядку, переходя к более мелкому только когда chunk всё ещё превышает целевой размер. Это естественно сохраняет границы абзацев и предложений.

**Почему это дефолт в 2026:**
- 69% точности на крупнейшем бенчмарке реальных документов (Prem AI, март 2026, более 1 000 документов из 12 доменов).
- Документация Microsoft Azure AI Search прямо рекомендует 512 токенов / 128 overlap (25%) как отправную точку.
- Бенчмарк Arize AI: 300–500 токенов с K=4 дают лучший баланс скорости и качества.

**Параметры по типу контента:**

| Тип контента | Chunk size | Overlap |
|---|---|---|
| Фактоидные запросы (имена, даты, числа) | 256–512 токенов | 10–15% |
| Аналитические запросы (объяснения, сравнения) | 1 024+ токенов | 20–25% |
| Смешанная нагрузка | 400–512 токенов | 15–20% |
| Плотный технический (API docs, спецификации, код) | 256–384 токена | 10–15% |
| Нарративный (статьи, отчёты, длинные тексты) | 768–2 048 токенов | 20–30% |

**Пример кода (LangChain):**
```python
from langchain.text_splitter import RecursiveCharacterTextSplitter

splitter = RecursiveCharacterTextSplitter(
    chunk_size=512,
    chunk_overlap=100,
    length_function=len,
    separators=["\n\n", "\n", " ", ""],
)
chunks = splitter.split_documents(documents)
```

**Неожиданный вывод (исследование SPLADE, январь 2026):** overlap не даёт **никакого измеримого эффекта** для sparse retrieval. Если у вас только BM25 или SPLADE-индекс — overlap не нужен, он лишь занимает место. Проверьте с overlap и без на реальном распределении запросов, прежде чем принимать решение.

### 1.3 Semantic chunking

Вместо разбиения по фиксированному числу токенов semantic chunking использует embedding-модель, чтобы найти точки смены темы, и режет именно там.

**Когда выигрывает:** тематически разнородная неструктурированная проза, где абзацы часто меняют предмет: исследовательские статьи, длинные посты, базы знаний на разные темы.

**Ожидаемый выигрыш:** +9% recall по сравнению с recursive splitting на нарративном контенте ([ATLASSC.NET benchmark, 2026-03-30](https://atlassc.net/2026/03/30/text-chunking-strategies-for-rag)).

**Критичное ограничение — floor для `min_chunk_size`:**

Кейс FloTorch (2026) — наглядное предупреждение: они запустили semantic chunking без минимального порога chunk'а и получили 54% chunks со средним размером 43 токена. Такие микрофрагменты лишены самостоятельного контекста и ухудшают retrieval. Всегда устанавливайте `min_chunk_size=200`–`400` токенов.

**Пример кода:**
```python
from langchain_experimental.text_splitter import SemanticChunker
from langchain_openai.embeddings import OpenAIEmbeddings

chunker = SemanticChunker(
    embeddings=OpenAIEmbeddings(),
    breakpoint_threshold_type="percentile",
    breakpoint_threshold_amount=95,
)
# Всегда применяйте минимальный floor после разбиения
raw_chunks = chunker.split_text(document)
chunks = [c for c in raw_chunks if len(c.split()) >= 50]  # ~200 токенов
```

**Когда не стоит применять:** небольшие корпусы (до 500 документов) или корпусы с однородными темами. Вычислительная нагрузка в 3–5 раз выше, чем у recursive splitting, а выигрыш проявляется только на по-настоящему разнородных текстах.

### 1.4 Sentence window chunking

Для поиска используем отдельные предложения или небольшие chunks по 128–256 токенов — они точнее совпадают с конкретными формулировками запроса. Но когда chunk найден, LLM получает расширенное окно вокруг него: родительский абзац или блок 512–1 024 токена.

**Почему это работает:** короткие chunks — точное совпадение с запросом; длинный контекст — всё, что нужно LLM для хорошего ответа. Получаем точность малых chunks и полноту больших.

**Типовая конфигурация:** дочерние chunks 128–256 токенов для embedding; родительские окна 512–1 024 токена для передачи в LLM.

```python
# Псевдокод для parent-child retrieval
child_retriever = vector_store.as_retriever(search_kwargs={"k": 20})
parent_store = InMemoryStore()

retriever = ParentDocumentRetriever(
    vectorstore=vector_store,
    docstore=parent_store,
    child_splitter=RecursiveCharacterTextSplitter(chunk_size=200),
    parent_splitter=RecursiveCharacterTextSplitter(chunk_size=1000),
)
retriever.add_documents(documents)
```

### 1.5 Hierarchical chunking

Hierarchical chunking строит многоуровневый индекс: крупные summary-chunks на верхнем уровне, детальные chunks — на нижнем. При поиске summary-уровень работает как грубый фильтр, детальные chunks — для точного retrieval.

**Лучше всего подходит:** объёмные технические руководства, юридические документы, продуктовая документация с разделами и подразделами.

**Стоимость:** высокая — и при создании индекса, и при его поддержке. Оправдывает себя только когда в документах действительно есть иерархическая структура и запросы требуют навигации по ней.

---

## Часть 2 — Ключевые бенчмарки

### Vecta / Prem AI benchmark (март 2026)

Крупнейший публично доступный бенчмарк по chunking на 2026 год ([блог Prem AI](https://blog.premai.io/rag-chunking-strategies-the-2026-benchmark-guide/)): 1 000+ реальных документов из 12 доменов.

| Стратегия | Точность |
|---|---|
| Recursive 400–512 токенов, 20% overlap | **69%** |
| Постраничный (PDF-страницы) | Лучший на финансовых документах, наименьший разброс |
| Semantic chunking с floor | +9% к recursive на нарративе |
| Fixed-size без overlap | ~10–15% хуже recursive |

**Главный вывод:** единственно верной стратегии для всех доменов не существует. На финансовых PDF выигрывает постраничный chunking (страница = осмысленная единица). На разнородной прозе — semantic. Recursive — безопасный дефолт общего назначения.

### Документация Microsoft Azure (официальная рекомендация)

Документация Microsoft Azure AI Search (проверено апрель 2026) рекомендует:
- **512 токенов на chunk** — стартовый дефолт.
- **128 токенов overlap (25%)** — для общих нагрузок.
- Более широкий overlap (30–40%) — для контента с плотными перекрёстными ссылками.

Источник: [Microsoft Azure AI Search — chunking docs](https://learn.microsoft.com/en-us/azure/search/vector-search-how-to-chunk-documents).

### Провальный кейс FloTorch

FloTorch запустил semantic chunking на production-корпусе без минимального floor. Итог: 54% chunks — 43 токена в среднем, слишком мало для самостоятельного смысла. Качество retrieval упало ниже recursive baseline. Решение: `min_chunk_size=300` восстановило и превысило baseline.

Это самый цитируемый chunking-провал 2026 года — именно поэтому минимальный floor теперь входит в каждый гайд по semantic chunking как обязательное требование.

---

## Часть 3 — Паттерн metadata

### Без metadata: до 80% нерелевантных результатов

Векторный поиск без фильтрации по metadata возвращает ранжированный список chunk-векторов. Без metadata (source URL, номер страницы, раздел документа, дата, теги, breadcrumbs) у модели нет возможности отфильтровать результаты по сигналам релевантности за пределами embedding-пространства. Несколько production post-mortem сообщают о **до 80% нерелевантных результатов** при отсутствии metadata.

Минимальный набор metadata на chunk:
```python
metadata = {
    "source_url": "https://docs.example.com/api/authentication",
    "page_number": 3,
    "section": "OAuth 2.1 flows",
    "document_type": "api_reference",
    "ingested_at": "2026-04-27T10:30:00Z",
    "sha1_hash": "a3f5c8d2...",  # для дедупликации
}
```

### Record Manager — паттерн для инкрементальных обновлений

Векторные базы данных не отслеживают версии документов. Без слоя дедупликации повторный ingest создаёт дублирующиеся chunks, которые конкурируют при retrieval и раздувают storage. Record Manager решает эту проблему.

```python
from langchain.indexes import SQLRecordManager, index

record_manager = SQLRecordManager(
    "my_namespace", db_url="sqlite:///record_manager_cache.sql"
)
record_manager.create_schema()

# При каждом запуске ingest:
result = index(
    docs_to_index,
    record_manager,
    vector_store,
    cleanup="incremental",    # удаляет старые версии обновлённых документов
    source_id_key="source_url",
)
# result: {"num_added": 12, "num_updated": 3, "num_deleted": 5, "num_skipped": 0}
```

Паттерн гарантирует: при изменении документа его старые chunks удаляются и заменяются, а не накапливаются устаревшими версиями.

### SHA-1 дедупликация для точных дубликатов

Перед embedding вычисляем SHA-1 хэш текста каждого chunk. Chunk, хэш которого уже есть в базе, пропускаем. Это устраняет точные дубликаты почти без накладных расходов.

```python
import hashlib

def chunk_id(text: str) -> str:
    return hashlib.sha1(text.encode()).hexdigest()

existing_ids = set(record_manager.list_keys())
chunks_to_ingest = [c for c in chunks if chunk_id(c.page_content) not in existing_ids]
```

Для обнаружения почти-дубликатов при больших объёмах комбинируйте SHA-1 с MinHash или порогом косинусного сходства (>85%) для нечёткой дедупликации.

---

## Часть 4 — Hybrid search: BM25 + dense + RRF

### Почему чистого semantic search недостаточно

Dense embedding-модели хорошо улавливают семантику, но у них есть известная слабость: они теряют точные идентификаторы. Запрос `"CVE-2025-54135"` или `"voyage-code-3"` или конкретный SKU товара часто не найдёт результаты в чисто dense-индексе — модель сжимает строки в многомерное пространство, не сохраняя точных символьных последовательностей.

BM25 — полная противоположность: ищет точные термины, но не понимает смысла. `"transformer architecture"` не совпадёт с `"attention mechanism"` через BM25.

Комбинация устраняет оба недостатка.

### Числа (подтверждены в production)

| Подход к retrieval | Топ-10 релевантных документов |
|---|---|
| Только BM25 | 62% |
| Только dense (semantic) | 71% |
| **Hybrid BM25 + semantic + reranking** | **87%** |

Источник: исследование Chatsy по оптимизации advanced RAG, [2026-03-30](https://chatsy.app/blog/advanced-rag-optimization). Подтверждено независимыми измерениями из нескольких источников.

Дополнительные проверенные числа:
- Отключение BM25 в hybrid-конфигурации Weaviate снижает точность на **30–40%** на технических корпусах ([бенчмарки Weaviate hybrid search](https://weaviate.io/blog/hybrid-search-explained)).
- Hybrid search сокращает число неудачных запросов на **49%** по сравнению с semantic-only (сводные production-данные из нескольких KB-источников).
- Суммарный выигрыш перед чистым semantic: **+35%** ([исследование 2025 на Medium](https://medium.com/)).

### Reciprocal Rank Fusion (RRF) — стандартный алгоритм слияния

RRF объединяет ранжированные списки от BM25 и dense retrieval без нормализации оценок. Для каждого документа:

```
RRF_score(d) = Σ_r 1 / (k + rank_r(d))
```

Здесь `rank_r(d)` — ранг документа `d` в ранжировщике `r`, `k=60` — константа сглаживания (стандартное значение).

```python
def reciprocal_rank_fusion(ranked_lists: list[list[str]], k: int = 60) -> dict[str, float]:
    scores = {}
    for ranked_list in ranked_lists:
        for rank, doc_id in enumerate(ranked_list, start=1):
            scores[doc_id] = scores.get(doc_id, 0) + 1.0 / (k + rank)
    return dict(sorted(scores.items(), key=lambda x: x[1], reverse=True))
```

**Почему RRF, а не линейная комбинация:** RRF не требует подбора параметров и устойчив к разным масштабам оценок BM25 и косинусного сходства. Линейная комбинация требует точной настройки весов (оптимум для Weaviate: 0.5/0.5 или 0.75 BM25 / 0.25 dense), которые деградируют при сдвиге распределения данных.

### Векторные БД с нативной поддержкой hybrid search

| База данных | Реализация hybrid | Примечание |
|---|---|---|
| Qdrant | Нативный dense + sparse + RRF через Query API | Один round-trip, prefetch + rerank |
| Weaviate | Нативный BM25 + vector + RRF-модули | Декларативно, без связующего кода |
| Milvus 2.5+ | Нативный BM25 + RRFRanker + WeightedRanker | Enterprise-масштаб |
| PostgreSQL + pgvector | DIY через `tsvector` + cosine ops | Ручная сборка |
| PostgreSQL + ParadeDB | Нативный BM25 на Postgres | Расширение, полного hybrid нет |

---

## Часть 5 — Reranker: последняя миля

### Архитектура: почему cross-encoders точнее bi-encoders на последней миле

Embedding-модель для retrieval — это **bi-encoder**: запрос и документ кодируются раздельно, потом считается косинусное сходство. Быстро (один прямой проход на документ), но ограничено по точности: при кодировании документа модель не видит запрос.

**Cross-encoder** (reranker) получает пары `(запрос, документ)` и оценивает их совместно — один прямой проход, и модель видит и то, и другое сразу. Это позволяет уловить взаимодействие между запросом и документом, которое bi-encoder пропускает.

Production-числа: на данных юридического retrieval дообученный cross-encoder достиг **95% точности на 72 обучающих парах** против 30% у базовой модели ([Towards Data Science, 2026-04-11](https://towardsdatascience.com/advanced-rag-retrieval-cross-encoders-reranking/)).

### Сравнение reranker-моделей (2026)

| Модель | nDCG@10 | Задержка p95 | Стоимость / 1K запросов | Примечание |
|---|---|---|---|---|
| Cohere rerank-v4.0-pro | **0.735** | 210 мс | $2.40 | API, контекст 32K, 100+ языков |
| MonoT5-3B | 0.726 | 480 мс | $1.25 | Лучшее open-качество, требует GPU |
| **bge-reranker-large v2** | **0.715** | 145 мс | **$0.35** | Лучшее open-качество на GPU |
| LLM small (API) | 0.708 | 240 мс | $1.70 | Без инфраструктуры, настраивается промптом |
| bge-reranker-base v2 | 0.699 | 92 мс | $0.18 | 90% качества за половину цены |
| Jina reranker-v2-multilingual | 0.694 | 110 мс | $0.30 | Лучший выбор для многоязычного контента |
| MiniLM-L-6-v2 | 0.662 | 55 мс | $0.08 | Работает на CPU, минимальный baseline |
| jina-reranker-v3 | н/д | н/д | $0.08 | Контекст 131K, listwise на 64 документа |

Источник: Bhagya Rana, [Medium 2025-09](https://medium.com/@bhagyarana80/top-8-rerankers-quality-vs-cost-4e9e63b73de8); charleschen.ai wiki; Ailog 2025.

### Выигрыш в точности по уровням reranker

| Пайплайн | Добавленная задержка | Стоимость / 1K | Прирост качества |
|---|---|---|---|
| Без reranking | 0 мс | $0 | Baseline |
| TinyBERT | +30 мс | self-host | +10% |
| MiniLM | +50 мс | self-host | +20% |
| **Cohere Rerank** | **+100 мс** | **$1** | **+25%** |
| LLM listwise (GPT-4) | +500 мс | $5–20 | +30% |

Источник: [Ailog 2025-02](https://app.ailog.fr/en/blog/guides/reranking).

### Дерево решений для production

1. **Ограниченный бюджет или высокий QPS:** k=150 первичный retrieval → MiniLM (top-20) → генератор.
2. **Сбалансированный дефолт (большинство production-нагрузок):** k=200 → `bge-reranker-base-v2` (top-20) → генератор. Добавьте `jina-reranker-v2-multilingual`, если корпус многоязычный.
3. **Приоритет качества:** k=200 → `bge-reranker-large-v2` (top-50) → MonoT5-3B (top-20) → генератор. Или Cohere Rerank в два прохода.
4. **Корпус с длинными документами:** `jina-reranker-v3` в listwise-режиме (64 документа за запрос, контекст 131K).

### Ключевое правило порядка

**Reranker — последняя миля, не первый шаг.** Инвестировать в reranker при незрелом chunking и слабом retrieval — выброшенные деньги: reranker выбирает только из того, что retrieval ему принёс. Сначала исправьте retrieval, потом добавляйте reranker.

---

## Часть 6 — Anthropic Contextual Retrieval

В конце 2024 года Anthropic опубликовал Contextual Retrieval. Техника добавляет к каждому chunk перед embedding короткий контекстный заголовок, сгенерированный LLM. Заголовок помещает chunk в контекст документа — например: «Этот отрывок из звонка об итогах Q3 2025 посвящён прогнозу компании по расходам на облачную инфраструктуру в регионе APAC».

**Результаты из бенчмарка Anthropic:**
- **−67% ошибок retrieval** по сравнению со стандартным chunking.
- Особенно эффективно для chunks из длинных документов, где окружающий контекст существенно меняет смысл фрагмента.

**Как это работает:**

```python
import anthropic

client = anthropic.Anthropic()

CONTEXT_PROMPT = """<document>
{full_document}
</document>

Here is the chunk we want to situate within the whole document:
<chunk>
{chunk_content}
</chunk>

Please give a short succinct context to situate this chunk within the overall document for
the purposes of improving search retrieval of the chunk. Answer only with the succinct
context and nothing else."""

def add_context(document: str, chunk: str) -> str:
    response = client.messages.create(
        model="claude-haiku-4-5",
        max_tokens=200,
        messages=[{"role": "user", "content": CONTEXT_PROMPT.format(
            full_document=document, chunk_content=chunk
        )}]
    )
    context = response.content[0].text
    return f"{context}\n\n{chunk}"

contextualized_chunks = [add_context(full_doc, chunk) for chunk in chunks]
```

**Стоимость:** один вызов LLM на chunk при ingest. Для корпуса 10 000 chunks на Claude Haiku при $0.25/1M входных токенов суммарная стоимость ingest — около $0.50–2.00. Разовые расходы, которые окупаются снижением ошибок на 67%.

Источник: [Anthropic blog — Introducing Contextual Retrieval](https://www.anthropic.com/news/contextual-retrieval).

---

## Часть 7 — Антипаттерны

Это отказы, которые чаще всего встречаются в production post-mortem, бенчмарках сообщества и RAG-литературе 2025–2026 годов.

### Антипаттерн 1: Top-K выше 6

Передача LLM более 6 chunks приводит к тому, что в сообществе называют **Context Bloat**: внимание модели распределяется по конкурирующей или касательной информации, что усиливает галлюцинации. Зафиксированная закономерность: LLM работают лучше всего, когда полученный контекст плотно релевантен и компактен.

**Решение:** держите top-4 до top-6. Используйте фильтрацию по оценке: если разрыв между первым и вторым результатом большой — передавайте только первый. Нужен более широкий охват? Двухэтапный пайплайн: rerank до top-20, затем резюмируйте перед передачей в генератор.

### Антипаттерн 2: Отсутствие конвертации в Markdown перед chunking

Многие пайплайны ingestion обрабатывают PDF или HTML как сырой извлечённый текст. Таблицы превращаются в числа через пробелы, заголовки теряют семантическую роль, блоки кода сливаются с окружающей прозой.

**Что происходит:** embedding-модель получает структурно бессвязный текст. Ячейка таблицы со значением `512` ничего не значит без заголовка столбца `"chunk_size"`. Chunks, которые захватывают границу таблицы, становятся бессмысленными.

**Решение:** конвертируйте документы в чистый Markdown перед chunking. Инструменты: Docling (бесплатно, локально, 97.9% точности на сложных таблицах), LlamaParse ($0.00125/страница, облако), Reducto (enterprise, максимальная точность на сложных макетах).

### Антипаттерн 3: Semantic chunking без `min_chunk_size`

Разобрали в части 2 (кейс FloTorch), но стоит повторить явно как антипаттерн: semantic chunking без минимального floor порождает микрофрагменты без самостоятельного смысла и делает retrieval хуже, а не лучше.

**Решение:** всегда устанавливайте `min_chunk_size=200`–`400` токенов при semantic- или LLM-based chunking.

### Антипаттерн 4: Смешивание embedding-моделей в одной коллекции

Каждая embedding-модель порождает векторы в собственном координатном пространстве. Косинусное сходство между вектором из `text-embedding-3-large` и вектором из `BGE-M3` **математически бессмысленно** — они живут в разных гильбертовых пространствах.

Это самая распространённая причина тихой деградации качества после миграции модели: команда меняет модель, переиндексирует новые документы, но оставляет старые с прежним embedding. Retrieval работает, качество незаметно падает.

**Решение:** при смене embedding-модели переиндексируйте весь корпус. Используйте версионированные namespaces (`docs_v1_bge`, `docs_v2_cohere`) и dual-write в период оценки. Переключайтесь только после проверки recall@10 на отложенном eval-наборе.

### Антипаттерн 5: Векторизация табличных и числовых данных

Embedding-модели, обученные на естественном языке, не умеют работать с агрегацией, отрицанием или числовыми сравнениями. Запрос «покажи всех клиентов с выручкой выше $50K в Q4» не ответить косинусным сходством по embedding строк таблицы.

**Решение:** для структурированных данных используйте Text-to-SQL. RAG — только для неструктурированного текста. Добавьте intent-роутер, который определяет тип запроса до выбора пути retrieval.

---

## Часть 8 — Дерево решений для выбора стратегии chunking

```
СТАРТ: Какой у вас тип документов?
│
├── Короткие однородные единицы (описания товаров, FAQ, строки БД)
│   └─→ Fixed-size splitting, 256–512 токенов, минимальный overlap
│       Простейшая реализация, низкая вычислительная нагрузка
│
├── API-документация, код, технические спецификации
│   └─→ Recursive splitting, 256–384 токена, overlap 10–15%
│       Размер chunk — под гранулярность отдельных операций
│
├── Смешанный контент общего назначения (базы знаний, wiki)
│   └─→ Recursive splitting, 400–512 токенов, overlap 15–20%
│       Дефолт Microsoft Azure: 512/128, подтверждён бенчмарком Vecta
│
├── Тематически разнородная проза (статьи, исследования, отчёты)
│   └─→ Semantic chunking с min_chunk_size=300
│       +9% recall на нарративе против recursive, но нагрузка в 3–5× выше
│
├── Длинные документы, где контекст вокруг фрагмента меняет его смысл
│   └─→ Parent-child: embed children на 256 токенов, retrieve parents на 1 024
│       ИЛИ: Anthropic Contextual Retrieval (LLM-заголовок перед каждым chunk)
│       −67% ошибок retrieval (Anthropic) против стандартного chunking
│
├── Юридические, медицинские, регуляторные документы с глубокой иерархией
│   └─→ Hierarchical chunking (уровни summary + detail)
│       Максимальная нагрузка, оправдывается только при подлинной иерархии
│
└── PDF, HTML или отсканированные документы
    └─→ Сначала конвертируйте в Markdown (Docling — локально/бесплатно, LlamaParse — облако)
        Затем выбирайте стратегию по типу контента выше
        Парсинг PDF занимает 30–50% времени всего RAG-проекта — не пропускайте этот шаг
```

**Минимальный рабочий production-пайплайн** для нового RAG-сервиса в 2026 году:

1. Конвертируйте все документы в чистый Markdown (Docling или LlamaParse).
2. Добавьте обязательный набор metadata (source, date, section, SHA-1 хэш) к каждому документу.
3. Разбейте recursive splitting на 400–512 токенов, overlap 20%.
4. Постройте embedding через BGE-M3 (self-hosted, многоязычный, бесплатно) или Cohere Embed v4 (managed, контекст 128K).
5. Создайте и dense (vector), и sparse (BM25) индекс.
6. При запросе: извлеките top-20 из каждого, объедините через RRF, переранжируйте `bge-reranker-base-v2`, передайте top-4 в генератор.
7. Запустите оценку на 50–100 размеченных парах «запрос–ответ» перед выкаткой. Цели: Faithfulness >0.85, Context Recall >0.75.

Naive embedding-RAG даст **40–70% точности**. Полный пайплайн выше на том же корпусе обычно достигает **82–87%**.

---

## Источники

**Бенчмарки:**
- Prem AI / Vecta chunking benchmark 2026: https://blog.premai.io/rag-chunking-strategies-the-2026-benchmark-guide/
- ATLASSC.NET chunking strategy comparison: https://atlassc.net/2026/03/30/text-chunking-strategies-for-rag
- Firecrawl chunking guide (Oct 2025): https://www.firecrawl.dev/blog/best-chunking-strategies-rag
- Chatsy advanced RAG optimization: https://chatsy.app/blog/advanced-rag-optimization

**Rerankers:**
- Bhagya Rana — top 8 rerankers quality vs cost: https://medium.com/@bhagyarana80/top-8-rerankers-quality-vs-cost-4e9e63b73de8
- Ailog reranking guide: https://app.ailog.fr/en/blog/guides/reranking
- ZeroEntropy open-source reranker alternatives: https://zeroentropy.dev/articles/open-source-alternatives-to-cohere-rerank
- Towards Data Science — cross-encoders: https://towardsdatascience.com/advanced-rag-retrieval-cross-encoders-reranking/

**Антипаттерны production RAG:**
- 7 production RAG mistakes: https://dev.to/aashir04m/7-production-rag-mistakes-i-made-and-how-to-fix-them-26jl
- Production RAG anti-patterns catalog: https://wiki.charleschen.ai/ai/processed/wiki/llm-core/rag/raw/web/rag-anti-patterns-production-catalog-2026
- Production best practices 2026: https://www.roborhythms.com/how-to-build-production-rag-pipeline-2026/

**Hybrid search:**
- Weaviate hybrid search explained: https://weaviate.io/blog/hybrid-search-explained
- Advanced RAG hybrid retrieval: https://ragaboutit.com/beyond-basic-rag-building-query-aware-hybrid-retrieval-systems-that-scale/

**Contextual Retrieval:**
- Anthropic Contextual Retrieval blog: https://www.anthropic.com/news/contextual-retrieval

**Microsoft Azure:**
- Azure AI Search chunking documentation: https://learn.microsoft.com/en-us/azure/search/vector-search-how-to-chunk-documents

**Query transformation:**
- Advanced RAG techniques that work in production: https://medium.com/@jugalshethpro/advanced-rag-techniques-what-actually-works-in-production-2de1b0ff2fe8

---

*Версия 1.0 | 2026-04-27 | Гайд M3 для HSS AI-Driven Development Level 1.*
