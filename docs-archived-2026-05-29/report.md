# M2 — Report

## IDE

GitHub Copilot CLI 

## Rules diff

1. Add section "5.0 Code Style" - to ensure a consistent and readable codebase.
2. Add section "5.4 Error Handling" - to ensure consistent and robust error management across the codebase.
3. Add section "7. Pull Request Approval Criteria" - to maintain the quality of the project.

# M3 — Report

## Feature flags MCP

**Step 1 — get_feature_info**

Tool: `get_feature_info`
Arguments: `{ "feature_name": "search_v2" }`
Response:
```json
{
  "key": "search_v2",
  "name": "New Search Algorithm",
  "description": "Replaces legacy regex-based keyword matching with a hybrid BM25 + TF-IDF ranking pipeline...",
  "status": "Testing",
  "traffic_percentage": 15,
  "last_modified": "2026-03-10",
  "targeted_segments": ["beta_users", "internal"],
  "rollout_strategy": "canary",
  "depends_on": []
}
```
Observation: Feature was already in **Testing** (not Disabled), so no state change was needed.

**Step 2 — adjust_traffic_rollout**

Tool: `adjust_traffic_rollout`
Arguments: `{ "feature_name": "search_v2", "percentage": 25 }`
Response:
```json
{
  "key": "search_v2",
  "name": "New Search Algorithm",
  "status": "Testing",
  "traffic_percentage": 25,
  "last_modified": "2026-05-06",
  "depends_on": []
}
```
Traffic successfully updated from 15% to 25%.

**Step 3 — get_feature_info (confirmation)**

Tool: `get_feature_info`
Arguments: `{ "feature_name": "search_v2" }`
Response:
```json
{
  "key": "search_v2",
  "name": "New Search Algorithm",
  "status": "Testing",
  "traffic_percentage": 25,
  "last_modified": "2026-05-06",
  "targeted_segments": ["beta_users", "internal"],
  "rollout_strategy": "canary",
  "depends_on": []
}
```

**Final state:**

| Field         | Value       |
|---------------|-------------|
| Key           | `search_v2` |
| Status        | Testing     |
| Traffic       | 25%         |
| Last modified | 2026-05-06  |
| Dependencies  | None        |

---

## RAG Documentation Corpus

### Stack

| Component       | Choice                           | Rationale                                                                                  |
|-----------------|----------------------------------|--------------------------------------------------------------------------------------------|
| Embedding model | OpenAI `text-embedding-3-small`  | Managed API, multilingual, 1536 dims, $0.02/1M tokens — cheapest production-quality option |
| Vector DB       | pgvector (PostgreSQL 17)         | Already in docker-compose; native SQL interface; IVFFlat index for cosine similarity       |
| Chunking        | Custom Python script             | Semantic splitting by markdown headings; preserves document structure                      |
| Client library  | `openai` Python SDK + `psycopg2` | Standard, well-maintained, minimal dependencies                                            |

### Repository artifacts

| Artifact         | Path                             | Description                                                 |
|------------------|----------------------------------|-------------------------------------------------------------|
| Chunking script  | `scripts/chunk_markdown.py`      | Splits 47 markdown files into semantic chunks               |
| Ingestion script | `scripts/embed_chunks.py`        | Embeds chunks with OpenAI and loads into pgvector           |
| Search script    | `scripts/search_chunks.py`       | CLI semantic search with optional pre-filters               |
| Python deps      | `scripts/requirements.txt`       | `openai`, `psycopg2-binary`, `python-dotenv`                |
| Chunks corpus    | `docs/project-data/chunks.jsonl` | 723 chunks with text + metadata (full corpus, not a sample) |

### Chunking parameters

- **Target size:** 400 tokens, max 600, min 50
- **Strategy:** Semantic — split by H1/H2/H3 headings; tables split by rows preserving header
- **Overlap:** Only when cutting mid-paragraph (1 sentence)
- **Metadata per chunk:** `source_file`, `file_path`, `title`, `parent_headings`, `keywords`, `summary`, `language`

### Test queries

**Query 1:** "Какая БД используется в proshop_mern и почему именно она?"
(Factual single-hop — expected: ADR about MongoDB choice)

| # | Score | Source            | Section                              |
|---|-------|-------------------|--------------------------------------|
| 1 | 0.319 | features/cart.md  | Cart Persistence > Зависимости       |
| 2 | 0.314 | features/admin.md | Admin Product Delete > API endpoints |
| 3 | 0.313 | architecture.md   | Data Layer > Collection: orders      |

**Verdict:** ❌ Missed the target chunk (`adrs/adr-001-mongodb`). Low scores overall (0.31–0.32). The ADR chunk likely lacks explicit phrasing "какая БД и почему" — the title/headings context is not embedded with the text.

---

**Query 2:** "Какие фичи зависят от payment_stripe_v3?"
(Multi-hop dependency query)

| # | Score | Source                  | Section                                      |
|---|-------|-------------------------|----------------------------------------------|
| 1 | 0.478 | features/checkout.md    | Payment Method Selection > User flow         |
| 2 | 0.457 | features-analysis-ru.md | M4 Figma-прототипирование > Слабые кандидаты |
| 3 | 0.453 | pages/payment.md        | Route                                        |

**Verdict:** ⚠️ Topically relevant (payments/stripe domain), but doesn't answer the exact dependency graph question. Feature flag dependency data lives in `backend/features.json` (not chunked — it's JSON, not markdown).

---

**Query 3:** "Что случилось во время последнего incident с checkout?"
(Filtered retrieval — `--type incidents`)

| # | Score | Source                                              | Section  |
|---|-------|-----------------------------------------------------|----------|
| 1 | 0.424 | incidents/i-002-mongo-connection-pool-exhaustion.md | Impact   |
| 2 | 0.409 | incidents/i-001-paypal-double-charge.md             | Impact   |
| 3 | 0.398 | incidents/i-001-paypal-double-charge.md             | Timeline |

**Verdict:** ✅ With the `--type incidents` pre-filter, results are highly relevant. Both incident reports surface with their Impact sections first — ideal for answering "what happened" questions.

### Reflection

I chose OpenAI `text-embedding-3-small` over local models (BGE-M3, nomic) primarily for simplicity and reliability — no GPU required, no Ollama container to manage, and the cost for 723 chunks is negligible ($0.001).

pgvector was the natural vector store since the PostgreSQL container was already part of my docker-compose stack, eliminating the need for a dedicated vector DB like Qdrant or Pinecone. 

The chunking pipeline (semantic splitting by markdown headings) works well for structured documentation but struggles with the ADR query because chunk text alone doesn't always carry enough context about *what question the document answers* — enriching embeddings with title + parent_headings prepended to the text would likely fix this. 

The pre-filter mechanism (`--source_file`, `--type`) proved critical for targeted queries and should be the default approach when an agent knows the document category. The main limitation is that my corpus is markdown-only: structured data like `features.json` isn't indexed, so dependency-graph questions require the MCP tools rather than RAG. 

If I was to redo this, I would (1) prepend metadata context to chunk text before embedding, (2) include JSON/YAML sources as chunked prose, and (3) add a hybrid keyword search (BM25) alongside vector similarity for exact-match queries.

### Search-docs MCP

Below is a complete log of using the `search_project_docs` MCP tool to answer three questions about the proshop_mern project. Each query lists the top-K chunks returned, followed by the synthesized answer.

---

#### Question 1: Какая БД используется и почему?

**Query 1a** — `"Which database is used and why was it chosen over alternatives?"` (top_k=5)

| # | Score  | Source file                      | Parent headings                                           | Snippet (truncated)                                                                               |
|---|--------|----------------------------------|-----------------------------------------------------------|---------------------------------------------------------------------------------------------------|
| 1 | 0.3706 | adrs/adr-002-redux-vs-context.md | Current Assessment (April 2026)                           | "Redux (RTK) remains the production state management solution…"                                   |
| 2 | 0.3640 | dev-history.md                   | 3. Major Decisions › Decision 5: JWT over session cookies | "Chosen for stateless architecture — the backend has no session store…"                           |
| 3 | 0.3442 | adrs/adr-002-redux-vs-context.md | *(top-level)*                                             | "Status: Accepted (original Redux decision); Partially superseded — RTK Query migration planned…" |
| 4 | 0.2767 | best-practices.md                | 8.4 Blue-green vs. canary                                 | "Strategy                                                                                         | Downtime | Rollback Speed…"                                                                                 |
| 5 | 0.2763 | runbooks/ab-test-setup.md        | Test Setup in Code › 1. Create A/B Test Document          | "db.abtests.insertOne({testId: 'checkout-v2-2024-04'…"                                            |

**Verdict:** ❌ Missed the target. Query was too generic; the ADR-001 about MongoDB didn't surface. Scores low (0.27–0.37), results mostly about Redux and JWT.

**Query 1b (refined)** — `"adr-001 database technology selection MongoDB Mongoose"` (top_k=5)

| # | Score  | Source file                                         | Parent headings                                                     | Snippet (truncated)                                                                                                                         |
|---|--------|-----------------------------------------------------|---------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------|
| 1 | 0.6264 | adrs/adr-001-mongodb-vs-postgres.md                 | Current Assessment (April 2026)                                     | "For the actual workload — a product catalog with fixed schema, standard user/order relationships…PostgreSQL would have been equally valid" |
| 2 | 0.5203 | adrs/adr-001-mongodb-vs-postgres.md                 | Alternatives Considered › PostgreSQL (with Sequelize or Prisma ORM) | "PostgreSQL was the team's existing experience base. Full ACID compliance…"                                                                 |
| 3 | 0.4995 | best-practices.md                                   | 2.4 Node.js 22 LTS                                                  | "Production MongoDB goes through Atlas (managed)…"                                                                                          |
| 4 | 0.4617 | incidents/i-002-mongo-connection-pool-exhaustion.md | Technical Deep Dive › Why the default was never changed             | "The Mongoose default of 5 was inherited from the initial project setup…"                                                                   |
| 5 | 0.4460 | adrs/adr-001-mongodb-vs-postgres.md                 | Alternatives Considered › SQLite (via Sequelize)                    | "Considered briefly for its zero-infrastructure simplicity…Rejected because SQLite is not appropriate for multi-connection production"      |

**Verdict:** ✅ Direct hit. Three chunks from ADR-001 with high relevance (0.45–0.63).

**Answer:** The project uses **MongoDB** (via Mongoose ODM), as documented in **ADR-001**. Key reasons:
1. **MERN stack alignment** — MongoDB is the "M" in MERN; the course curriculum was built around it.
2. **Zero-infrastructure free tier** — MongoDB Atlas free tier removed the need for any self-hosted DB.
3. **JSON-native storage** — documents map directly to JavaScript objects, simplifying the development model.

Alternatives considered and rejected:
- **PostgreSQL** (team's existing experience, full ACID, mature query planner) — rejected in favor of curriculum alignment.
- **SQLite** — rejected as not suitable for multi-connection production deployment.

The current assessment (April 2026) acknowledges that PostgreSQL would have been "equally valid and arguably more appropriate" for the actual workload (fixed-schema catalog, standard relationships, modest traffic).

---

#### Question 2: Какие фичи зависят от payment_stripe_v3?

**Query 2a** — `"features that depend on payment_stripe_v3"` (top_k=5)

| # | Score  | Source file             | Parent headings                                      | Snippet (truncated)                                                                     |
|---|--------|-------------------------|------------------------------------------------------|-----------------------------------------------------------------------------------------|
| 1 | 0.4875 | pages/payment.md        | Route                                                | "`/payment` — Authenticated users only (accessed after shipping step)…"                 |
| 2 | 0.4745 | feature-flags-spec.md   | 4. Feature Flag Catalog › Payments › apple_pay       | "Default state: Disabled. Shows an Apple Pay button on PaymentScreen for Safari users…" |
| 3 | 0.4636 | features-analysis-ru.md | 5. M4 Figma-прототипирование › Слабые кандидаты      | "`gift_message`, `guest_checkout`, `admin_bulk_actions`… `stripe_alternative`…"         |
| 4 | 0.4463 | features/payments.md    | Feature 6: Payment Result Storage › Технический impl | "Order model field: paymentResult: { id, status, update_time, email_address }…"         |
| 5 | 0.4311 | features/checkout.md    | Feature 3: Payment Method Selection › User flow      | "Закомментированный вариант «Stripe» — потенциальное расширение…"                       |

**Query 2b (refined)** — `"stripe_alternative apple_pay depends_on dependency chain"` (top_k=5)

| # | Score  | Source file             | Parent headings                                             | Snippet (truncated)                                                                            |
|---|--------|-------------------------|-------------------------------------------------------------|------------------------------------------------------------------------------------------------|
| 1 | 0.5300 | feature-flags-spec.md   | 4. Feature Flag Catalog › Payments › stripe_alternative     | "Default state: Testing (5%). Enables the Stripe payment path…"                                |
| 2 | 0.3830 | feature-flags-spec.md   | 4. Feature Flag Catalog › Payments › paypal_express_buttons | "Default state: Enabled (100%). PayPal Smart Payment Buttons on CartScreen and ProductScreen…" |
| 3 | 0.3562 | pages/payment.md        | Route                                                       | "`/payment` — Authenticated users only…"                                                       |
| 4 | 0.3439 | features-analysis-ru.md | 5. M4 Figma-прототипирование › Слабые кандидаты             | "`gift_message`, `guest_checkout`… `stripe_alternative`…"                                      |
| 5 | 0.3374 | features/payments.md    | Feature 2: PayPal Payment Button › Технический impl         | "Компонент: `react-paypal-button-v2`…"                                                         |

**MCP tool fallback:** Since search-docs returned topical but not structural dependency data, I used feature-flags MCP tools:

- `get_feature_info("stripe_alternative")` → `depends_on: []` (no upstream deps)
- `get_feature_info("apple_pay")` → `depends_on: []` (description mentions "Stripe payment processor backend" but no formal dependency)
- `list_features` → scanned all 25 features; none declare `stripe_alternative` (or any `payment_stripe_v3` variant) in their dependency chain.

**Answer:** There is **no feature flag named `payment_stripe_v3`** in the system. The closest match is **`stripe_alternative`** ("Stripe as Alternative Payment Processor"), currently in Testing at 5% traffic.

No other feature formally depends on `stripe_alternative` — its `depends_on` array is empty, and no other feature lists it as a dependency. However, the **`apple_pay`** flag's description notes it "Requires… a Stripe payment processor backend," implying an *informal/runtime* dependency on the Stripe integration — but this is not modeled as a feature-flag dependency.

---

#### Question 3: Что случилось во время последнего incident с checkout?

**Query 3a** — `"checkout incident postmortem"` (top_k=5)

| # | Score  | Source file                             | Parent headings                                                   | Snippet (truncated)                                                                                         |
|---|--------|-----------------------------------------|-------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------|
| 1 | 0.4545 | dev-history.md                          | 4. Lessons Learned › What we'd do differently                     | "Server-side recalculation of order totals should have been in v0.1, not v0.6. Trusting the client…"        |
| 2 | 0.4026 | incidents/i-001-paypal-double-charge.md | Timeline                                                          | "2023-11-03 21:14 PayPal sandbox receives payment for order 63c4a… First onApprove callback fires…"         |
| 3 | 0.3765 | incidents/i-003-jwt-secret-leak.md      | Summary                                                           | "During a routine security audit in July 2024…JWT secret, MongoDB connection string…committed to git…"      |
| 4 | 0.3599 | runbooks/incident-response.md           | Incident Postmortem: PayPal Payment Processor Outage › Root Cause | "PayPal API credentials have 1-year expiration (set to April 15, 2024). No calendar reminder was set…"      |
| 5 | 0.3384 | adrs/adr-004-paypal-vs-stripe.md        | Consequences › Negative                                           | "Sandbox behavior does not faithfully replicate production. PayPal sandbox fires onApprove callback twice…" |

**Query 3b (refined)** — `"PayPal double charge onApprove incident"` (top_k=5)

| # | Score  | Source file                    | Parent headings                 | Snippet (truncated)                                                                 |
|---|--------|--------------------------------|---------------------------------|-------------------------------------------------------------------------------------|
| 1 | 0.2718 | glossary.md                    | Dead Letter Queue (DLQ)         | "Message queue for failed/unprocessable messages…"                                  |
| 2 | 0.2426 | adrs/adr-003-jwt-vs-session.md | Current Assessment (April 2026) | "The JWT approach works correctly…known limitations (no revocation, localStorage)…" |
| 3 | 0.2351 | pages/login.md                 | Edge Cases                      | "Empty fields: Form submission still occurs; backend validates…"                    |
| 4 | 0.1459 | api/uploads.md                 | Allowed File Types              | ".jpg, .jpeg, .png — Maximum file size: 2 MB…"                                      |
| 5 | 0.1196 | pages/login.md                 | Route                           | "`/login`, `/login?redirect=[page]`…"                                               |

**Verdict:** Query 3a was significantly better. Two checkout-related incidents surfaced:
- **i-001** (PayPal double-charge) — the most checkout-specific incident
- **i-002** (MongoDB connection pool exhaustion on Black Friday) — indirectly affected checkout
- The runbook's embedded postmortem about PayPal credential expiry also surfaced

**Answer:** The most recent checkout-specific incident was **i-001: PayPal Sandbox Webhook Double-Charge** (2023-11-03).

**What happened:**
1. PayPal sandbox received payment for an order.
2. The `onApprove` callback fired **twice** within 2 seconds (a known PayPal sandbox quirk).
3. The backend `updateOrderToPaid` handler was not idempotent — it processed both callbacks, resulting in a double-charge in the test environment.

**Root cause:** No idempotency check on the payment confirmation endpoint. The `orderController` blindly updated the order status on each `onApprove` callback without verifying whether payment had already been recorded.

**Lesson learned** (from dev-history.md): "Server-side recalculation of order totals should have been in v0.1, not v0.6. Trusting the client for any financial calculation is never acceptable."

Additionally, the **PayPal Payment Processor Outage** (from the incident-response runbook) documented a separate checkout failure: PayPal API credentials expired silently (1-year expiry, no calendar reminder), causing 10 minutes of checkout failures on 2024-04-15.

### End-to-end

End-to-end scenario: find `payment_stripe_v3` in docs, check its state via feature-flags MCP, conditionally enable, and cite the documentation.

---

#### Step 1 — search-docs MCP: find `payment_stripe_v3` in documentation

**Query 1a** — `"payment_stripe_v3 feature flag description dependencies"` (top_k=5)

| # | Score  | Source file             | Parent headings                                  | Snippet (truncated)                                                                            |
|---|--------|-------------------------|--------------------------------------------------|------------------------------------------------------------------------------------------------|
| 1 | 0.4926 | feature-flags-spec.md   | Feature Flag Catalog › Payments › apple_pay      | "Default state: Disabled. Shows an Apple Pay button on PaymentScreen for Safari users…"        |
| 2 | 0.4762 | feature-flags-spec.md   | 5. Rollout Strategies › Kill Switch              | "The kill switch pattern means keeping a fully-deployed feature under a flag…"                 |
| 3 | 0.4687 | feature-flags-spec.md   | Feature Flag Catalog › Payments › paypal_express | "Default state: Enabled (100%). PayPal Smart Payment Buttons on CartScreen and ProductScreen…" |
| 4 | 0.4462 | pages/payment.md        | Route                                            | "`/payment` — Authenticated users only (accessed after shipping step)…"                        |
| 5 | 0.4100 | features-analysis-ru.md | M4 Figma-прототипирование › Слабые кандидаты     | "`gift_message`, `guest_checkout`… `stripe_alternative`…"                                      |

**Observation:** No chunk mentions a key `payment_stripe_v3`. The term does not appear anywhere in the 723-chunk documentation corpus. The closest match in the Payments category is `stripe_alternative`.

**Query 1b** — `"stripe payment processor feature flag catalog depends_on"` (top_k=5)

| # | Score  | Source file             | Parent headings                                  | Snippet (truncated)                                                |
|---|--------|-------------------------|--------------------------------------------------|--------------------------------------------------------------------|
| 1 | 0.5067 | feature-flags-spec.md   | 5. Rollout Strategies › Kill Switch              | "The kill switch pattern…paypal_express_buttons, recently_viewed…" |
| 2 | 0.4940 | feature-flags-spec.md   | Feature Flag Catalog › Payments › paypal_express | "Default state: Enabled (100%). PayPal Smart Payment Buttons…"     |
| 3 | 0.4746 | pages/payment.md        | Route                                            | "`/payment` — Authenticated users only…"                           |
| 4 | 0.4231 | feature-flags-spec.md   | Feature Flag Catalog › Payments › apple_pay      | "Default state: Disabled. Shows an Apple Pay button…"              |
| 5 | 0.4176 | features-analysis-ru.md | M4 Figma-прототипирование › Слабые кандидаты     | "`stripe_alternative`…"                                            |

**Observation:** Again, no `payment_stripe_v3`. The `stripe_alternative` key appears in multiple chunks. This is the only Stripe-related feature flag in the catalog.

**Query 1c** — `"stripe_alternative Stripe as Alternative Payment Processor enables Stripe payment path"` (top_k=5)

| # | Score  | Source file             | Parent headings                                          | Snippet (truncated)                                                         |
|---|--------|-------------------------|----------------------------------------------------------|-----------------------------------------------------------------------------|
| 1 | 0.4983 | feature-flags-spec.md   | Feature Flag Catalog › Payments › apple_pay              | "Default state: Disabled. Shows Apple Pay button…Web Payments Request API…" |
| 2 | 0.4687 | features/checkout.md    | Feature 3: Payment Method Selection › User flow          | "Закомментированный вариант «Stripe» — потенциальное расширение…"           |
| 3 | 0.4506 | pages/payment.md        | Route                                                    | "`/payment` — Authenticated users only…"                                    |
| 4 | 0.3630 | features-analysis-ru.md | M4 Figma-прототипирование › Слабые кандидаты             | "`stripe_alternative`…"                                                     |
| 5 | 0.3450 | feature-flags-spec.md   | Feature Flag Catalog › Payments › paypal_express_buttons | "Default state: Enabled (100%)…"                                            |

**Observation:** `features/checkout.md` confirms the Stripe radio button is currently commented out in `PaymentScreen.js`, and the `stripe_alternative` flag is the mechanism to enable it.

**search-docs conclusion:** The feature key `payment_stripe_v3` **does not exist** in the documentation corpus. The only Stripe-related feature flag is `stripe_alternative` (key: `stripe_alternative`).

---

#### Step 2 — feature-flags MCP: verify `payment_stripe_v3` existence

**Tool call:** `get_feature_info({ feature_name: "payment_stripe_v3" })`

**Response:**
```
Feature 'payment_stripe_v3' not found. Available features: search_v2,
semantic_search, search_autosuggest, cart_redesign, save_for_later,
guest_cart_persistence, express_checkout, multi_step_checkout_v2,
gift_message, paypal_express_buttons, apple_pay, stripe_alternative,
product_recommendations, recently_viewed, infinite_scroll,
admin_dashboard_v2, admin_bulk_actions, admin_advanced_filters,
reviews_moderation, photo_reviews, verified_purchase_badge,
image_lazy_loading, code_splitting_optimisation, dark_mode,
guest_checkout.
```

**Observation:** Confirmed — `payment_stripe_v3` is not a registered feature flag. 25 flags exist; the closest is `stripe_alternative`.

---

#### Step 3 — feature-flags MCP: check `stripe_alternative` state

**Tool call:** `get_feature_info({ feature_name: "stripe_alternative" })`

**Response:**
```json
{
  "key": "stripe_alternative",
  "name": "Stripe as Alternative Payment Processor",
  "description": "Enables the Stripe payment method option that is currently commented out in PaymentScreen.js. Adds a Stripe checkout backend route to orderController and handles webhooks for async payment confirmation. Acts as a fallback when PayPal is unavailable and provides credit card tokenization independent of PayPal.",
  "status": "Testing",
  "traffic_percentage": 5,
  "last_modified": "2026-04-05",
  "targeted_segments": ["beta_users"],
  "rollout_strategy": "canary",
  "depends_on": []
}
```

**Current state:**

| Field              | Value                                       |
|--------------------|---------------------------------------------|
| Key                | `stripe_alternative`                        |
| Status             | **Testing**                                 |
| Traffic            | 5%                                          |
| Dependencies       | None (`depends_on: []`)                     |
| Targeted segments  | `beta_users`                                |
| Rollout strategy   | canary                                      |

---

#### Step 4 — Conditional state change: evaluation

The task condition was: *"Если она в статусе Disabled и все зависимости не в Disabled — переведи в Testing, установи трафик 25%."*

- Status is **Testing** (not Disabled) → **condition NOT met**.
- No `set_feature_state` or `adjust_traffic_rollout` calls were made.

**No changes applied.** The feature is already past the Disabled stage and actively canary-testing at 5% for `beta_users`.

---

#### Step 5 — Documentation citation

From **feature-flags-spec.md** (Feature Flag Catalog › Payments › `stripe_alternative`):

> The `PaymentScreen` currently has a Stripe radio button that is commented out. This flag enables the Stripe payment path: the user selects Stripe, enters card details via Stripe Elements, and the backend processes the charge through the Stripe API.

From **feature-flags MCP** (`get_feature_info` description field):

> Enables the Stripe payment method option that is currently commented out in PaymentScreen.js. Adds a Stripe checkout backend route to orderController and handles webhooks for async payment confirmation. **Acts as a fallback when PayPal is unavailable** and provides credit card tokenization independent of PayPal.

From **features/checkout.md** (Feature 3: Payment Method Selection › User flow):

> Закомментированный вариант «Stripe» — потенциальное расширение.

**Purpose summary:** `stripe_alternative` exists to provide a **second payment processor** (Stripe) alongside PayPal. It serves as a fallback when PayPal is unavailable and enables direct credit card tokenization without going through PayPal's flow.

---

#### Summary

| Step | MCP used      | Tool                  | Result                                                       |
|------|---------------|-----------------------|--------------------------------------------------------------|
| 1    | search-docs   | `search_project_docs` | `payment_stripe_v3` not found; closest: `stripe_alternative` |
| 2    | feature-flags | `get_feature_info`    | `payment_stripe_v3` confirmed not registered                 |
| 3    | feature-flags | `get_feature_info`    | `stripe_alternative` is Testing @ 5%, no dependencies        |
| 4    | —             | —                     | Condition (Disabled) not met → **no state change**           |
| 5    | search-docs   | `search_project_docs` | Documentation cited: Stripe fallback for PayPal              |

Additionally, the **PayPal Payment Processor Outage** (from the incident-response runbook) documented a separate checkout failure: PayPal API credentials expired silently (1-year expiry, no calendar reminder), causing 10 minutes of checkout failures on 2024-04-15.