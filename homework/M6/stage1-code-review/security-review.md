# Security Mate — Review Summary

**Reviewer:** security-mate (Opus 4.7)
**Scope:** backend/controllers/*.js, backend/middleware/*.js, backend/routes/*.js, mcp-features/index.js, mcp-rag/index.js, mcp-rag/ingest.js
**Total findings:** 25

## Severity breakdown

- **HIGH:** 7
- **MEDIUM:** 14
- **LOW:** 2 (one is an A06 dependency-hygiene note since dep audit was out of scope)

---

## HIGH severity (fix first)

1. **backend/controllers/orderController.js:50** — `getOrderById` has no ownership check. Any authenticated user can read any order by ID (PII + shipping address + payment metadata). OWASP A01.
   - **Fix:** assert `order.user.equals(req.user._id) || req.user.isAdmin`, else `res.status(403)`.
2. **backend/controllers/orderController.js:67** — `updateOrderToPaid` trusts client-supplied PayPal `paymentResult` and has no ownership check. Logged-in user can mark any order paid with arbitrary JSON. OWASP A01/A08.
   - **Fix:** add ownership/admin gate; verify payment server-side via PayPal Orders API (`GET /v2/checkout/orders/{id}`); treat client `paymentResult` as opaque audit blob only.
3. **backend/controllers/userController.js:147** — Admin `updateUser` writes `user.isAdmin = req.body.isAdmin` without validation. Missing field silently demotes; string is truthy. OWASP A01.
   - **Fix:** Zod schema requiring `isAdmin: z.boolean()`; explicit `if ('isAdmin' in req.body) user.isAdmin = req.body.isAdmin === true`.
4. **backend/controllers/userController.js:8** — Login endpoint has no rate-limit / lockout — credential stuffing wide open. OWASP A07.
   - **Fix:** `express-rate-limit` 10 req / 15 min per IP+email; lockout 30 min after 5 fails; structured audit log per attempt.
5. **backend/controllers/orderController.js:7** — `itemsPrice/totalPrice` taken from request body and persisted. Attacker submits `totalPrice: 0`. OWASP A04.
   - **Fix:** ignore client price fields; recompute via single `Product.find({_id:{$in: ids}}).select('price').lean()`; recompute tax/shipping from server config.
6. **backend/routes/productRoutes.js:23** — Multer review-image upload uses raw `file.originalname` in disk filename, accepts any `image/*` MIME, no size limit. Path-traversal / double-extension / disk-fill DoS. OWASP A03/A04.
   - **Fix:** filename `crypto.randomUUID() + mime.extension(file.mimetype)`; MIME allowlist `['image/jpeg','image/png','image/webp']`; `limits:{fileSize: 2*1024*1024, files: 3}`; validate magic bytes via `file-type` not just MIME header.
7. **backend/routes/autopilotRoutes.js:6** — `POST /api/autopilot/feature-control` has no `protect`/`admin` middleware. Whole purpose (hide `N8N_API_KEY` from browser) defeated. OWASP A01.
   - **Fix:** add `protect, admin` chain; cap `req.body` size via route-local `express.json({limit:'16kb'})`; allowlist outbound URL to env-derived host (prevent SSRF if URL becomes configurable).
8. **mcp-features/index.js:295** — HTTP transport silently skips auth when `MCP_BEARER_TOKEN` is empty. Fail-open misconfig exposes write tools (`set_feature_state`) through Cloudflare tunnel. OWASP A05.
   - **Fix:** refuse to start in HTTP mode if `MCP_BEARER_TOKEN` empty AND `NODE_ENV !== 'development'`; log warn-loud if dev; require token length ≥ 32.

---

## MEDIUM severity

- **backend/utils/generateToken.js:4** — 30-day JWT, no revocation/refresh; algorithm not pinned in `sign`/`verify` (alg-confusion risk); no `JWT_SECRET` length check at startup. OWASP A02/A07.
  - **Fix:** `sign(..., {algorithm:'HS256', expiresIn:'1d'})`, `verify(..., {algorithms:['HS256']})`; assert `JWT_SECRET.length >= 32` at boot; introduce refresh-token flow (ADR-003 v3.0).
- **backend/middleware/errorMiddleware.js:7** — Stack traces leak unless `NODE_ENV === 'production'`. OWASP A05.
  - **Fix:** flip default — emit stack only when `NODE_ENV === 'development'`; never in test/staging/prod.
- **backend/middleware/authMiddleware.js:26** — `console.error(error)` on JWT failure dumps full error object (secret-leak risk). Also `admin` returns 401 instead of 403. OWASP A05/A09.
  - **Fix:** structured log `{event:'jwt_verify_failed', reason: err.name}` — no error object; `admin` → `res.status(403)`.
- **backend/controllers/productController.js:13** — `req.query.keyword` into `$regex` unescaped (ReDoS / NoSQL DoS). OWASP A03.
  - **Fix:** reuse escape helper from `suggestProducts`; cap length 64; anchor pattern.
- **backend/controllers/orderController.js:7** — No schema validation on `orderItems`/`shippingAddress`/`paymentMethod`. OWASP A04.
  - **Fix:** `backend/validators/order.schema.js` (Zod); reject unknown keys via `.strict()`.
- **backend/routes/productRoutes.js:29** — `fileFilter` trusts client MIME; no size limit. OWASP A03/A04.
  - **Fix:** see HIGH-6 — shared multer middleware module with MIME allowlist + size cap + magic-byte check.
- **backend/routes/autopilotRoutes.js:17** — SSRF surface (env-only allowlist), unbounded forwarded body. OWASP A10.
  - **Fix:** resolve `N8N_WEBHOOK_URL` host once at boot, reject if outbound URL host differs; cap forwarded body 16kb; axios `timeout: 5000`.
- **backend/routes/featureFlagRoutes.js:75** — "Atomic write" racy: read-modify-rename TOCTOU; MCP writes same file from separate process w/o cross-process lock. OWASP A04.
  - **Fix:** `proper-lockfile` advisory lock around read-modify-write; shared `featureFlagStore` module consumed by both writers.
- **backend/routes/featureFlagRoutes.js:39** — `req.params.key` used as JSON property accessor w/o allowlist regex. `__proto__`, `constructor` reachable. OWASP A04.
  - **Fix:** validate `key` against `/^[a-z][a-z0-9_-]{0,63}$/`; return 400 otherwise; use `Object.hasOwn(obj, key)` not `in`.
- **mcp-features/index.js:138** — Same prototype-key concern in MCP tool inputs; Zod schema lacks regex on `feature_id`. OWASP A03/A04.
  - **Fix:** `z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/)` on `feature_id` field.
- **mcp-features/index.js:303** — Bearer compared with `===` (timing-attack adjacent). OWASP A05.
  - **Fix:** `crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected))`; length-check first to avoid Buffer-length throw.
- **backend/models/userModel.js (via userController:31)** — `registerUser` accepts any password length/complexity. OWASP A07.
  - **Fix:** Zod schema `password: z.string().min(12).regex(/[A-Z]/).regex(/[a-z]/).regex(/[0-9]/)`; reject against breached-password list (`zxcvbn` score ≥ 3).
- **backend/routes/uploadRoutes.js:37** — `POST /api/upload` no auth. Anonymous user fills disk. OWASP A05/A04.
  - **Fix:** add `protect, admin` chain; reuse shared multer middleware (size cap + MIME allowlist).

---

## LOW severity

- **backend/middleware/authMiddleware.js:26** — No structured audit log for security-relevant events (login success/fail, role changes, flag mutations). OWASP A09.
  - **Fix:** introduce `backend/utils/audit.js` emitting JSON lines `{ts, event, actor, target, ip}`; wire into login, `updateUser`, feature-flag PATCH.
- **backend/* — A06 dependency-hygiene** note (no `npm audit` per scope); `express-async-handler` unmaintained, react-scripts/webpack-dev-server old.
  - **Fix:** schedule `npm audit --production` in CI; track migration off `express-async-handler` (native async + global error handler covers it).

---

## Cross-specialist collaboration

- None required for this pass. The race-condition on `features.json` (medium) overlaps architecture-mate's domain — flag for their attention if they review concurrent access patterns.

## Status

- [x] OWASP Top 10 categories scanned (A01–A10)
- [x] Hardcoded-secrets scan (none found in scope — secrets are env-loaded; verified `JWT_SECRET`, `COHERE_API_KEY`, `N8N_API_KEY`, `MCP_BEARER_TOKEN` are all read from `process.env`)
- [x] Dependency audit explicitly noted as out-of-scope per caller instructions
- [x] No source files modified

## Notes

- `mcp-rag/index.js` and `mcp-rag/ingest.js` are largely clean for security (read-only Qdrant client, no user-controlled file paths — `walkMd` traverses a hard-coded `project-data/` directory only, no `req`-style external input). Tool `query` flows only into Cohere/Qdrant — not back into shell or filesystem. The only minor note is that `dotenv.config` reads `.env` from the project root; no traversal there.
- `bcrypt` hashing and `User.matchPassword` were not in scope (`backend/models/userModel.js`) but appear correctly used — flagging password-policy concern instead.
