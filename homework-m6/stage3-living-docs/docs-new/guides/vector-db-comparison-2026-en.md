> **Language / Язык:** **English** (current version) · [Русский](vector-db-comparison-2026.md)

---

# Vector databases for production RAG, 2026 — comparison guide

> **Audience:** developers and PMs picking a vector storage layer for a RAG system.
> **Goal:** distil the 2026 landscape into a decision tree, deep technical breakdowns per database, scale-aware cost matrix, migration patterns, and the anti-patterns you should not repeat.
> **Date:** 2026-04-27. All numbers cross-checked against vendor documentation, peer-reviewed papers, and independent benchmarks. Every claim has a source link.

---

## TL;DR — pick by use case

If you only read one section, this is it. Match your situation against the left column and move:

| Your situation | Default backend in 2026 | Reason |
|---|---|---|
| Pet project / hackathon, <50K vectors | **Chroma in-memory** or **pgvector** if Postgres exists | Zero ops, `pip install chromadb`, free |
| MVP / 1-3 dev team, <5M vectors, single Postgres stack | **Supabase pgvector** | One stack: auth + storage + vectors + backups |
| Production text-RAG, 1-100M vectors, self-host capable | **Qdrant self-hosted** (Hetzner €5-50/mo) | Apache 2.0, Rust, hybrid search, native multi-vector for ColPali |
| Hybrid BM25 + vector out of the box | **Weaviate** | Native BM25 + vector + RRF fusion, GraphQL, modules system |
| Need managed serverless, no ops budget | **Pinecone** | Serverless tier, 5GB free, no DevOps required |
| Enterprise scale, 1B+ vectors, dedicated ops team | **Milvus** (FAISS-backed) | Industrial scale, distributed by design |
| Brand-new serverless, object-storage backed | **Turbopuffer** | Notion case: −60% search spend, cold start tradeoffs |
| Multi-hop reasoning, entity-centric queries | **LightRAG** + Qdrant or Neo4j | Graph layer with cost-efficient extraction |
| Cross-document summarization, multi-million token corpus | **Microsoft GraphRAG** or **LazyGraphRAG** | Community summaries; full GraphRAG only at premium budget |
| 152-FZ / GDPR / VPC-only data residency | **Qdrant self-host** (Frankfurt) or **pgvector** on-prem | Pinecone is cloud-only, blocked for strict residency |
| Code search at scale | **No vector DB** — use grep + ripgrep + AST | Coding agents in 2026 abandoned vector indexing |

The rest of this guide explains *why* each row reads the way it does.

---

## Part 1 — Categories of vector storage in 2026

The market splits into four architectural families. Knowing which family you are looking at saves a week of vendor evaluation.

### 1.1 Managed cloud (multi-tenant SaaS)

**Members:** Pinecone, Weaviate Cloud, Qdrant Cloud, Zilliz (Milvus Cloud), MongoDB Atlas Vector Search.

**Strengths:** zero ops, auto-scaling, SLAs, observability dashboards, regional residency options.

**Weaknesses:** vendor lock-in, egress fees, hard cost ceiling at large scale, audit trails only for premium tiers.

**Pricing pattern:** per-vector or per-pod. At 1B vectors Pinecone is roughly **$3,500/mo**, Qdrant Cloud roughly **$1,200/mo**, while self-hosted Qdrant on Hetzner is roughly **$800/mo + ops cost** ([Pinecone serverless pricing](https://www.pinecone.io/pricing/), [Qdrant Cloud pricing](https://qdrant.tech/pricing/), April 2026 verified).

### 1.2 Self-host single-process

**Members:** Qdrant (Rust), Milvus standalone, Weaviate Docker, Chroma, FAISS (library).

**Strengths:** Apache/MIT licences, full control of data residency, predictable cost (it is just RAM and CPU you already pay for), easy to embed in microservices.

**Weaknesses:** you own the ops — backups, snapshots, HA, scaling shards, kernel tuning. For Qdrant `vm.max_map_count` and HNSW `m`/`ef_construct` parameters affect both latency and recall.

**When this wins:** team has ≥1 engineer with infra background; compliance forbids SaaS.

### 1.3 Postgres extensions

**Members:** pgvector, pgvecto-rs, VectorChord, ParadeDB.

**Strengths:** the database your team already operates. Single backup pipeline, single auth model, transactional consistency between metadata and vectors. **As of pgvector 0.7 + 0.8 (2026)** HNSW indexes scale to 1-5M vectors comfortably, halfvec to 4000 dims.

**Weaknesses:** above ~5M vectors HNSW build time and memory blow up; complex hybrid search needs DIY (`tsvector` + `vector_cosine_ops`); no native sparse vectors without extensions.

**Real migration story:** Firecrawl and Berri AI moved **from Pinecone to Supabase pgvector** specifically because metadata filtering on Pinecone became painful at scale — Caleb Peffer (Firecrawl CEO): *"If you need to store a bunch of metadata, [Pinecone/Weaviate/Faiss] becomes a huge pain."* ([Render.com analysis, 2026](https://render.com/articles/build-vs-buy-rag-infrastructure)).

### 1.4 Serverless object-storage backed

**Members:** Turbopuffer, Pinecone serverless, Vespa Cloud.

**Strengths:** pay for storage and queries, not idle pods. Notion migrated from Pinecone serverless **to Turbopuffer** in 2026 and reported −60% search-engine spend, p50 latency 70-100 ms → 50-70 ms ([Notion engineering, Feb 2026](https://www.notion.com/blog/two-years-of-vector-search-at-notion)).

**Weaknesses:** cold-start latency for rarely-used namespaces; less mature ecosystem; immature support for advanced patterns like multi-vector ColPali.

### 1.5 Graph-based (the new hybrid family)

**Members:** LightRAG, Microsoft GraphRAG, LazyGraphRAG, HippoRAG 2, nano-graphrag, FastGraphRAG.

**Why a separate category:** these are not stand-alone vector databases — they wrap one (Qdrant, Neo4j, Postgres+pgvector). They add an entity-relation graph layer on top, indexed during ingest by an LLM. Treat them as a *retrieval architecture* on top of a *vector store*, not as a competitor to Qdrant.

---

## Part 2 — Deep dives on the databases that matter

### 2.1 Qdrant

**Made by:** Qdrant Solutions (Berlin), Apache 2.0, written in Rust.

**Architecture highlights:**
- HNSW with binary, scalar, and product quantization (1.15+ also 1.5/2-bit).
- **First-class multi-vector support** (named vectors, MUVERA, MaxSim) — this matters in 2026 because ColPali and other late-interaction document retrieval models need it natively.
- Hybrid search via Query API with prefetch + RRF/DBSF fusion in a single round-trip.
- mmap + disk HNSW lets you keep collections far larger than RAM.

**Hybrid search:** native dense + sparse + RRF. Qdrant docs published 2026-02 benchmarks showing **+15-20% accuracy** vs vector-only on multi-domain corpora.

**Multimodal:** native first-class for ColPali-style models — `Vespa, Qdrant, Weaviate, Astra` are the 4 production-ready vector DBs for visual RAG by April 2026.

**n8n and integrations:** Qdrant has a native n8n node since 2024, with full CRUD on collections, hybrid search, payload filtering, and batch upsert. This matters because n8n has become the no-code orchestration default for AI workflows.

**Cost (April 2026):**
- Self-hosted on Hetzner €5-50/mo for 1-100M vectors.
- Qdrant Cloud `eu-central-1` Frankfurt: from $0.014/hr for 1GB cluster, scaling to ~$1,200/mo at 1B vectors.

**When to pick:** anything between 1M and 1B vectors where you can run infrastructure or pay for managed. Default open-source choice for production text-RAG in 2026.

**When not to pick:** under 1M vectors with an existing Postgres — pgvector is enough. Above 1B vectors with sub-50ms p99 SLOs — Milvus or Vespa scale better.

**Caveats:**
- HNSW `m` and `ef_construct` defaults are conservative; tune for recall.
- Quantization with full vectors disabled (Scalar Int8) gives 4× memory savings at <1% recall loss; binary at 32× requires rescoring (top-100 binary → top-10 full precision).
- The Rust toolchain matters for compilation times in custom builds.

### 2.2 Weaviate

**Made by:** Weaviate B.V. (Amsterdam), BSD-3, Go.

**Architecture highlights:**
- Hybrid BM25 + vector out of the box, no extra setup.
- Module system: rerankers, generative modules, multi-modal modules (CLIP, ImageBind, ColBERT) plug in declaratively.
- Named multi-vectors (one object can carry `embedding_openai` and `embedding_cohere` in parallel — useful for embedding migrations).
- GraphQL API plus REST.
- **Weaviate 1.37 (released 2026-04-23)** introduced declarative ingestion: declare which fields are text/image/audio/video, import data, embeddings are generated and indexed automatically.

**Hybrid search:** the canonical "hybrid out of the box" choice. Disabling BM25 in Weaviate setups drops accuracy 30-40% on technical corpora ([Weaviate hybrid benchmarks](https://weaviate.io/blog/hybrid-search-explained)).

**Multimodal:** strong — modules for CLIP, multi2vec-bind, native PaliGemma support. As of 2026 Weaviate is the default for "I want hybrid + multimodal without writing glue code."

**Cost:** Weaviate Cloud starts at ~$25/mo for 1 vCPU, scales linearly. Self-host is free.

**When to pick:** you want hybrid BM25+vector immediately, you like GraphQL, your team prefers a declarative module system over wiring components yourself.

**Caveats:**
- The module system adds operational surface area — each module is a separate container.
- GraphQL can be unfamiliar to teams used to REST.
- For multi-tenant SaaS check the licence; commercial deployments exist but verify.

### 2.3 Supabase pgvector

**Made by:** pgvector is Apache 2.0 by Andrew Kane; Supabase wraps it with auth, storage, and edge functions.

**Architecture highlights:**
- HNSW and IVFFlat index types.
- `halfvec` (fp16) for vectors up to 4000 dims with ≤1% recall loss.
- `bit` type for binary vectors up to 64K dims.
- Matryoshka via `vec_slice()`.
- All standard Postgres tooling: `pg_dump`, logical replication, transactions across vectors and metadata.

**Practical limit:** 1-5M vectors comfortably; above that HNSW build time and RAM pressure become the bottleneck. At 1M vectors with 1024 dims, an HNSW index is roughly 4-8 GB depending on `m`.

**Hybrid search:** DIY through `tsvector` + cosine-ops, or via the **VectorChord** extension which adds proper sparse vector support.

**When to pick:** team already on Postgres; vector count under 5M; want one backup pipeline.

**When not to pick:** above 5M vectors; need managed multi-region replication of vectors specifically; need first-class multi-vector for ColPali (workaround: row-per-token, painful).

**Migration path out:** when you cross 5M, the standard upgrade is dual-write into Qdrant or Weaviate while keeping pgvector live, then cut over reads. Documented in the Notion engineering blog on their 2024-2026 migration journey.

### 2.4 Pinecone

**Made by:** Pinecone Systems Inc., closed source, US-hosted.

**Architecture highlights:**
- Serverless: storage and query pricing decoupled.
- Sparse-dense hybrid (separate indexes, client-side merge — not a single round-trip).
- Native MRL support for OpenAI text-embedding-3 family.
- Free tier: 5GB storage, 100M write units, 1M read units per month.

**Strengths:** zero ops, generous free tier, mature SDKs, predictable scaling story for SaaS startups.

**Weaknesses:**
- Cloud-only — fails GDPR / VPC-only / 152-FZ residency requirements.
- Dimension fixed at index creation; embedding model migration requires a new index.
- No native ColPali multi-vector.
- Metadata filtering is the most-cited reason teams migrate off (Firecrawl, Berri AI).

**Cost at scale (1B vectors):** roughly $3,500/mo on serverless ([Pinecone pricing, April 2026](https://www.pinecone.io/pricing/)). 4.4× more than self-hosted Qdrant on Hetzner.

**When to pick:** explicit "no DevOps" mandate; team smaller than 5 engineers; under 100M vectors; US-only data residency is fine.

**When not to pick:** any of: GDPR strict, multi-tenant SaaS, code-heavy metadata filtering, multi-vector requirements, expected scale above 100M vectors.

### 2.5 Milvus

**Made by:** Zilliz, Apache 2.0, originally Chinese-led, now international.

**Architecture highlights:**
- FAISS-backed under the hood (more memory-efficient than HNSW for very large indexes).
- Distributed by design — separate index, query, data, and root coordinator nodes.
- Multiple vector types per collection (since 2.4): dense + sparse + multi-vector simultaneously.
- Hybrid search: native dense + sparse + BM25 (since 2.5) with `RRFRanker` and `WeightedRanker`.
- Mature Matryoshka tutorial ("Funnel Search with Matryoshka") for cost-aware filtering.

**When to pick:** scale above 100M vectors with dedicated ops; need multi-vector + sparse + dense in one collection; you have Kubernetes and a real platform team.

**When not to pick:** small team; under 10M vectors; Milvus operational complexity is real and earns you nothing at small scale.

**Caveats:** "Milvus standalone" (single binary) hides the complexity until your scale forces you to migrate to distributed mode — plan for that.

### 2.6 Chroma

**Made by:** Chroma (open source, Apache 2.0).

**Architecture highlights:**
- In-memory by default; persistent SQLite-backed mode for files.
- Designed for prototyping and local development.
- LangChain and LlamaIndex first-class integrations.

**Limitations:**
- No production HA story by April 2026.
- No first-class hybrid search (BM25 must be added externally).
- No managed cloud (community Chroma Cloud announced for 2026 but immature).

**When to pick:** first prototype, hackathon, course exercise, "five lines of code to a working RAG" demo.

**When not to pick:** anything past prototype. Use Chroma to start, plan to migrate to Qdrant or pgvector by the time you cross 100K vectors.

### 2.7 Turbopuffer

**Made by:** Turbopuffer (San Francisco), proprietary, object-storage-backed.

**Architecture highlights:**
- Built on S3-class object storage; namespaces are cheap to create and idle namespaces cost almost nothing.
- Designed for multi-tenant workloads (per-customer namespace).
- Hybrid search support, MRL support, fp16 + int8 quantization.

**Production reference:** Notion migrated all RAG vectors here in 2026, reporting **−60% search-engine spend, −35% AWS EMR spend, p50 70-100 ms → 50-70 ms**.

**When to pick:** multi-tenant B2B with many small per-tenant namespaces; cost-sensitive and willing to accept some cold-start latency.

**When not to pick:** sub-100ms p99 hard SLOs on rarely-queried tenants (cold start kicks in); need open source.

### 2.8 LightRAG (graph + vector hybrid)

**Made by:** HKUDS (Hong Kong University of Science and Technology), MIT, Python. Latest release v1.4.10+ (Feb 2026), 28-34K stars, quarterly cadence.

**Architecture highlights:**
- Treats graph as first-class: ingest extracts entities and relations via a cheap LLM (DeepSeek, GPT-4o-mini) and stores them in Neo4j or pgvector or NetworkX.
- 5 query modes: `naive`, `local` (1-hop), `global` (community summaries), `hybrid`, `mix` (production default since August 2025).
- Pluggable storage: KV (Postgres), vector (Qdrant/pgvector), graph (Neo4j Community recommended; Postgres+AGE is an anti-pattern — see Part 5).
- Reranker built-in since August 2025; `mix` mode requires it.

**Cost example (34K item KB, ~17M tokens):**
- Vector-only ingest: $0.50-1.40 with BGE-M3 self-hosted, near-free.
- LightRAG ingest with DeepSeek V4 Flash: ~$15-35 one-off; with GPT-4o-mini: ~$36; with Claude Haiku 4.5: ~$270 (overkill).
- Microsoft GraphRAG full ingest on the same corpus: $200-525 (4o-mini) to $2,625-5,250 (GPT-4o).

**Quality benchmarks (GraphRAG-Bench, ICLR 2026, [arXiv 2506.05690](https://arxiv.org/html/2506.05690v3)):**

| Task | LightRAG | MS GraphRAG | Vanilla RAG with reranker |
|---|---|---|---|
| Fact retrieval | 63.3% | 38.6% | **64.7%** |
| Complex reasoning | **61.3%** | 47.0% | — |
| Contextual summarization | **63.1%** | 41.9% | — |
| Creative generation | **67.9%** | 53.1% | — |
| Tokens per query | ~100K | ~331K (global) | ~880 |

**Conclusion:** LightRAG beats Microsoft GraphRAG on all complex tasks; on simple fact lookup, vanilla RAG with a reranker still wins. Don't add a graph layer if your queries are factual lookups.

**When to pick:** corpus above 1M tokens; ≥15-20% of real queries are multi-hop entity-bridging or aggregation; budget for one-time ingest is $20-200; team comfortable operating a graph database.

**When not to pick:** corpus under 1M tokens (LazyGraphRAG is cheaper); team has no Neo4j operational experience; main query mix is single-hop factual.

### 2.9 Microsoft GraphRAG (and why most teams should not run the full version)

**Made by:** Microsoft Research, MIT licence, Python. Latest stable release v2.7.0 (Oct 2025), v3 staging.

**Architecture:** entity extraction → community detection (Leiden) → community summaries → multi-step retrieval combining local entity search and global community summary search.

**The reality of full GraphRAG in 2026:**
- Ingest cost on a 100K document corpus: $200-525 with GPT-4o-mini, $2,625-5,250 with GPT-4o.
- Multi-day ingest on 50K+ documents.
- Per-query cost in `global` mode: $0.05-0.15 (one query consumes ~610K input tokens).
- "15-20% graph drift per quarter" requires partial re-extraction.
- Microsoft itself shipped **LazyGraphRAG** (Nov 2024) and **PIKE-RAG** (ICML 2025) as more economical successors.

**LazyGraphRAG numbers** ([Microsoft Research blog, June 2025](https://www.microsoft.com/en-us/research/blog/lazygraphrag-setting-a-new-standard-for-quality-and-cost/)):
- Indexing cost: 0.1% of full GraphRAG.
- Per-query cost: 4% of full GraphRAG.
- Win rate >50% in BenchmarkQED A/B tests across all four cells except DataLocal-Relevance.

**When full GraphRAG is justified in 2026:** corpus above 5M tokens with regulatory requirement for traceable cross-document synthesis (banking AML, healthcare compliance, EU AI Act high-risk scenarios) AND budget >$1K/month AND team with dedicated ops.

**Most teams should:** use LazyGraphRAG, LightRAG, or HippoRAG 2 instead.

---

## Part 3 — Cost matrix at scale

All numbers assume 1024-dim float32 vectors, ≤200 byte metadata per row, p95 query latency ≤200ms, hybrid search where supported. Verified April 2026.

### 10M vectors

| Backend | Storage | Monthly | Notes |
|---|---|---|---|
| Pinecone serverless | included | $50-150 | 5GB storage tier, ~3M reads |
| Qdrant Cloud (`eu-central-1`) | included | $80-200 | 1GB cluster, scale up needed |
| Qdrant self-host (Hetzner CCX23) | 80 GB SSD | $30-50 + ops | 16GB RAM, 4 vCPU |
| Weaviate Cloud | included | $100-250 | Standard plan |
| Supabase pgvector (Pro plan) | 8GB included | $25-100 | 8 GB DB, scaling to Team |
| Milvus on K8s (Hetzner cluster) | 100 GB | $80-150 + ops | Three nodes minimum |
| Turbopuffer | included | $40-80 | per-namespace pricing |

### 100M vectors

| Backend | Storage | Monthly | Notes |
|---|---|---|---|
| Pinecone serverless | ~80GB | $400-900 | scaled tier |
| Qdrant Cloud | ~80GB | $300-700 | medium cluster |
| Qdrant self-host | 200GB SSD | $80-150 + ops | CCX33, 64GB RAM |
| Weaviate Cloud | included | $500-1200 | depends on QPS |
| pgvector | not recommended | — | crosses comfort zone above 5M |
| Milvus K8s | 500GB | $300-600 + ops | distributed mode |
| Turbopuffer | included | $200-500 | depends on access patterns |

### 1B vectors

| Backend | Storage | Monthly | Notes |
|---|---|---|---|
| Pinecone serverless | ~800GB | **$3,500** | published reference number |
| Qdrant Cloud | ~800GB | **$1,200** | enterprise plan |
| Qdrant self-host (Hetzner) | 2TB SSD | **$800 + ops** | 4.4× cheaper than Pinecone |
| Weaviate Cloud | included | $2,500-5,000 | vendor quote |
| Milvus K8s | 5TB | $1,500-3,000 + ops | full distributed |
| Vespa Cloud | included | $1,500-4,000 | strong at this scale |
| Intercom Fin reference | ~600M vec, ES brute-force, $30K/mo | reference only — uses ES dense_vector with `index=false` | atypical but documented [Fin.ai 2025](https://fin.ai/research/do-you-really-need-a-vector-search-database/) |

**Note on Intercom:** they store ~600M 768-dim embeddings on Elasticsearch with `index=false` (brute-force script-score, not ANN). Estimated **3× cheaper than Qdrant** for their access pattern, much cheaper than Pinecone. P50 ~100 ms. The lesson: pre-existing infra often beats fancy new vendors.

---

## Part 4 — Migration patterns and case studies

### 4.1 Pinecone → pgvector (Firecrawl, Berri AI, multiple SaaS startups)

**Trigger:** metadata filtering pain — Pinecone's metadata model felt restrictive once teams needed JOIN-style logic.

**Pattern:**
1. Stand up Postgres with pgvector and the Supabase auth + storage stack.
2. Export Pinecone vectors with metadata via the API.
3. Re-import to pgvector with HNSW index.
4. Dual-read for one week, compare recall@10 on a held-out evaluation set.
5. Cut over.

**Quote from Caleb Peffer, Firecrawl CEO:** *"If you need to store a bunch of metadata, [Pinecone/Weaviate/Faiss] becomes a huge pain."*

**Outcome:** simpler stack, lower cost (Postgres they already paid for), end of metadata workarounds.

### 4.2 Pinecone serverless → Turbopuffer (Notion, 2024-2026)

**Scale:** multi-billion vectors across multi-million customers.

**Pattern:**
1. Hash-dedup span-level content (Notion blocks have heavy duplication across workspaces) — **−70% data volume** before re-embedding.
2. Move embedding pipeline from Apache Spark on EMR to **Ray on Anyscale** (July 2025).
3. Self-host open-source embedding models via Ray Serve (no more OpenAI API for embeddings on hot path).
4. Migrate vector storage to Turbopuffer namespace-per-workspace.

**Numbers ([Notion engineering, Feb 2026](https://www.notion.com/blog/two-years-of-vector-search-at-notion)):**
- 10× scale headroom achieved.
- ~90% cost reduction over two years.
- p50 70-100 ms → 50-70 ms.
- Ray pipeline projects another **−90% embedding infra cost**.

### 4.3 OpenAI Embeddings + GPT-4 → custom RAG with ES brute-force (Intercom Fin)

**Scale:** ~600M 768-dim embeddings, 15 indexes × 30 primary shards on Elasticsearch.

**Decision:** their existing Elasticsearch infrastructure already had snapshots, runbooks, alerting. They use `dense_vector` with `index=false`, brute-force script-score. **Estimated 3× cheaper than Qdrant** at their access pattern.

**Lesson:** the best vector DB is sometimes the one you already operate.

### 4.4 No vector DB at all (Vercel AI SDK team, Karpathy personal KB)

**Trigger:** prompt caching reached 90% discount on cache hits in 2025; for corpora ≤200K tokens, *Cache-Augmented Generation (CAG)* — stuffing the whole corpus into a cached prompt — became cheaper and more accurate than vector RAG.

**Vercel team result reported on Lenny Rachitsky's podcast:** moved away from vector DB for agents → **$1.00 → $0.25 per query and quality went up**. Used prompt caching + agentic search instead.

**Karpathy on personal KB (April 2026):** *"I thought I had to reach for fancy RAG, but LLM has been pretty good at auto-maintaining index files."* Picked up by the community as "Karpathy Wiki" — markdown + LLM router.

**When CAG wins over vector RAG:** corpus ≤200K tokens; queries are exploratory or analytic across the whole corpus; prompt caching is available on your provider.

### 4.5 Custom embeddings per tenant (Glean)

**Scale:** millions of documents per enterprise tenant across Drive, GitHub, Jira, Confluence, Slack.

**Pattern:** **fine-tune embedding model per customer** (continued pretraining on tenant corpus + synthetic pairs), hybrid BM25 + dense, learned ranker with 30+ signals.

**Outcome:** **+20% search quality over 6 months** of continuous learning. Models retrain monthly. Note: every model change requires full re-embedding of all vectors — there are no shortcuts.

### 4.6 LightRAG production (Jon Roosevelt, freelance/personal)

**Scale:** 50,000 documents, 1,000 queries/day, 6 months in production.

**Stack:** Phi-4 14B locally via Ollama (`num_ctx=32768`) + Postgres/pgvector + Neo4j + Redis cache.

**Numbers:** **$2,300/year vs $39,600 OpenAI-equivalent (94% saving)**, latency <3s.

**Lesson:** the only fully-documented LightRAG production deployment in the public domain by April 2026. Most enterprise claims are vendor marketing.

---

## Part 5 — Five anti-patterns

### Anti-pattern 1: One vector DB to rule them all

The framing "I'll pick the best vector DB once and use it everywhere" loses to a portfolio approach. CodeAlive, Glean, and most mature teams switch backends per use case: Qdrant for production search, pgvector for transactional metadata-heavy queries, an in-memory backend for tests, sometimes a graph backend for multi-hop reasoning.

The implicit vendor: *"I'm against picking one tool forever. Tools must match the task: Qdrant works here, Supabase there, Weaviate elsewhere."*

### Anti-pattern 2: Vector DB for code search

In 2026 the leading coding tools have abandoned vector RAG for code:
- **Claude Code, Codex CLI, OpenCode:** grep + ripgrep + glob + LSP.
- **Aider:** tree-sitter + repo-map injected into the system prompt.
- **Cline:** never implemented codebase indexing on principle.
- **Cursor:** is the exception — uses a custom embedder + Turbopuffer + Merkle-tree delta indexing + reranker, reporting **+12.5% accuracy vs grep alone on >1000-file repos**. The difference: Cursor sells a "magic button" UX that demands an index; CLI agents live in the terminal where grep is enough.

**Quote from Boris Cherny, Claude Code maintainer at Anthropic:** *"Early versions of Claude Code actually did use RAG with a local vector database, but they found pretty quickly that agentic search generally works better."*

**Quote from Cole Medin (Feb 2026):** *"The only reason traditional RAG is dead for AI coding is because of how structured our codebases are. So the question is RAG dead? The answer for you depends entirely on your data. How structured is it?"*

**The exception:** `voyage-code-3` shows **+13.8% over OpenAI 3-large** on 32 code retrieval datasets — useful when you have multi-million-line monoliths and need semantic "how does X work" search across repos. Otherwise: grep wins.

### Anti-pattern 3: Postgres + Apache AGE for graph-RAG

**Issue [HKUDS/LightRAG #2255](https://github.com/HKUDS/LightRAG/issues/2255), Oct 2025:** upgrading 1.4.9.1 → 1.4.9.4 triggers a `chunk_tracking` migration on 815,570 edges, processed in serial batches of 480 rows. The server is unavailable for **17+ hours**. User comment: *"not acceptable for any kind of production deployment."*

The estimated query cost in the migration plan: **251 billion units** because of nested loops + `DISTINCT`. Postgres with AGE is fine for graph experiments but breaks under production graph-RAG load.

**Use Neo4j Community Edition or Memgraph instead.** Both are free for self-host and have orders of magnitude better performance on traversal-heavy workloads.

### Anti-pattern 4: JSON + NetworkX as production graph storage

Shipping LightRAG with the default `JSON + NetworkX` storage backend works for a 1,000-document demo and breaks above ~10,000 documents. The whole graph is loaded into RAM on every save (issue [#2346](https://github.com/HKUDS/LightRAG/pull/2346)), causing OOM around 100K entities. For any KB above a few thousand documents, start with Postgres (KV) + Qdrant or pgvector (vectors) + Neo4j (graph) directly.

### Anti-pattern 5: Mixing vectors from different embedding models in one collection

Cosine similarity between an OpenAI 3072-dim vector and a Cohere 1024-dim vector is **mathematically meaningless** — they live in different Hilbert spaces.

If you need to migrate embedding models:
- **Versioned namespaces:** Qdrant, Pinecone, Turbopuffer all support naming conventions like `docs_v1_bge` and `docs_v2_voyage`.
- **Dual-write / shadow index** (Notion's pattern): write new embeddings to a new index, evaluate recall@k on a held-out set, cut over when ready.
- **Blue-green swap:** atomic switch of two indexes, requires 2× storage temporarily.
- **Versioned schema:** Vespa supports `embedding_v1 type tensor<float>(x[1024])` and `embedding_v2 type tensor<float>(x[2048])` in parallel; Weaviate has named multi-vectors per object.

**The single exception:** the Voyage 4 family (nano/lite/standard/large) was trained to share a single embedding space — vectors are interchangeable across model sizes. No other vendor offers this on April 2026.

---

## Part 6 — Final decision tree

```
START
│
├── Is this a prototype / hackathon (≤50K vectors)?
│   └─→ Chroma in-memory (zero ops) or pgvector if Postgres exists
│
├── Is corpus ≤200K tokens AND your provider supports prompt caching?
│   └─→ NO vector DB — use Cache-Augmented Generation (CAG)
│       Vercel team: $1.00 → $0.25 per query, quality up
│
├── Is the corpus mostly source code?
│   └─→ NO vector DB — use grep + ripgrep + tree-sitter (AST)
│       Exception: Cursor-style magic UX → custom code embedder + Turbopuffer
│
├── Single Postgres stack, ≤5M vectors, want one backup pipeline?
│   └─→ Supabase pgvector (or self-hosted pgvector with HNSW)
│
├── Production text-RAG, 1-100M vectors, can self-host?
│   └─→ Qdrant self-hosted (Apache 2.0, Rust, native multi-vector)
│
├── Want hybrid BM25 + vector immediately, no glue code?
│   └─→ Weaviate (modules, GraphQL)
│
├── No DevOps budget, US-only data residency, ≤100M vectors?
│   └─→ Pinecone serverless (mature SDKs, generous free tier)
│
├── Multi-tenant SaaS with many small per-tenant namespaces?
│   └─→ Turbopuffer (Notion's choice in 2026)
│
├── ≥1B vectors with dedicated platform team?
│   └─→ Milvus K8s or Vespa Cloud
│
├── ≥15-20% queries are multi-hop / aggregation / cross-document synthesis?
│   ├── Budget $20-200 for one-off ingest, ≥1M tokens corpus?
│   │   └─→ LightRAG on top of Qdrant + Neo4j
│   ├── Need full GraphRAG (regulated industry, traceable synthesis, $1K+/mo)?
│   │   └─→ LazyGraphRAG (Microsoft Research) — full GraphRAG only as last resort
│   └── ≤1M token corpus?
│       └─→ Don't add a graph yet — get a reranker first
│
└── GDPR / VPC / 152-FZ strict residency?
    └─→ Self-hosted Qdrant (Frankfurt) or pgvector on-prem
        Pinecone is blocked
```

---

## Sources

**Vendor pricing pages (verified April 2026):**
- [OpenAI pricing](https://openai.com/api/pricing/)
- [Anthropic pricing](https://platform.claude.com/docs/en/about-claude/pricing) (Opus 4.7 launched April 16, 2026)
- [DeepSeek pricing](https://api-docs.deepseek.com/quick_start/pricing)
- [Pinecone pricing](https://www.pinecone.io/pricing/)
- [Qdrant Cloud](https://qdrant.tech/pricing/)
- [Weaviate Cloud](https://weaviate.io/pricing)
- [Hetzner Cloud](https://www.hetzner.com/cloud)

**Production case studies:**
- Notion engineering blog, "Two years of vector search at Notion" (Feb 2026): https://www.notion.com/blog/two-years-of-vector-search-at-notion
- Cursor secure codebase indexing: https://cursor.com/blog/secure-codebase-indexing
- Intercom Fin: https://fin.ai/research/do-you-really-need-a-vector-search-database/ (2025)
- Glean fine-tuned embeddings: https://jxnl.co/writing/2025/03/06/fine-tuning-embedding-models-for-enterprise-rag-lessons-from-glean/
- Morgan Stanley + OpenAI: https://openai.com/index/morgan-stanley/
- Jon Roosevelt LightRAG cost study: https://jonroosevelt.com/blog/rag-system-cost-savings
- Render.com "Build vs Buy RAG infrastructure": https://render.com/articles/build-vs-buy-rag-infrastructure

**Benchmarks and papers:**
- GraphRAG-Bench (ICLR 2026): https://arxiv.org/html/2506.05690v3
- LightRAG (EMNLP 2025): https://arxiv.org/html/2410.05779v1
- HippoRAG 2 (ICML 2025): https://arxiv.org/html/2502.14802v1
- Microsoft GraphRAG: https://arxiv.org/abs/2404.16130
- Microsoft LazyGraphRAG: https://www.microsoft.com/en-us/research/blog/lazygraphrag-setting-a-new-standard-for-quality-and-cost/
- BenchmarkQED (June 2025): https://www.microsoft.com/en-us/research/blog/benchmarkqed-automated-benchmarking-of-rag-systems/
- LinkedIn KG-RAG (SIGIR 2024): https://arxiv.org/abs/2404.17723
- Han et al., "RAG vs GraphRAG" (arXiv 2502.11371, 2025): https://arxiv.org/html/2502.11371v3
- "Do We Still Need GraphRAG?" (NYU Shanghai, April 2026): https://arxiv.org/abs/2604.09666

**Tools and repositories:**
- Qdrant: https://github.com/qdrant/qdrant
- Weaviate: https://github.com/weaviate/weaviate
- Milvus: https://github.com/milvus-io/milvus
- Chroma: https://github.com/chroma-core/chroma
- pgvector: https://github.com/pgvector/pgvector
- LightRAG: https://github.com/HKUDS/LightRAG
- Microsoft GraphRAG: https://github.com/microsoft/graphrag
- HippoRAG: https://github.com/OSU-NLP-Group/HippoRAG

**Critical issues to read before adopting LightRAG:**
- #2255 Postgres+AGE 17h migration: https://github.com/HKUDS/LightRAG/issues/2255
- #2012 mixed-language entity duplication: https://github.com/HKUDS/LightRAG/issues/2012
- #2837 mix mode 4-min latency on 1000+ nodes: https://github.com/HKUDS/LightRAG/issues/2837

---

*Version 1.0 | 2026-04-27 | M3 guide for HSS AI-Driven Development Level 1.*
