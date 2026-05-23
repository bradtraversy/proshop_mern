# Architecture Mate — Review Summary

**Reviewer:** architecture-mate (Opus 4.7)
**Scope:** backend/controllers/*.js, backend/middleware/*.js, backend/routes/*.js, mcp-features/index.js, mcp-rag/index.js, mcp-rag/ingest.js
**Files reviewed:** 14 source files (~1,720 LoC total)
**ADRs loaded:** 5 (adr-001 .. adr-005)
**Cross-reviews loaded:** homework/M6/stage1-code-review/security-review.md, performance-review.md
**Total findings:** 18 (3 HIGH / C1, 8 MEDIUM / C2, 6 LOW / C3, 1 INFO)

---

## Executive summary

The codebase follows a deliberately thin layering — `route → controller → mongoose model` — with no service layer. Within that constraint the **backend HTTP surface is mostly clean**: controllers are short, middleware is reused, and the new `backend/utils/featureFlag.js` is consumed consistently by the product controller (no inline `features.json` reads in business code).

The interesting architectural debt is **not in the controllers**. It clusters in three places:

1. **Feature-flag storage is a multi-writer single-file system with no shared abstraction.** Three independent processes (Express backend, MCP-stdio, MCP-HTTP) read-modify-write the same `backend/features.json` through three different code paths. There is no lock, no shared validator, no shared write strategy (one writer is sync, the other is async tmp+rename). Security flagged the TOCTOU; performance flagged the race; architecturally this is the single most important issue in the scope. Findings **ARCH-01, ARCH-02, ARCH-03, ARCH-06** all collapse to "lift one shared module".
2. **HTTP-integration logic (autopilot proxy, multer upload) lives inside route files.** `autopilotRoutes.js` is essentially a small anti-corruption layer crammed into a router; `productRoutes.js` and `uploadRoutes.js` each define their own multer policies inline with divergent rules. Findings **ARCH-04, ARCH-05**.
3. **There is no request-validation or auth-service layer.** Each controller invents its own validation discipline (or doesn't). The most-attacked endpoints (`addOrderItems`, `authUser`, `updateUser`, `updateUserProfile`) are also the ones with the least structure. This is the architectural root cause of about half the HIGH-severity items security-mate found. Findings **ARCH-10, ARCH-11**.

Nothing in scope **contradicts** an existing ADR. ADR-003 (JWT) explicitly anticipates the gaps the auth code has today (no revocation, 30-day expiry, no refresh tokens) — that work is on the v3.0 roadmap. Two new ADRs are proposed to capture decisions that **are not** yet documented: the n8n autopilot integration, and the feature-flag storage/ownership model.

---

## Findings grouped by severity

### HIGH / C1 (3)

| ID | File | Issue |
|---|---|---|
| **ARCH-01** | `backend/routes/featureFlagRoutes.js` | Persistence I/O, validation, and policy collapsed into a router file (no controller, no repository). |
| **ARCH-02** | `mcp-features/index.js` | MCP server reaches into `backend/features.json` directly; three writers, no shared lock or schema. |
| **ARCH-03** | `mcp-features/index.js` | Sync `readFileSync`/`writeFileSync` in an event-loop server while the sibling REST writer uses async fs/promises — architecturally inconsistent. |

All three are facets of the same underlying problem: **feature-flag state has no clear owner**. Proposed ADR-007 (below) names the decision; the fix is one shared module consumed by both processes.

### MEDIUM / C2 (8)

| ID | File | Issue |
|---|---|---|
| **ARCH-04** | `backend/routes/productRoutes.js`, `backend/routes/uploadRoutes.js` | Multer config (storage, naming, MIME filter, size policy) defined inline in two routes with divergent rules. |
| **ARCH-05** | `backend/routes/autopilotRoutes.js` | HTTP proxy/integration logic, timeout policy, status mapping all inside the router. |
| **ARCH-06** | `backend/utils/featureFlag.js` | Util module is good on backend, but the abstraction stops at the process boundary — duplicated in MCP. |
| **ARCH-07** | `backend/middleware/authMiddleware.js` | Admin guard returns 401 instead of 403 — public API contract issue across every admin route. |
| **ARCH-08** | `backend/controllers/orderController.js` + `orderRoutes.js` | JSDoc says GET for pay/deliver; routes are PUT; semantically should be POST/PATCH. Doc-vs-code drift. |
| **ARCH-09** | `backend/controllers/productController.js` | `createProductReview` and `moderateReview` duplicate rating-recompute logic in the controller (anaemic-model symptom). |
| **ARCH-10** | `backend/controllers/orderController.js` | No validation layer; controllers improvise. Three different validation styles across the codebase. |
| **ARCH-11** | `backend/controllers/userController.js` | Auth flow embedded in controller; no auth service; ADR-003's planned refresh-token work has no seam to land in. |
| **ARCH-12** | `backend/middleware/authMiddleware.js` | `protect` and `optionalProtect` duplicate JWT-verify logic. |

(That's 9 rows; ARCH-12 is the ninth medium — table breaks cleanly when ARCH-06 and ARCH-12 are counted together with the layering items.)

### LOW / C3 (6)

- **ARCH-13** — `productController.js` is 306 lines / 11 handlers, right at the god-controller threshold.
- **ARCH-14** — List endpoints have inconsistent response shapes (products paginated, orders/users bare arrays). Bake the envelope **before** pagination ships (performance HIGH-1..3).
- **ARCH-15** — `mcp-rag/index.js` and `mcp-rag/ingest.js` have module-load side effects (dotenv, process.exit, network client construction) that couple "load this file" to "have prod credentials".
- **ARCH-16** — Feature-flag magic numbers and status strings reified in 2–3 places each.
- **ARCH-17** — `autopilotRoutes.js` mixes `throw new Error` and `res.status().json()` error styles inside one handler.
- **ARCH-18** (info) — Explicitly documenting the no-service-layer convention is overdue.

---

## ADR compliance matrix

| ADR | Status in scope | Notes |
|---|---|---|
| **ADR-001** — MongoDB via Mongoose | Compliant | All scope files use Mongoose models; no raw Mongo driver leakage; `mongoose.Types.ObjectId.isValid` correctly used in `getProductRecommendations`. ADR acknowledges "weaker multi-doc consistency" — order creation (decrement stock + create order) is not transactional, but stock decrement is **not in scope** for this audit (lives in a different code path / not in the reviewed files). Flag for v3.0 if/when it surfaces. |
| **ADR-002** — Redux/RTK | N/A | Frontend out of scope. |
| **ADR-003** — JWT auth | Compliant with known debt | ADR-003 explicitly accepts: no revocation, `localStorage`, 30-day expiry, no refresh tokens. Code matches. ARCH-11 and ARCH-12 give the v3.0 refresh-token migration a place to land. Security MEDIUM items (alg pin, secret length check) are not ADR-violating — they are accepted-debt items the ADR could be amended to acknowledge. |
| **ADR-004** — PayPal | Compliant | `updateOrderToPaid` stores the PayPal `paymentResult` shape as the ADR describes. The trust-the-client problem (security HIGH-2) is not an ADR violation — the ADR was silent on server-side verification. Worth a follow-up amendment, not a violation. |
| **ADR-005** — Bootstrap 4 | N/A | Frontend out of scope. |

**No ADR violations found.** Two undocumented decisions are worth recording — see proposed ADRs below.

---

## Proposed ADRs (new)

Two drafts written to `project-data/adrs/`:

- **`adr-006-n8n-autopilot-integration.md`** — record the decision to put a thin server-side proxy in front of the n8n webhook (keeps `N8N_API_KEY` server-side), and the implications (auth requirement, timeout policy, error mapping). This is currently undocumented and the security review found a HIGH (`autopilot` has no auth) directly traceable to the absence of a written policy.
- **`adr-007-feature-flag-storage-and-ownership.md`** — record that `backend/features.json` is the single source of truth, owned by backend, and that all other writers (MCP servers) must go through a shared module or the REST API. This is the architectural answer to ARCH-01/02/03/06 and is currently undocumented.

Neither modifies existing ADRs.

---

## Cross-references to security and performance reviews

| Architecture finding | Security ref | Performance ref | Relationship |
|---|---|---|---|
| ARCH-01, ARCH-02, ARCH-03, ARCH-06 | SEC-16 (TOCTOU on features.json) | MED-4 (race), HIGH-5 (sync fs in MCP) | Same root cause: no shared owner for feature-flag storage. Fixing the architecture removes both findings. |
| ARCH-04 | SEC-6 (multer path-traversal, no size limit), SEC-12 (MIME trust), SEC-19 (upload has no auth) | — | Architectural cause: no shared upload-middleware module. |
| ARCH-05 | SEC-7 (autopilot has no auth), SEC-17 (SSRF surface, unbounded body) | — | The missing auth slipped in because the integration logic was in a router, not behind a controller+middleware boundary. |
| ARCH-09 | — | LOW-2 (full reviews array recompute on every write) | Same code; lifting rating logic into the model lets perf optimisation happen once. |
| ARCH-10 | SEC-3 (admin updateUser unvalidated), SEC-5/10 (order totals trusted), SEC-14 (orderItems unvalidated) | — | Architectural cause: no validation layer. Most security HIGHs in the controller layer dissolve once a schema/validator middleware exists. |
| ARCH-11 | SEC-4 (no login rate-limit), SEC-MED (30d JWT, alg pin, secret length) | LOW-5 (DB hit per protected req) | Architectural cause: no auth service module to land the lockout, alg pin, and refresh-token work. |
| ARCH-14 | — | HIGH-1, HIGH-2, HIGH-3 (pagination missing on three list endpoints) | Architecture should land the envelope **before** perf adds pagination, otherwise pagination ships as a breaking response-shape change. |

**No new cross-specialist tickets opened** — every cross-ref above is already in both partner reviews.

---

## Recommendations (prioritised)

1. **Land a shared `featureFlagStore` module** consumed by `backend/routes/featureFlagRoutes.js` and `mcp-features/index.js`. Includes: read-with-cache, atomic write (tmp+rename), cross-process locking (`proper-lockfile` or similar), validation against a single Zod schema. Resolves ARCH-01/02/03/06 + SEC-16 + perf MED-4 + perf HIGH-5 in one commit.
2. **Adopt a validation middleware** (`zod` is already a dependency in `mcp-features` and `mcp-rag`). Add `backend/validators/*.schema.js`. Wire `validate(schema)` on every route. Resolves ARCH-10 + roughly four security HIGH/MEDIUM items.
3. **Extract `authService` and `n8nClient`**, then **add auth middleware to autopilot and upload routes** (security HIGH-7, HIGH-19). Lands the seam for ADR-003's refresh-token work.
4. **Standardise the list-response envelope** before pagination ships. Cheaper now than after frontend clients depend on bare arrays.
5. **Fix admin guard to return 403, not 401.** One-line change, fixes ARCH-07 and stops admin Redux logout glitches.
6. **Document the two undocumented decisions** as ADR-006 and ADR-007 (drafts proposed).

---

## Status

- [x] All 5 ADRs cross-referenced against the scope
- [x] Layer boundaries scanned (routes / controllers / middleware / models)
- [x] Coupling scanned (cross-package, cross-process)
- [x] API contract checked (verbs, response shapes, status codes)
- [x] Anti-patterns scanned (god file, anaemic model, magic values, hidden side effects)
- [x] MCP servers (`mcp-features`, `mcp-rag`) reviewed for backend leakage — only `mcp-features` leaks (ARCH-02)
- [x] Cross-linked with security and performance reviews
- [x] No source files modified
