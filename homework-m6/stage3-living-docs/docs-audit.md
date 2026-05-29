# Existing docs audit — proshop_mern

> Filled by `legacy-auditor-mate` in Phase 1.5. Goal — do NOT throw away valid documentation.
> Every existing `docs/<folder>` and every top-level doc-file gets its own verdict.

**Auditor:** `legacy-auditor-mate` (Opus 4.8, 1M context)
**Audit date:** 2026-05-29
**Repo:** proshop_mern — MERN e-commerce study fork (Express + MongoDB API, React/Redux SPA reworked to Tailwind v4 + shadcn-style UI) plus two Node/TS MCP servers (feature-flags + RAG docs-search on Postgres/pgvector).
**Existing docs scanned:** 60 doc files across 11 subfolders (excludes `homework-m6.md` assignment, and `*.json`/`*.jsonl` data artifacts noted separately).

---

## Verdict legend

| Symbol | Verdict | Action in Phase 4 |
|---|---|---|
| ✅ | **ACCURATE** — matches code, well-maintained | Keep as-is in new docs structure |
| 🔄 | **PARTIALLY ACCURATE** — mostly right, has stale sections | Copy + add `TODO(audit-2026-05-29): <what>` markers in stale parts |
| 📦 | **HISTORICAL** — old but worth preserving (dev-history, past ADRs, post-mortems) | Move to `docs-archived-2026-05-29/`, **never `rm`**; link from new arch overview |
| ❌ | **STALE / REDUNDANT** — outdated and superseded | Archive first (never delete), then ignore going forward |

---

## Inventory

### Root loose files

| Path | Type | Verdict | Reasoning (1-3 lines) | Action |
|---|---|---|---|---|
| `README.md` | file (~12K) | 🔄 PARTIALLY ACCURATE | Correctly describes backend, polyglot persistence, and BOTH Node/TS MCP servers (search-docs uses pgvector+OpenAI). But Tech Stack table still lists React 16 / React-Bootstrap 1.3 / CRA / Axios 0.20 — superseded by the Tailwind v4 + Radix/shadcn + Vite rework. | Copy; TODO marker on the Tech Stack table (frontend rows) and "16 screens / React-Bootstrap" folder notes. |
| `DESIGN.md` | file (~?) | ✅ ACCURATE | Tailwind v4 `@theme` HSL tokens, Geist font, shadcn aesthetic — matches the reworked `frontend/src/components/good-shop/ui` + Radix deps. Dated 2026-05-18, right after the rework. | Keep. Primary source for design section. |
| `FINDINGS.md` | file (~?) | 🔄 PARTIALLY ACCURATE | Risk register verified 2026-04-27. Findings 1-4 marked fixed with SHAs (accurate). But it predates today's three Stage-2 security fixes (getUsers password leak, order IDOR, public upload) which it does not list. Still-open items (5-15) remain valid. | Copy; TODO marker noting the 3 newer security fixes landed 2026-05-29 and are not reflected here. |
| `report.md` | file (~?) | 📦 HISTORICAL | M2/M3 homework run logs (Copilot rules diff, feature-flag MCP tool transcripts). Point-in-time record of past coursework, not a description of current code. | Archive; link from history. |

### Top-level docs/

| Path | Type | Verdict | Reasoning (1-3 lines) | Action |
|---|---|---|---|---|
| `docs/architecture.md` | file (C4 diagram) | 🔄 PARTIALLY ACCURATE | Mermaid C4 of the order/PayPal flow; backend nodes (routes/controllers/middleware) still accurate. Frontend nodes still reference `screens/*.js`; omits the second MCP/RAG container and reworked UI. | Copy; TODO marker for frontend `.js`→`.jsx` rename + missing RAG/pgvector + feature-flag containers. |
| `docs/DESIGN_SYSTEM.md` | file (template) | ❌ STALE / REDUNDANT | Unfilled TEMPLATE (contains `[название]`, "Как пользоваться этим шаблоном", literal `[...]` placeholders). Superseded by the concrete, filled `DESIGN.md`. | Archive (template, not project doc). |
| `docs/anti-slop-supplement.md` | file | ✅ ACCURATE | Generic guard-rail/design-discipline guidance; tech-agnostic, references DESIGN.md. Still valid as engineering guidance. | Keep. |
| `docs/design-system-pack-example/` (README + design-system.{css,json,md}) | folder (4 files) | ❌ STALE / REDUNDANT | "Minimal Tech v1.0.0" EXAMPLE export pack illustrating the ZIP-pattern — not this project's design system (that's DESIGN.md). Reference artifact only. | Archive (example pack, never delete). |

### docs/adr/ — newer ADR set (numbering 0001-0003)

| Path | Type | Verdict | Reasoning | Action |
|---|---|---|---|---|
| `docs/adr/0001-stateless-jwt-auth-with-localstorage.md` | file | ✅ ACCURATE | JWT in `Authorization: Bearer` + localStorage matches current auth (generateToken, authMiddleware). | Keep, preserve numbering. |
| `docs/adr/0002-client-trusted-paypal-payment-verification.md` | file | ✅ ACCURATE | Client-trust PayPal model (`react-paypal-button-v2` → `PUT /api/orders/:id/pay`) matches current code. | Keep. |
| `docs/adr/0003-no-database-migration-tooling.md` | file | ✅ ACCURATE | Schema-via-Mongoose-models, no migration tool — still true. | Keep. |

### docs/project-data/adrs/ — older ADR set (adr-001..005)

| Path | Type | Verdict | Reasoning | Action |
|---|---|---|---|---|
| `docs/project-data/adrs/adr-001-mongodb-vs-postgres.md` | file | 🔄 PARTIALLY ACCURATE | Decision narrative is valid history, but claims MongoDB is the **sole** database. Reality is now polyglot: Mongo + JSON file (feature flags) + Postgres/pgvector (RAG). Status DEVIATED. | Copy; TODO marker on "sole database" — note polyglot persistence + cross-link ADR-0003. |
| `docs/project-data/adrs/adr-002-redux-vs-context.md` | file | ✅ ACCURATE | Classic Redux + Thunk still in use (`react-redux ^8`, hand-written actions/reducers). | Keep. |
| `docs/project-data/adrs/adr-003-jwt-vs-session.md` | file | ⚠️ 📦 HISTORICAL (duplicate) | Same decision as newer `docs/adr/0001`. Overlapping/duplicated ADR; the newer numbered set is canonical. | Archive as historical duplicate; canonical = `docs/adr/0001`. |
| `docs/project-data/adrs/adr-004-paypal-vs-stripe.md` | file | 🔄 PARTIALLY ACCURATE | PayPal-over-Stripe choice still holds; overlaps with newer `docs/adr/0002` (which covers verification model). Decision accurate. | Keep, cross-link to `docs/adr/0002`. |
| `docs/project-data/adrs/adr-005-bootstrap-vs-tailwind.md` | file | ❌ STALE / SUPERSEDED | Chose Bootstrap 4, deferred Tailwind "to v3.0". Frontend was fully reworked to Tailwind v4 + shadcn ~11 days ago — decision is reversed in code. | Archive; superseded by the rework + DESIGN.md. Note reversal in new ADR. |

### docs/project-data/api/

| Path | Type | Verdict | Reasoning | Action |
|---|---|---|---|---|
| `docs/project-data/api/auth.md` | file | ✅ ACCURATE | Auth/login/register endpoints unchanged. | Keep. |
| `docs/project-data/api/products.md` | file | ✅ ACCURATE | Product endpoints unchanged. | Keep. |
| `docs/project-data/api/users.md` | file | 🔄 PARTIALLY ACCURATE | GET /api/users sample responses omit password (matches `.select('-password')`), so largely OK — but doc predates the Stage-2 hardening; verify no example implies hashes were ever returned. | Copy; TODO marker confirming password-hash exclusion is now enforced (Stage-2 fix 2026-05-29). |
| `docs/project-data/api/orders.md` | file | 🔄 PARTIALLY ACCURATE | Overview says "users view their own orders" but predates the IDOR fix: GET /api/orders/:id is now owner/admin-only (non-owner gets 404). Doc likely describes old open-read behavior. | Copy; TODO marker on GET /api/orders/:id auth (now owner/admin, 404 for others). |
| `docs/project-data/api/uploads.md` | file | 🔄 PARTIALLY ACCURATE | Doc already states "Only authenticated admin users can upload" and lists 401/admin errors — this MATCHES the new protect+admin guard. If the doc was written pre-fix it is now coincidentally correct; verify path is `/api/upload` (singular) vs doc's `/api/uploads`. | Copy; TODO marker to verify route path singular/plural; confirm protect+admin (Stage-2 fix). |

### docs/project-data/features/

| Path | Type | Verdict | Reasoning | Action |
|---|---|---|---|---|
| `docs/project-data/features/{admin,auth,cart,catalog,checkout,payments}.md` | folder (6 files, RU) | 🔄 PARTIALLY ACCURATE | Describe behavior/user-flows/Redux/API for each domain — backend behavior accurate. Reference frontend screens by old `.js` paths (e.g. `CheckoutSteps.js`) and Bootstrap-era UI; screens are now `.jsx` + Tailwind/shadcn. Flow logic survives the rework; UI/layout details stale. | Copy; TODO markers on `.js`→`.jsx` filenames and Bootstrap UI descriptions. |

### docs/project-data/pages/

| Path | Type | Verdict | Reasoning | Action |
|---|---|---|---|---|
| `docs/project-data/pages/INDEX.md` + 15 page docs | folder (16 files) | 🔄 PARTIALLY ACCURATE | Routes, access rules, Redux slices, and API-call sections remain accurate (screens still exist, same routes). But 12 of 15 files contain Bootstrap component references ("two-column layout", react-bootstrap), which predate the Tailwind v4 + shadcn rework. INDEX links by route are still valid. | Copy; TODO markers on the "What Users See"/Components sections describing Bootstrap layout; verify against `good-shop/ui`. |

### docs/project-data/runbooks/

| Path | Type | Verdict | Reasoning | Action |
|---|---|---|---|---|
| `docs/project-data/runbooks/db-seed-and-reset.md` | file | ✅ ACCURATE | seeder.js import/destroy flow unchanged. | Keep. |
| `docs/project-data/runbooks/local-setup.md` | file | 🔄 PARTIALLY ACCURATE | Bootstrap-dev steps mostly valid (Node, Docker, Mongo). Says Node v14+ and frontend uses CRA; reworked frontend uses Vite + Node ≥18. | Copy; TODO marker on Node version + CRA→Vite dev command. |
| `docs/project-data/runbooks/deploy.md` | file | 🔄 PARTIALLY ACCURATE | Heroku deploy procedure; generic steps OK but "npm run test (if available)" and Mongo-only assumptions predate Postgres/pgvector + MCP containers. | Copy; TODO marker noting polyglot stores + no app test suite (tests only under homework-m6/). |
| `docs/project-data/runbooks/feature-flag-toggle.md` | file | ✅ ACCURATE | Matches `backend/features.json` + feature-flags MCP tools (verified in report.md transcripts). | Keep. |
| `docs/project-data/runbooks/ab-test-setup.md` | file | ✅ ACCURATE | A/B via feature-flag traffic_percentage / status Testing — matches features.json model. | Keep. |
| `docs/project-data/runbooks/incident-response.md` | file | ✅ ACCURATE | Generic incident process; references incidents/ set. | Keep, cross-link to incidents/. |

### docs/project-data/incidents/

| Path | Type | Verdict | Reasoning | Action |
|---|---|---|---|---|
| `docs/project-data/incidents/i-001-paypal-double-charge.md` | file | 📦 HISTORICAL | P1 postmortem (2023-11). Irreplaceable institutional context; referenced by ADR-001 and incident-response runbook. | Archive; link from arch overview + runbooks. |
| `docs/project-data/incidents/i-002-mongo-connection-pool-exhaustion.md` | file | 📦 HISTORICAL | Past incident postmortem. | Archive; link from runbooks. |
| `docs/project-data/incidents/i-003-jwt-secret-leak.md` | file | 📦 HISTORICAL | Past security incident postmortem. | Archive; link from arch/security overview. |

### docs/project-data/ top-level

| Path | Type | Verdict | Reasoning | Action |
|---|---|---|---|---|
| `docs/project-data/architecture.md` | file (~30K) | 🔄 PARTIALLY ACCURATE | Strong backend/Redux/auth/upload narrative, accurate for the API. But Tech Stack lists React-Bootstrap 1.3 (line 71), references `.js` screens, and omits the RAG/pgvector + MCP layer. Pre-rework. | Copy; TODO markers on frontend framework (Bootstrap→Tailwind v4/shadcn) + add RAG/MCP + polyglot persistence section. |
| `docs/project-data/dev-history.md` | file | 📦 HISTORICAL | Full project timeline Jan-2023 → Apr-2026; onboarding/retrospective context tied to ADRs and incidents. Irreplaceable. | Archive; link prominently from new architecture/README. |
| `docs/project-data/best-practices.md` | file | ✅ ACCURATE | "MERN Best Practices 2026" — generic, forward-looking engineering guidance; explicitly frames proshop as deprecated reference. No false claims about current code. | Keep. |
| `docs/project-data/glossary.md` | file | 🔄 PARTIALLY ACCURATE | Domain + technical terms mostly valid (Customer/Product/Order models accurate). Missing newer terms: feature flags / pgvector / RAG / MCP / shadcn. | Copy; add missing terms, then keep. |
| `docs/project-data/feature-flags-spec.md` | file | ✅ ACCURATE | Authoritative spec for `backend/features.json` + feature-flags MCP; matches the JSON schema and MCP tool behavior. | Keep. Primary source for feature-flags section. |
| `docs/project-data/features-analysis-ru.md` | file | 🔄 PARTIALLY ACCURATE | Maps 25 feature flags to course milestones (M3-M7). Flag data accurate, but planning notes ("M4 Figma redesign", references `CheckoutSteps.js`) are course-roadmap speculation now partly overtaken (rework done). Useful as analysis. | Copy; TODO marker that the M4 rework already happened (Tailwind v4). |
| `docs/project-data/features.json` | data file | ✅ ACCURATE | Mirrors `backend/features.json` (search_v2 etc.); the live feature-flag dataset. | Keep (data, not prose). |
| `docs/project-data/chunks.jsonl` | data file (723 lines) | 📦 HISTORICAL / DERIVED | RAG ingestion corpus — pre-chunked text of the OTHER docs, embedded into pgvector. Derived artifact; will go stale as docs change, but is the search-docs MCP's source. | Keep as data; flag for RE-INGEST after Phase 4 doc changes (do not hand-edit). |

### docs/guides/ — reference guides (RU + -en translation pairs)

| Path | Type | Verdict | Reasoning | Action |
|---|---|---|---|---|
| `docs/guides/chunking-strategies-guide{,-en}.md` | pair (RU + EN) | ✅ ACCURATE | General RAG chunking reference; tech-agnostic, current (2026). Relevant to search-docs MCP. | Keep both. |
| `docs/guides/embedding-models-2026-guide{,-en}.md` | pair | ✅ ACCURATE | Embedding-model survey; matches OpenAI-embeddings use in search-docs MCP. | Keep both. |
| `docs/guides/grep-lsp-agents-md-guide{,-en}.md` | pair | ✅ ACCURATE | Tooling/agent guidance; generic, current. | Keep both. |
| `docs/guides/mcp-design-principles{,-en}.md` | pair | ✅ ACCURATE | MCP design principles 2026; directly relevant to the two MCP servers. | Keep both. |
| `docs/guides/mcp-vs-cli-vs-skills-decision-framework{,-en}.md` | pair | ✅ ACCURATE | Decision framework; generic, current. | Keep both. |
| `docs/guides/vector-db-comparison-2026{,-en}.md` | pair | ✅ ACCURATE | Vector-DB comparison 2026; supports the pgvector choice. | Keep both. |

> Guides classified per pair (6 pairs = 12 files); RU is primary, `-en` is the translation — same content, keep both paths together.

---

## Summary

- ✅ Keep as-is: **23** items (DESIGN.md, anti-slop-supplement, docs/adr 0001-0003, adr-002, auth.md, products.md, db-seed/feature-flag-toggle/ab-test/incident-response runbooks, best-practices, feature-flags-spec, features.json, all 6 guide pairs counted as 12 files)
- 🔄 Update + keep: **18** items (README, FINDINGS, docs/architecture, adr-001, adr-004, users/orders/uploads API, features/ folder, pages/ folder, local-setup, deploy runbooks, project-data/architecture, glossary, features-analysis-ru)
- 📦 Archive (historical): **6** items (report.md, adr-003 duplicate, dev-history, i-001, i-002, i-003, chunks.jsonl treated as keep-data)
- ❌ Archive (stale): **3** items (docs/DESIGN_SYSTEM.md template, design-system-pack-example/, adr-005-bootstrap-vs-tailwind)

> Counts treat each guide `-en` translation as its own file, the features/ and pages/ folders as one coherent row each, and chunks.jsonl/features.json as data (kept). Total prose+data items reviewed: ~50 logical entries / 60 files.

---

## Cross-references to preserve

Things that **must not get lost** in the swap:

- `docs/project-data/dev-history.md` → must be linked from `docs-new/architecture/README.md` (onboarding/retro context, ties ADR-001 to incidents).
- **Two ADR sets** → keep `docs/adr/0001-0003` as the **canonical** numbered set; preserve numbering, do NOT restart from 1. The older `docs/project-data/adrs/adr-001..005` overlaps: `adr-003-jwt-vs-session` duplicates `0001`; `adr-004-paypal-vs-stripe`/`adr-002` relate to `0002`. New ADR for the Bootstrap→Tailwind reversal should supersede `adr-005` and continue numbering (e.g. `0004`).
- `docs/project-data/incidents/i-001..003` → referenced by `runbooks/incident-response.md` and `adr-001` — archive but cross-link from runbooks; do NOT archive blindly.
- `docs/project-data/feature-flags-spec.md` → primary source for the feature-flags section; pairs with `backend/features.json` + `docs/project-data/features.json`.
- `DESIGN.md` → primary source for the design-system section (supersedes the DESIGN_SYSTEM.md template + design-system-pack-example).
- `docs/project-data/chunks.jsonl` → RAG corpus for search-docs MCP; must be RE-EMBEDDED after Phase 4 doc edits or search results go stale.

---

## Notes for Phase 2 planning

- **Today's three Stage-2 security fixes are NOT reflected in api/ docs or FINDINGS.md.** Plan must add/verify: users.md (no password hashes), orders.md (GET /:id owner/admin-only, 404 IDOR guard), uploads.md (protect+admin). These are the highest-priority TODO markers.
- **Frontend rework (Tailwind v4 + shadcn under `frontend/src/components/good-shop/`) post-dates almost every project-data doc.** Anything describing React-Bootstrap, `.js` screens, or CRA is stale on the UI axis but usually fine on the behavior axis (routes/Redux/API survive). Treat as PARTIALLY ACCURATE, not STALE — preserve the behavioral content.
- **adr-005-bootstrap-vs-tailwind is the one clear hard-superseded ADR** — code reversed the decision. Archive and write a successor ADR documenting the Tailwind v4 migration.
- **Polyglot persistence is undocumented as a unified picture.** Mongo + `backend/features.json` (file) + Postgres/pgvector (RAG). adr-001 and both architecture.md files assume Mongo-only. New architecture overview needs a "data stores" section.
- **The second MCP server (search-docs / RAG) is missing from both architecture.md files** (README has it). New arch overview should include both MCP containers + pgvector. Confirm: NO Python MCP, NO `rag/` folder, NO Weaviate, NO `superpowers/` folder exist — any future doc claiming these is wrong.
- **No app test suite exists** (tests added today only under `homework-m6/`). Runbooks/README that imply `npm run test` must be flagged.
- **chunks.jsonl is a derived RAG artifact** — do not hand-edit; schedule re-ingest as a Phase 4 step after doc edits land.
- **design-system-pack-example/ and DESIGN_SYSTEM.md are templates/examples, not project docs** — archive to avoid them being mistaken for the real design system (DESIGN.md).
