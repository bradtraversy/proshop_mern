# Security Mate — Review Summary

**Reviewer:** security-mate (Opus 4.x, acting per .claude/agents/security-mate.md)
**Scope:** Whole repository — backend/, frontend/src/, mcp-server-feature-flags/src/, mcp-server-search-docs/src/, root config (server.js, Dockerfile, docker-compose.yml, .env.example)
**Scope size:** ~25 source/config files across backend, two TS MCP servers, and Docker/root config
**Read FIRST:** .github/copilot-instructions.md, docs/adr/*, docs/project-data/adrs/* — ADR-0001 (JWT in localStorage) and ADR-0002 (client-trusted PayPal verification) are documented decisions; the related findings are still flagged with that context noted.

## Findings

- **HIGH:** 7 issues
- **MEDIUM:** 7 issues
- **LOW:** 4 issues

Total: 18 findings.

## Top concerns (HIGH)

1. **backend/controllers/orderController.js:43** — IDOR: `getOrderById` (`GET /api/orders/:id`) has no ownership/admin check; any logged-in user can read any order's PII, shipping address, email and payment result by iterating ids (OWASP A01).
2. **backend/controllers/orderController.js:60** — `updateOrderToPaid` (`PUT /api/orders/:id/pay`) lets any authenticated user mark ANY order paid with attacker-supplied `paymentResult`; no ownership check and no server-side PayPal capture verification (OWASP A01; ADR-0002 acknowledges the trust gap).
3. **backend/routes/uploadRoutes.js:37** — `POST /api/upload` is fully public (no `protect`/`admin`); anyone can upload files that are then served statically from `/uploads` (OWASP A01).
4. **package.json:24** — `jsonwebtoken ^8.5.1` carries HIGH CVEs including jwt.verify signature-validation bypass via insecure default algorithm and RSA→HMAC key confusion; `authMiddleware.js` also does not pin `algorithms` (OWASP A06).
5. **backend/routes/userRoutes.js:16** — `POST /api/users/login` has no rate limiting, enabling brute-force / credential stuffing (OWASP A07).

Other HIGH: outdated dependency chain (`multer`, `mongoose`, `express`) with 2 critical / 20 high npm-audit advisories (package.json:27); unbounded Multer uploads with weak MIME/extension validation and disk-exhaustion DoS (uploadRoutes.js:30).

## Notable MEDIUM

- NoSQL operator injection risk on unvalidated `req.body.email` in `User.findOne` (userController.js:11) — add express-mongo-sanitize / type checks.
- Prompt-injection / SQL-literal hygiene in the RAG MCP server: query is parameterized (`$1/$2`, good) but retrieved document text is returned to the calling LLM untrusted (mcp-server-search-docs/src/index.ts:115).
- Hardcoded default Postgres creds (`proshop/proshop`) as source fallback and in docker-compose (search-docs index.ts:24, docker-compose.yml:39).
- No request body-size limit, no helmet, no global rate limiter (server.js:25); 30-day JWT TTL with no rotation/revocation + localStorage storage (generateToken.js:4); no password-strength/email validation (userController.js:30); raw error object logged on auth failure (authMiddleware.js:21).

## LOW (hardening)

- bcrypt cost factor 10 (raise to >=12 / argon2id), userModel.js:39.
- Missing CORS allowlist & security headers around `/api/config/paypal` and globally, server.js:33.
- Container runs as root (no `USER node`), Dockerfile:1.
- Feature-flag controller uses raw `req.params.name` as object key + reflected into error (prototype-pollution/reflection hygiene), featureFlagController.js:24.

## Positive observations

- `.env` is NOT tracked in git (gitignored) and `.env.example` contains only placeholders — no committed secrets found.
- JWT signature IS verified (`jwt.verify`, not `decode`) in authMiddleware.js.
- Product search `$regex` input is escaped (productController.js:14) — the previously-noted ReDoS is mitigated.
- RAG MCP SQL uses parameterized queries (`$1`, `$2`), not string concatenation of user text into the query body.
- Admin/protect middleware is correctly applied to user-admin and feature-flag-update routes.

## Cross-specialist collaboration

- No live inbox used in this single-agent run. ADR-0001 (JWT/localStorage) and ADR-0002 (client-trusted PayPal) reviewed directly; findings #2 and the JWT-TTL finding are flagged as design risks that the ADRs acknowledge — recommend architecture review to revisit.

## Status

- All OWASP Top 10 categories scanned
- Dependency audit completed (npm audit: 2 critical, 20 high, 11 moderate, 6 low)
- Secrets scan completed (.env not committed; default DB creds flagged)
