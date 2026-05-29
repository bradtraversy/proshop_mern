> **Language / Язык:** **English** (current version) · [Русский](embedding-models-2026-guide.md)

---

# Embedding models in 2026 — selection guide for RAG

> **Audience:** developers picking an embedding model for production RAG.
> **Goal:** explain what embedding models are, compare the 2026 leaders (OpenAI, Cohere, Voyage, Google, Jina, BAAI), give honest numbers per scenario (text / Russian / code / multimodal / self-host / low budget), and list the anti-patterns.
> **Date:** 2026-04-27. Verified against MTEB v2 / MMTEB / RTEB / CCKM leaderboards as of April 2026.

---

## TL;DR — pick by scenario

| Your scenario | Default model | Why |
|---|---|---|
| Prototype, English, ≤10K vectors | **OpenAI text-embedding-3-small** ($0.02/1M tok) | Cheapest, no setup, fine MTEB 62.3 |
| Production multilingual including Russian | **Cohere Embed v4** API or **BGE-M3** self-hosted | v4 = 100+ languages, 128K context; BGE-M3 = MIT, free, dense+sparse+ColBERT |
| Multilingual including Russian, EU residency | **BGE-M3** self-hosted or **Jina v4** (Berlin) | Cohere v4 also OK via AWS Bedrock EU profile |
| Code search | **voyage-code-3** (paid) or **Qwen3-Embedding-8B** (open Apache 2.0) | voyage-code-3: +13.8% over OpenAI 3-large on CoIR; Qwen3 MTEB-Code 80.68 |
| Multimodal — text + image + PDF + audio + video | **Google Gemini Embedding 2** (GA April 22, 2026) | Only commercial model with native 5-modality support |
| Multimodal — text + image, EU residency | **Cohere Embed v4** via AWS Bedrock EU profile | Gemini 2 not in EU regions yet |
| Self-host on CPU/edge | **EmbeddingGemma-300M** or **Qwen3-Embedding-0.6B** | <1B params, multilingual, Apache/permissive |
| Code teams blocked from Cohere/Voyage by ToS | **Qwen3-Embedding-8B** | Apache 2.0, MMTEB leader, MTEB-Code 80.68 |
| Russian-heavy KB (≥30% Russian content) | **GigaEmbeddings (SberDevices)** or **BGE-M3** | GigaEmbeddings: SOTA on ruMTEB (avg 69.1), check licence; BGE-M3 universal |

---

## Part 1 — What is an embedding model

For readers seeing the term for the first time:

An **embedding model** turns a piece of text (or image, audio, video) into a **vector** of fixed length, typically 768-3072 numbers between -1 and 1. Two pieces of content with similar meaning produce vectors close to each other in this high-dimensional space (measured by cosine similarity).

This is what makes vector search possible. You embed every chunk in your knowledge base once, store the vectors, and at query time embed the user's question and retrieve the closest vectors.

The quality of the embedding model **directly caps the quality of retrieval**, which directly caps the quality of any RAG-based answer. There is no LLM cleverness that can recover what retrieval misses.

Three properties matter most:

1. **What languages / modalities the model was trained on.** A model trained mostly on English will perform poorly on Russian; a text-only model cannot embed images.
2. **Whether the model is symmetric or asymmetric** (Part 5). Asymmetric models encode queries and documents differently and require an `input_type` flag at API call time. Mixing them silently drops recall@10 by 5-15 points.
3. **The dimension of the output vector.** Higher dimensions = more memory and slower search but typically better quality. Many 2026 models use **Matryoshka Representation Learning (MRL)** which lets you truncate the same vector to multiple lengths (e.g. 3072 → 768) without retraining.

You will hear about three benchmarks:

- **MTEB / MMTEB** (Multilingual Text Embedding Benchmark): the public leaderboard, 131 tasks, 250+ languages aggregated by Borda rank. Critical caveat: **MTEB Avg ≠ retrieval performance**. Look at the retrieval sub-track (nDCG@10) specifically.
- **BEIR**: 18 retrieval datasets across genres. Strong models score 60+ vs BM25 baseline ~42.
- **CCKM** ([Cheney Zhang, Milvus blog, March 2026](https://zc277584121.github.io/rag/2026/03/20/embedding-models-benchmark-2026.html)): an independent benchmark showing **MTEB rank does not predict production performance**. Always maintain your own 200-500 query CI evaluation set on your domain and language.

---

## Part 2 — Top models in 2026

### 2.1 OpenAI text-embedding-3-small / large

**Status:** released January 2024. **No successor as of April 2026** — `text-embedding-4` does not exist despite occasional speculative listings on third-party trackers.

| Model | Dim (MRL range) | Max ctx | Price | MTEB | Notes |
|---|---|---|---|---|---|
| text-embedding-3-small | 1536 (256-1536) | 8 191 | $0.02/1M tok | 62.3 | Default cheap option |
| text-embedding-3-large | 3072 (256-3072) | 8 191 | $0.13/1M tok | 64.6 | Strong English, weak Russian |

**Strengths:** mature SDKs, cheapest API on the market for English-only, strong with code.

**Weaknesses:**
- **Symmetric only** — no asymmetric query/document encoding (Cohere, Voyage, E5 all do).
- Multilingual is mediocre — MIRACL 54.9 for 3-large vs Cohere v4 ~67 vs BGE-M3 ~67.
- No quantization built in.
- 2 years without an update is a sign the team is focusing on generation, not embeddings.

**Verdict:** still the right default for an English prototype, especially `3-small` at $0.02/1M tokens. For multilingual production, look elsewhere.

### 2.2 Cohere Embed v3 / v4

**Status:** v4 released April 2025, still the flagship in April 2026 (v5 has not been released; some sources erroneously cite "Embed v5"). Verified through Cohere docs.

| Model | Dim (MRL) | Max ctx | Multilingual | Price | Notes |
|---|---|---|---|---|---|
| Embed v3 multilingual | 1024 | 512 | 100+ languages | $0.10/1M tok | Legacy, migrate to v4 |
| **Embed v4** | 256/512/1024/**1536** | **128K — largest commercial** | 100+ languages | $0.10-0.12/1M tok + $0.47/1M image tok | Multimodal interleaved, native int8/binary |

**Strengths:**
- **Largest commercial context window (128K tokens)** — index long documents without aggressive chunking.
- **Asymmetric encoding** — must use `input_type="search_document"` for ingest and `input_type="search_query"` for retrieval. Forgetting the flag silently drops recall 10-30%.
- Native multimodal: text + image + interleaved (PDFs with screenshots, charts, tables) since v4.
- Available on 5 hyperscalers: Cohere API, AWS Bedrock, SageMaker, Azure, Oracle.
- **AWS Bedrock cross-region EU inference profile** `eu.cohere.embed-v4:0` — the only mainstream GDPR-defensible cloud-multimodal option in April 2026.
- Native int8 (4× memory saving, 99.99% quality retention per Microsoft Azure benchmarks) and binary (32× saving, 90-98% retention with rescoring).

**Weaknesses:**
- Closed source — no self-host.
- Vendor lock-in: Cohere's deprecation policy retired classify/rerank/command-light fine-tuning in September 2025, forcing migrations.
- **Russia regulatory note:** Cohere is under US export controls and may not be reliable for users in Russia / Belarus / sanctioned regions. Verify availability before committing — teams in those regions typically use BGE-M3 self-hosted instead.

**Verdict:** the multilingual production API leader for teams in EU/US/Asia. For Russian/CIS-based teams, the export-control risk is the dealbreaker — fall back to BGE-M3 or Qwen3-Embedding-8B.

### 2.3 BGE-M3 (Beijing Academy of AI)

**Status:** released February 2024; still the default open-source workhorse in April 2026.

| Property | Value |
|---|---|
| Dim | dense 1024 + sparse + ColBERT (multi-vector) |
| Max ctx | 8 192 |
| Languages | 100+ (multilingual lead, MIRACL 67.8) |
| MTEB | ~63.0 |
| Licence | **MIT** — fully commercial OK |
| Cost | $0 (self-host on CPU or GPU) |

**The unique architectural feature:** BGE-M3 returns **three representations of the same text in one forward pass** — dense (1024-dim), sparse (BM25-equivalent), and ColBERT-style multi-vector for late interaction. This means hybrid search is a single model call, not two.

**Latency / throughput on common hardware:**

| Hardware | Encode 1 query | Batch 32 chunks | Full 28K-item KB |
|---|---|---|---|
| VPS 4 vCPU, CPU only | ~150-300 ms | 6-10 sec | 2-3 hours |
| Mac M1 Pro CPU only | ~15-25 ms | 700-900 ms | 30-40 min |
| Mac M1 Pro with MPS | ~5-10 ms | ~250 ms | 12-15 min |
| NVIDIA L4 GPU FP16 | ~5-15 ms | — | 15-30 min |
| NVIDIA A100 FP16 | ~5-10 ms | — | minutes |

(Source: [HuggingFace BGE-M3 model card](https://huggingface.co/BAAI/bge-m3); [FlagEmbedding GitHub issue #419](https://github.com/FlagOpen/FlagEmbedding/issues/419); Spheron benchmarks April 2026.)

**Memory footprint:** ~2.1 GB RAM at FP32, ~1.06 GB at FP16 (`use_fp16=True`).

**Production stack on a single L4 GPU:**

```bash
docker run --gpus all -p 8080:80 -v $PWD/data:/data \
  ghcr.io/huggingface/text-embeddings-inference:cuda-1.9 \
  --model-id BAAI/bge-m3 --max-batch-tokens 65536 \
  --max-concurrent-requests 512 --dtype float16
```

This delivers ~25K tokens/second sustained.

**Verdict:** the safe self-host baseline for any multilingual RAG, including Russian-heavy. Choose BGE-M3 unless you have a specific reason to use a paid API.

### 2.4 Voyage AI (3-large, 4-large, multimodal-3.5, voyage-code-3)

**Status:** acquired by MongoDB in February 2025. Voyage-4 family released January 2026 with shared embedding space across `nano/lite/standard/large` — the only commercial vendor that lets you swap model size without re-embedding.

| Model | Dim (MRL) | Max ctx | Price | Notes |
|---|---|---|---|---|
| voyage-3-large | 1024 (256-2048) | 32K | $0.18/1M tok | Strong multilingual, asymmetric |
| voyage-4-large | 1024 (256-2048) | 32K | $0.12, 200M tok free | RTEB-leader vendor claim |
| voyage-multimodal-3.5 | 256-2048 | 32K | $0.12 + per-pixel image | Best video retrieval (vs Gemini) |
| **voyage-code-3** | up to 3072 | 32K | $0.18/1M tok | **+13.8% over OpenAI 3-large on CoIR** |

**Strengths:**
- **Asymmetric encoding** mandatory (`input_type="query"` / `"document"`).
- **Voyage 4 family shares an embedding space** — no re-embedding to scale up/down.
- voyage-code-3 is the production code-search leader by independent benchmarks.

**The RTEB scandal you should know about:** in early 2026, MTEB maintainers temporarily removed the private RTEB split after it emerged that Voyage AI (a co-developer) had structural access to the closed test data ([GitHub issue #3934](https://github.com/embeddings-benchmark/mteb/issues/3934)). All Voyage-4 numbers are vendor-only until independent reproductions land. Treat Voyage benchmarks with appropriate scepticism but recognize the models still perform well in production-blind tests.

**Verdict:** competitive multilingual API, best-in-class for code with `voyage-code-3`. The MongoDB acquisition raises long-term pricing parity questions for non-Atlas customers — worth following.

### 2.5 Google Gemini Embedding 2 (multimodal flagship 2026)

**Status:** public preview March 10, 2026; **GA April 22, 2026** — four days before this guide was written.

**Architecture:** unified transformer encoder on Gemini foundation, **not** CLIP-style dual-tower. Semantic fusion happens in deep hidden layers, capturing cross-modal links unavailable to separate-encoder systems.

| Modality | Limit |
|---|---|
| Text | 8 192 tokens, 100+ languages |
| Images | up to 6 per request, PNG/JPEG/WebP/BMP |
| Video | 80 s with audio / 120 s without (preview); up to 120 s GA — verify per SKU |
| Audio | 80-180 s, MP3/WAV (native, no transcription) |
| PDF | 1 file, up to 6 pages, layout-aware OCR |

**Output:** 3072-dim default, MRL truncation supported at 128 / 256 / 512 / **768 (sweet spot)** / 1536 / 2048 / 3072.

**Pricing:** $0.20-0.25 per 1M text tokens standard, $0.10 batch, plus per-modality rates for image/audio/video. Sources differ on the exact split (Vertex docs vs third-party trackers); verify on billing page at purchase time.

**Quality:** MTEB Multilingual 69.9 (top of leaderboard at GA), MTEB English 68.32, MTEB Code 84.0 (vendor-claimed, not yet independently reproduced). Independent CCKM benchmark from March 2026 places Gemini Embedding 2 at 0.928 — **behind Qwen3-VL-Embedding-2B at 0.945**.

**The critical EU residency caveat:** as of April 26, 2026 the model is **only available in `us-central1`**. EU regions (`europe-west3` Frankfurt, `europe-west4` Netherlands) are not supported. With the **EU AI Act effective August 2, 2026**, this is a genuine blocker for any Frankfurt-based deployment.

**Production migrations to Gemini Embedding 2:**
- **Sparkonomy:** replaced 3-model pipeline (vision → text → embed) with one call → −70% latency, semantic similarity 0.4 → 0.8.
- **Everlaw** (legal discovery, 1.4M documents): +20% recall, 87% precision vs Voyage 84% vs OpenAI 73%.
- **Poke / Interaction Co.** (AI email assistant): −90.4% time embedding 100 emails vs Voyage-2.
- **re:cap** (B2B fintech): F1 +1.9% on 21,500 transaction classification examples.

**Verdict:** the future of multimodal embedding, but for EU teams the regional limitation is a hard block until rollout. For US/global teams it is the strongest commercial multimodal offering today.

### 2.6 Jina Embeddings v4 / v5

**Status:** v4 released June 2025 (multimodal flagship), v5-text released February 2026.

| Model | Dim | Max ctx | Multimodal | Notes |
|---|---|---|---|---|
| jina-embeddings-v4 | 2048 (MRL to 128) + multi-vector 128/token (ColBERT-style) | 32K | text + images + visually-rich docs | 30+ languages; **Qwen Research licence** — verify before commercial use |
| jina-embeddings-v5-text | 64-1024 | 32K | text only | MTEB v2 71.7, Apache 2.0 (small variant), CC BY-NC (full) |
| jina-embeddings-v5-small | 64-1024 | 32K | text only | $0.05/1M tok via API |

**Strengths:**
- **Berlin-based provider** — the most GDPR-natural embedding API on the market.
- v4 multi-vector mode is SOTA on JinaVDR and ViDoRe v2 for visually-rich documents.
- Jina-clip-v2 still maintained (89 languages, 512×512).

**Weaknesses:**
- v4 weights are under Qwen Research Licence, not Apache 2.0. Verify with legal before shipping commercially.
- Smaller community than Cohere/Voyage; less production track record.

**Verdict:** the natural choice for EU-headquartered teams that want multimodal without sending data to US providers.

### 2.7 Qwen3-Embedding family (Alibaba, open Apache 2.0)

**Status:** released throughout 2025; the 8B variant is the open-source benchmark leader in 2026.

| Model | Size | Dim | Max ctx | Notes |
|---|---|---|---|---|
| Qwen3-Embedding-0.6B | 0.6B | 1024 | 32K | Edge-deployable, Apache 2.0 |
| Qwen3-Embedding-4B | 4B | up to 7168 | 32K | Mid-tier |
| **Qwen3-Embedding-8B** | 8B | up to 7168 | 32K | **MMTEB leader 70.58, MTEB-Code 80.68** |
| Qwen3-VL-Embedding-2B | 2B | varies | — | **#1 on CCKM (0.945) — beats Gemini Embedding 2** |
| Qwen3-VL-Embedding-8B | 8.14B | varies | — | MMEB-V2 77.82 (open-source SOTA) |

**Hardware requirements:**
- 0.6B: fits on CPU or 4GB GPU.
- 8B: 16GB VRAM at FP16 (L4 / A10 minimum).

**Strengths:**
- **Apache 2.0 throughout** — no licence traps.
- **Open-source MMTEB leader** at the 8B size.
- Code performance among the best.
- Multilingual including Russian.

**Weaknesses:**
- Some European enterprise buyers add Chinese-origin models to risk reviews even though the licence is permissive.
- Larger model = more inference cost than the API alternatives at small scale.

**Verdict:** the strongest open-weight choice in 2026 if you can self-host.

### 2.8 GigaEmbeddings (SberDevices) — Russian-specific

**Status:** released November 2025. Built on GigaChat-3B base.

**Quality:** SOTA on ruMTEB with average 69.1 across 23 tasks — best-in-class for Russian text.

**Caveats:**
- Licence is not Apache 2.0 — verify commercial use.
- Limited international community / English documentation.

**Verdict:** if your KB is heavily Russian and licence terms work, this is the local SOTA. Otherwise BGE-M3 is the safer multilingual choice.

### 2.9 What you should not pick in 2026

Models that appear on leaderboards but should not be your default:

| Model | Why not |
|---|---|
| **NV-Embed-v2** (NVIDIA) | CC-BY-NC-4.0 — research only. NVIDIA redirects commercial users to paid NeMo Retriever NIM. Hard licence trap for SaaS. |
| **Llama-Embed-Nemotron-8B** (NVIDIA) | CC-BY-NC. Same trap. |
| **Microsoft Harrier-OSS-v1** | MIT but **no paper, opaque training data**. Topped MMTEB v2 (74.3) without independent verification. Sceptical until reproduced. |
| **mistral-embed** | Not updated since release; no asymmetric encoding; no published Russian ablations. |
| **OpenAI text-embedding-ada-002** | Deprecated path on Azure. Migrate to 3-small if still using ada-002. |

---

## Part 3 — Comparison by metric

### MTEB v2 / MMTEB top tier (April 2026)

| Rank | Model | MTEB Avg | Retrieval nDCG@10 | Notes |
|---|---|---|---|---|
| 1 | Gemini Embedding 001 / 2 | 68.32 EN | 67.71 | +5.09 over #2; closed |
| 2 | Microsoft Harrier-OSS-v1 (27B) | 74.3 MMTEB v2 | — | MIT, no paper ⚠️ |
| 3 | Qwen3-Embedding-8B | 70.58 MMTEB | 69.8 | Apache 2.0; MTEB-Code 80.68 |
| 4 | Llama-Embed-Nemotron-8B | SOTA Borda Oct 2025 | — | CC-BY-NC |
| 5 | gte-Qwen3-8B | 68.1 | 67.4 | Open |
| 6 | NV-Embed-v2 | 72.31 | 62.65 | CC-BY-NC, **note retrieval is much lower than avg** |
| 7 | Voyage-4-large | 67.2 vendor | 71.8 vendor | RTEB issue noted |
| 8 | Jina v5-small | 71.7 | 65.5 | $0.05/1M API |
| 9 | Cohere Embed v4 | ~65-66 | ~61 | 128K context |
| 10 | OpenAI 3-large | 64.6 | 62.2 | Symmetric, no asymmetric |
| 11 | BGE-M3 | ~63.0 | ~58.0 | MIT, dense+sparse+ColBERT |

**Critical caveat:** MTEB Avg ≠ retrieval performance. NV-Embed-v2 has 72.31 average but 62.65 on retrieval — the gap is 10 points. Always look at the retrieval sub-track for RAG decisions.

### Latency / cost per scenario

For a 34K-item KB embedded once (~17M tokens):

| Model | Cost one-off | Latency p50 | Self-host? |
|---|---|---|---|
| OpenAI text-embedding-3-small | $0.34 | 35-70 ms | No |
| OpenAI text-embedding-3-large | $2.21 | 50-200 ms | No |
| Cohere Embed v4 | ~$1.70-2.04 | ~50-150 ms | No |
| Voyage-3-large | $3.06 | ~90 ms | No |
| Gemini Embedding 001 | $2.55 | ~50 ms | No |
| Gemini Embedding 2 | $3.40 standard / $1.70 batch | preview, no SLA | No (US only) |
| BGE-M3 self-hosted | ~$2-5 GPU-hours one-off | ~5-30 ms | Yes |
| Qwen3-Embedding-8B self-hosted | $4-10 GPU-hours one-off | ~50-150 ms | Yes |

**Key insight:** for a 34K-item KB, the *one-off ingest cost* is negligible across all options. The decision is driven by ongoing latency/cost, multilingual quality, licence, and migration path — not the initial dollar amount.

---

## Part 4 — Matryoshka Representation Learning (MRL): 12× memory at -8% quality

MRL is the most important practical technique introduced into embedding models since 2024. Models trained with MRL can be **truncated to shorter dimensions without re-running the model** because the early dimensions of the vector carry the most information.

**OpenAI text-embedding-3-large MRL result:** truncating from 3072 to 256 dimensions (12× smaller) loses **only ~8% MTEB quality**. For most production RAG, the trade-off is worth it.

**Voyage-3-large MRL result:** at 256 dims still **+1.16% above OpenAI 3-large at full 3072 dims** (with rescoring on a small candidate set).

**How to use MRL in practice:**

1. Always store the full-dimension vector (or at least the largest you might need).
2. Build the search index at a smaller dimension (e.g., 256) for fast filtering.
3. Re-score the top-N candidates against the full-dimension vector.

This pattern (often called "funnel search") is documented in [Milvus tutorial on MRL](https://milvus.io/docs/funnel_search_with_matryoshka.md) and natively supported in Qdrant via named vectors + Query API prefetch.

**Memory math for 34K items at 1024-dim:**

| Format | Per vector | Total | Compression |
|---|---|---|---|
| float32 | 4096 B | 139 MB | 1× |
| float16 / halfvec | 2048 B | 70 MB | 2× |
| int8 / scalar | 1024 B | 35 MB | 4× |
| binary | 128 B | 4.4 MB | **32×** |
| MRL 1024 → 256 fp32 | 1024 B | 35 MB | 4× |
| MRL 1024 → 256 + binary | 32 B | **1.1 MB** | **128×** |

**Production rules of thumb (consensus from Cohere, Qdrant, Weaviate docs):**
- **halfvec / fp16** at >5M vectors: nearly free, ≤1% loss, 2× saving.
- **int8** at >50M vectors: Qdrant docs call it production default, ~99% retention.
- **Binary** only at >100M vectors AND dim ≥1024 AND quantization-aware-trained model (Cohere v3+, Voyage 3+, mxbai-embed-large). For smaller models recall drops sharply.
- **Binary always with rescoring**: top-100 binary → top-10 full precision. Native in Qdrant and Weaviate.

---

## Part 5 — Anti-patterns

### Anti-pattern 1: Switching embedding models on the fly

Every embedding model lives in its own Hilbert space. Cosine similarity between an OpenAI 3072-dim vector and a Cohere 1024-dim vector is **mathematically meaningless**. Changing the embedder requires **full re-embedding of the entire corpus**.

If you must migrate:
- **Versioned namespaces:** `docs_v1_bge_m3`, `docs_v2_voyage_3_large`.
- **Dual-write / shadow index** (Notion's pattern): write new embeddings to a new index, evaluate recall@k on a held-out test set, cut over.
- **Blue-green swap:** atomic switch, requires 2× storage temporarily.

The only exception is the **Voyage 4 family** (nano/lite/standard/large) which shares an embedding space across model sizes.

### Anti-pattern 2: Cohere or Voyage from a sanctioned region

Both Cohere and Voyage are US-headquartered and subject to US export controls. Teams in Russia, Belarus, or other sanctioned regions face availability and payment risks. Use BGE-M3 self-hosted or Qwen3-Embedding-8B instead.

### Anti-pattern 3: ImageNet-trained models for code

A model whose training mix is mostly text + images (like CLIP, ImageBind, classic SBERT models) will perform poorly on code retrieval. Use **voyage-code-3**, **Qwen3-Embedding-8B**, or **Codestral Embed** specifically trained on code.

### Anti-pattern 4: Symmetric model where you need asymmetric

The most common silent quality killer. If your model is asymmetric (Cohere v3/v4, Voyage v2/v3/v4, E5, multilingual-e5, Nomic, Snowflake) you **must** use the correct `input_type` flag:

| Model | Type | What to do |
|---|---|---|
| Cohere v3/v4 | Asymmetric, mandatory | `input_type="search_query"` or `"search_document"` |
| Voyage v2/v3/v4 | Asymmetric, mandatory | `input_type="query"` or `"document"` |
| OpenAI 3-small/large | Symmetric | one encoder, no flag |
| BGE v1.5 EN | Optionally asymmetric | prefix queries with `Represent this sentence for searching relevant passages:` |
| **BGE-M3** | **Symmetric** — confirmed by maintainer | no prefixes needed |
| E5 / multilingual-e5 / E5-Mistral | Asymmetric, mandatory | `query: ` + `passage: ` prefixes |
| Nomic v1/v2, Snowflake Arctic | Asymmetric | `search_query: ` / `search_document: ` |

**Forgetting the flag silently drops recall@10 by 5-15 points.** A safe wrapper:

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
    # OpenAI / BGE-M3 / mistral-embed are symmetric
    return openai.embeddings.create(model=MODEL, input=text).data[0].embedding
```

### Anti-pattern 5: Trusting MTEB rank for production

The MTEB leaderboard is **self-reporting** and not independently verified. The MTEB v2 release in 2025 was specifically motivated by suspected contamination of v1. Six known concerns:

1. Self-reporting without verification.
2. Zero-shot percentage now visible — `e5-mistral` shows 95% zero-shot on v2 (saw ~5% of the train splits).
3. MTEB v2 was introduced because of v1 contamination.
4. Legal split (MTEB) flagged as 25% methodologically flawed (Isaacus, Feb 2026).
5. Private RTEB split removed due to conflict of interest with Voyage.
6. CCKM benchmark (Milvus, 2026) showed MTEB ranks do not predict production performance.

**The lesson:** always maintain your own CI evaluation set of 200-500 queries on your specific domain and language. Use MTEB for shortlisting, not final selection.

### Anti-pattern 6: Cohere v4 for teams that need on-prem or strict residency outside AWS Bedrock EU

Cohere v4 is closed-source. The only EU residency path is AWS Bedrock cross-region inference profile (`eu.cohere.embed-v4:0`). For pure on-prem or regions other than `eu-central-1` / `eu-west-1`, you need self-host alternatives — BGE-M3, Jina v4, or Qwen3-Embedding.

### Anti-pattern 7: Buying Voyage 4 numbers without independent verification

The 2026 RTEB scandal (Voyage co-developed the benchmark, had structural access to private test data) means current Voyage 4 numbers are vendor-only. Independent reproductions are pending. Treat the model as good — the production case studies are real — but discount specific benchmark numbers.

---

## Part 6 — Practical recipes

### Recipe 1: Text-only English RAG, prototype to ~10K items

**Stack:** OpenAI text-embedding-3-small + Chroma (in-memory) + GPT-4o-mini.

**Cost:** $0.02/1M tokens for embedding, ~$0.34 for 17M-token corpus. Vector DB free.

**When to upgrade:** crossing 100K vectors → migrate to pgvector. Need multilingual → switch to BGE-M3 or Cohere v4.

### Recipe 2: Multilingual production RAG including Russian

**Stack (cloud-friendly region):** Cohere Embed v4 API + Qdrant Cloud (Frankfurt) + reranker `bge-reranker-v2-m3` self-hosted.

**Stack (sanctioned region or strict residency):** BGE-M3 self-hosted via TEI on a single L4 GPU + Qdrant self-host + bge-reranker-v2-m3.

**Cost (cloud version, 34K items, ~10 queries/min):** $20-50/mo.

**Why two models?** 5 vector backends in parallel (BGE-M3 ×3 + Cohere v4 ×2 across Qdrant / Weaviate / pgvector) is a teaching architecture; production usually picks one ingest model + one query model and sticks with it.

### Recipe 3: Code search RAG

**Stack:** voyage-code-3 (paid) or Qwen3-Embedding-8B (open) + Qdrant + reranker.

**Caveat:** if you are building a coding agent (not a code search product), grep + ripgrep + tree-sitter usually beats vector search. Cole Medin: *"The only reason traditional RAG is dead for AI coding is because of how structured our codebases are."*

The Cursor exception: for "magic button" UX over a 1000+ file repo, custom code embedder + Turbopuffer + Merkle-tree delta indexing + reranker yields **+12.5% accuracy** vs grep alone. The decision is product UX, not ML.

### Recipe 4: Multimodal RAG (text + image + PDF)

**Stack (US/global):** Gemini Embedding 2 + Qdrant or Weaviate + Claude or GPT-5 for synthesis.

**Stack (EU residency):** Cohere Embed v4 via AWS Bedrock EU profile + Qdrant Cloud (Frankfurt).

**Pipeline simplification benefit:** native multimodal models cut data-prep code by **70-80%** (300+ lines → 50-80 lines). The old school of LlamaParse + Tesseract + VLM captioning + Whisper + text embedder collapses into one API call with raw bytes.

**When NOT to upgrade to multimodal:** text-heavy KB with ≤10% visual content. Old-school text-embed pipeline is cheaper, easier to debug, and faster.

### Recipe 5: Fully self-hosted on a single L4 GPU

**Stack:** BGE-M3 + bge-reranker-v2-m3 in one TEI 1.9 container, Qdrant self-hosted on the same machine, FastAPI gateway.

**Throughput:** ~25K tokens/second for embeddings, ~145-300 ms reranking 100 candidates.

**Cost:** ~€50-80/month on Hetzner with a GPU instance.

**Use cases:** GDPR/152-FZ residency; commercial sensitivity (no data to API providers); high query volume where API costs would dominate.

### Recipe 6: Low-budget personal KB

**Stack:** Ollama + bge-m3 (`ollama pull bge-m3`) + Chroma persistent + local Llama 3.

**Setup time:** under 30 minutes.

**Limit:** sub-100K vectors, single user.

**Caveat:** Ollama's GGUF quantization can reduce quality at long context (>4K tokens). For real production switch to TEI.

---

## Sources

**Vendor documentation (verified April 2026):**
- OpenAI embeddings: https://platform.openai.com/docs/guides/embeddings
- Cohere Embed v4: https://docs.cohere.com/docs/embed-v4
- Voyage AI: https://docs.voyageai.com
- Google Gemini Embedding: https://ai.google.dev/gemini-api/docs/embeddings
- Jina Embeddings: https://jina.ai/embeddings
- BAAI BGE-M3: https://huggingface.co/BAAI/bge-m3
- Qwen3-Embedding: https://huggingface.co/Qwen/Qwen3-Embedding-8B

**Benchmarks:**
- MTEB / MMTEB: https://github.com/embeddings-benchmark/mteb
- BEIR: https://github.com/beir-cellar/beir
- CCKM (Milvus, March 2026): https://zc277584121.github.io/rag/2026/03/20/embedding-models-benchmark-2026.html
- DRAGON (Russian benchmark): https://arxiv.org/html/2507.05713v2
- ruMTEB: https://habr.com/ru/companies/sberdevices/articles/777268/
- ColPali (ICLR 2025): https://arxiv.org/abs/2407.01449
- "Lost in OCR Translation" (May 2025): https://arxiv.org/html/2505.05666

**Production case studies:**
- Notion vector search: https://www.notion.com/blog/two-years-of-vector-search-at-notion
- Cursor secure indexing: https://cursor.com/blog/secure-codebase-indexing
- Intercom Fin: https://fin.ai/research/do-you-really-need-a-vector-search-database/
- Glean fine-tuned embeddings: https://jxnl.co/writing/2025/03/06/fine-tuning-embedding-models-for-enterprise-rag-lessons-from-glean/
- Sparkonomy / Everlaw / Poke (Gemini Embedding 2 launch partners): Google Developer Blog, March-April 2026

**Critical issues:**
- RTEB scandal: https://github.com/embeddings-benchmark/mteb/issues/3934
- BGE-M3 Mac MPS benchmarks: https://github.com/FlagOpen/FlagEmbedding/issues/419

**Tool surface for self-hosting:**
- HuggingFace TEI: https://github.com/huggingface/text-embeddings-inference
- Infinity (multi-model embed+rerank+CLIP+ColPali): https://github.com/michaelfeil/infinity
- vLLM (with embedding pooling): https://docs.vllm.ai
- NVIDIA NIM Embeddings: https://docs.nvidia.com/nim/

---

*Version 1.0 | 2026-04-27 | M3 guide for HSS AI-Driven Development Level 1.*
