# ProShop MERN — Development History

> Internal document. Covers the full lifecycle of the project from initial commit (January 2023) through the current state (April 2026). Intended for onboarding, retrospectives, and architectural context.

---

## 1. Project Timeline

### Phase 0 — Prototype (January–February 2023)

The project started as a learning exercise that gradually became a real internal reference implementation. The initial goal was to prove out a full MERN stack (MongoDB, Express, React, Node.js) for a lightweight e-commerce domain. No production deployment was intended at this stage.

The first working version had: a static product list seeded from JSON, a cart stored in `localStorage`, and no authentication. PayPal integration was mocked with a hardcoded `PAID` status flip. The team was two engineers working part-time.

Key early constraint: the team had prior experience with SQL (PostgreSQL on a previous project) but chose MongoDB to experiment with document-based modeling for a product catalog with variable attributes. This decision is documented in ADR-001.

### Phase 1 — MVP (March–June 2023)

Authentication was added (JWT, bcrypt), the cart moved from localStorage to a proper Redux store, and orders became persistent in MongoDB. PayPal sandbox integration replaced the mock. An admin panel was scaffolded: product CRUD, order list, user management.

Deployment target at this point was Heroku (free tier), with MongoDB Atlas on M0 (shared cluster). No CDN, no image optimization. Product images were served as static files from the Express server's `uploads/` directory — a decision we paid for later (see Incidents i-002).

The first user-facing bug that made it to production: the order total was calculated on the frontend and sent to the backend as-is. No server-side recalculation. Fixed in v0.6 after a tester found they could manipulate the cart total in Redux DevTools and place orders at $0.01.

### Phase 2 — Stabilization (July–November 2023)

Heroku announced the end of its free tier (November 2022; the team was slow to migrate). The app moved to Render.com for the Node backend and kept MongoDB Atlas. Static frontend build was served directly from Express, which simplified deployment but hurt performance.

The review system (star rating + text comment) was added in v1.0. This introduced the first aggregation pipeline in MongoDB — computing average rating and review count per product. It was slower than expected on products with >200 reviews; a compound index on `product._id` + `createdAt` brought p99 latency from ~340ms to ~28ms.

Redux was refactored from raw `redux` + hand-written reducers to **Redux Toolkit** (RTK) in this phase. See ADR-002 for the rationale. The migration took three days and eliminated ~800 lines of boilerplate.

### Phase 3 — Growth Features (December 2023–June 2024)

v1.5 introduced image upload via Multer to a local `uploads/` directory. This worked fine on a single-instance deployment but became a problem when the team briefly ran two Render instances behind a load balancer — uploaded images were not shared. The team reverted to single-instance rather than wiring up S3 at that point.

v1.6 added pagination to the product list. Before this, the home screen fetched all products in a single query — fine at 25 products, painful at 300+.

v1.7 introduced the admin product edit screen and marked admin routes with a middleware guard (`isAdmin`). Prior to this, the admin dashboard existed but route-level protection was incomplete — the list endpoints were protected, but the PUT `/api/products/:id` route could be called by any authenticated user who knew the URL.

The Black Friday 2023 spike (see Incident i-002) was the forcing function for connection pool tuning and proper load testing. After that incident, the team added basic load tests using `k6` and set alert thresholds in MongoDB Atlas.

### Phase 4 — Hardening (July 2024–December 2024)

A security audit in July 2024 discovered that a `.env` file had been committed to the repository in February 2023 and never removed from git history (Incident i-003). JWT secrets, the MongoDB connection string, and PayPal credentials were all exposed. Full secret rotation and history rewrite followed.

After the .env incident the team added `git-secrets` as a pre-commit hook and a GitHub Actions workflow that scanned for credential patterns on every push.

v2.0 was the first release after the security hardening sprint. It also introduced rate limiting on the auth endpoints (`express-rate-limit`, 10 requests / 15 minutes per IP on `/api/users/login`) and helmet.js for HTTP security headers.

v2.1 brought PayPal production credentials (moved from sandbox) after the team verified the double-charge fix from Incident i-001 was stable in sandbox for 60 days.

### Phase 5 — Current (January 2025–April 2026)

The frontend is still running on Create React App (CRA), which is officially unmaintained. Migration to Vite has been scoped but not started — the blocking issue is the Bootstrap 4 dependency (see ADR-005).

RTK Query was evaluated as a replacement for the current Redux + `axios` data-fetching layer. The team built a proof-of-concept for the products slice; initial results showed a 30–40% reduction in data-fetching code. Full migration is planned for v3.0.

The current deployment stack: Render.com (Node/Express), MongoDB Atlas M10 (dedicated), Cloudflare for DNS + DDoS protection. No SSR — the team evaluated Next.js in late 2024 but decided against it (see Major Decisions section).

---

## 2. Release Notes

### v0.1 — Initial Commit (2023-01-14)

**Added:**
- Project scaffold: Express backend, CRA frontend, concurrently dev runner
- Static product data seeded from `backend/data/products.js`
- MongoDB connection via Mongoose (local Docker + Atlas config)
- Basic product listing and product detail pages

**Known issues at release:**
- No authentication
- Cart state lost on page refresh (no persistence)
- No order flow

---

### v0.3 — Cart + Basic Checkout (2023-02-08)

**Added:**
- Redux store with cart slice (localStorage persistence via `redux-persist`)
- Shipping address form, payment method selection (hardcoded to PayPal)
- Place Order screen (writes to DB, sets `isPaid: false`)
- PayPal mock: clicking "Pay" immediately flipped `isPaid: true`

**Fixed:**
- Product quantity input accepted negative values

---

### v0.5 — Authentication (2023-03-15)

**Added:**
- User registration and login (bcrypt + JWT, 30-day expiry)
- Protected routes on frontend (redirect to login)
- Backend middleware: `protect` (auth check), first version of `admin` check

**Breaking changes:**
- MongoDB schema for `Order` now requires `user` field. Existing seed data invalid — run `npm run data:destroy && npm run data:import`.

---

### v0.6 — Order Total Recalculation Fix (2023-04-02)

**Fixed:**
- Critical: order totals (items price, shipping, tax, grand total) are now computed server-side in `orderController.createOrder`. Frontend-submitted totals are ignored.
- Tax rate hardcoded to 15% (configurable via `TAX_RATE` env var added in v1.2).

**Notes:**
- This was discovered via manual QA, not caught by automated tests (there were none at this point).

---

### v0.8 — PayPal SDK Integration (2023-04-28)

**Added:**
- Real PayPal JS SDK (sandbox) via `@paypal/react-paypal-js`
- `PAYPAL_CLIENT_ID` served from backend env, not hardcoded in frontend
- Order marked paid on PayPal `onApprove` callback; `paymentResult` stored in MongoDB

**Fixed:**
- Double-charge bug introduced in this release (not caught until v1.1 sandbox testing). See Incident i-001.

---

### v1.0 — Reviews + RTK Migration (2023-08-19)

**Added:**
- Product review system: star rating (1–5) + text comment, one review per user per product
- Average rating aggregated via MongoDB aggregation pipeline
- Redux Toolkit migration complete: `createSlice`, `createAsyncThunk` across all feature slices

**Fixed:**
- Admin middleware applied correctly to all mutation endpoints
- JWT expiry now returns 401 (was 500 due to unhandled `JsonWebTokenError`)

**Breaking changes:**
- Redux store shape changed. Clearing `localStorage` required for existing sessions: instruct users to log out before updating.

---

### v1.2 — Pagination + Search (2023-10-05)

**Added:**
- Server-side pagination on `/api/products` (default 8 per page, `pageSize` env configurable)
- Keyword search via MongoDB regex on `name` field
- `TAX_RATE` env variable

**Performance:**
- Home screen initial load: 1.8s → 420ms (p50) after pagination (was loading all 300+ products)

---

### v1.5 — Image Upload + Admin Edit (2024-01-22)

**Added:**
- Multer-based image upload to local `uploads/` directory
- Admin product edit screen (image, name, price, brand, category, countInStock, description)
- Admin user edit (name, email, isAdmin toggle)
- Admin order list with delivery status update

**Known limitation at release:**
- Image uploads not shared across instances. Single-instance constraint documented.

---

### v1.7 — Route Security Patch (2024-03-14)

**Fixed:**
- Critical: `PUT /api/products/:id` and `DELETE /api/products/:id` now require both `protect` and `admin` middleware. Previously only `protect` was applied — any authenticated user could modify or delete products.
- `PUT /api/users/:id` (admin user edit) similarly hardened.

**Added:**
- Integration test suite (Jest + Supertest) covering auth flows and product CRUD — 34 tests, 87% coverage on controllers.

---

### v2.0 — Security Hardening Release (2024-08-12)

**Added:**
- `helmet.js` (HTTP security headers)
- `express-rate-limit` on `/api/users/login` and `/api/users/register`
- `cors` configuration locked to allowed origins (was `*`)
- `git-secrets` pre-commit hook
- GitHub Actions: credential scan + dependency audit on every push

**Fixed:**
- `.env` removed from git history (see Incident i-003). All secrets rotated.
- MongoDB connection string no longer logged at startup (was printed to stdout in debug mode)

**Breaking changes:**
- Existing `.env` files must be regenerated from `.env.example`. Old JWT secret invalidated — all users must re-login.

---

### v2.3 — PayPal Production + Rate Limiting Tuning (2024-10-07)

**Added:**
- PayPal production credentials (sandbox retired for the primary deployment)
- Separate rate limit config for admin endpoints (more permissive: 60 req/15 min)
- Morgan request logging to file (rotated daily, 14-day retention)

**Fixed:**
- PayPal webhook idempotency check (see Incident i-001 postmortem action item, closed after 60-day sandbox verification)

---

### v2.5 — Connection Pool + Atlas Upgrade (2025-02-18)

**Added:**
- Mongoose connection pool size set to `maxPoolSize: 50` (was default 5)
- MongoDB Atlas upgraded from M2 to M10 (dedicated cluster)
- `mongodbAtlasAlerts` configured: CPU >70%, connections >80% of max, replication lag >10s
- Health check endpoint `/api/health` returning DB ping latency

**Fixed:**
- Connection pool exhaustion under load (see Incident i-002 postmortem action items)
- Mongoose deprecation warnings resolved (upgraded to Mongoose 7.x)

---

### v2.7 — Current Stable (2025-09-03)

**Added:**
- Cloudflare integration (DNS, CDN, DDoS protection)
- Product `countInStock` enforced at order creation (prevents overselling under concurrent load)
- `express-validator` on all mutation endpoints (was only on user registration)
- Structured JSON logging (replaced Morgan plain-text in production)

**Fixed:**
- Review endpoint allowed unauthenticated POST if token was malformed (returned 200 instead of 401)
- Order pagination on admin order list (was fetching all orders)

**Deprecations:**
- `redux-persist` will be removed in v3.0 (replaced by RTK Query cache + tag invalidation)

---

## 3. Major Decisions

### Decision 1: MongoDB over PostgreSQL

Made in January 2023 before the first commit. The rationale: the product catalog has variable attributes (electronics have wattage/voltage, clothing has size/material, etc.) that would require EAV patterns or JSONB columns in PostgreSQL. MongoDB's flexible document model handles this naturally.

In retrospect: for the core e-commerce entities (Order, User, Product with fixed fields), a relational model would have been equally fine and would have given stronger consistency guarantees for order processing. The "schema flexibility" benefit was mostly theoretical — in practice, the product schema stabilized within two months and rarely changed. Full ADR in `adrs/adr-001-mongodb-vs-postgres.md`.

### Decision 2: Redux Toolkit migration (v1.0)

The original Redux setup was written with `combineReducers`, hand-written action creators, and `redux-thunk` for async operations. By the time v1.0 was in development, the Redux codebase had grown to ~1,200 lines of boilerplate for six slices. RTK's `createSlice` and `createAsyncThunk` cut this to ~400 lines with equivalent functionality and better DevTools integration. Full ADR in `adrs/adr-002-redux-vs-context.md`.

A second migration is now scoped: moving from RTK + axios to RTK Query. The POC showed that RTK Query's automatic cache management, loading/error states, and tag-based invalidation can replace ~60% of the custom async thunk code. The blocking dependency is completing the v3.0 planning cycle.

### Decision 3: Rejecting SSR / Next.js (late 2024)

The team evaluated migrating to Next.js as a way to improve SEO (product pages are currently client-rendered and not indexed well by crawlers that don't execute JavaScript). The evaluation lasted three weeks. Conclusion: the migration cost (rewiring the Express API layer, adapting Redux to work with server components, Vercel deployment model change) exceeded the projected SEO benefit given the current traffic volume. The decision was made to stay on CRA + Express and accept the SEO limitation. If the project were started today, Next.js or Remix would be the default choice.

### Decision 4: Staying on Bootstrap 4

Bootstrap 4 was chosen in January 2023 because it was the default in the project template. By 2024, Tailwind CSS had become the clear community preference for new React projects. However, replacing Bootstrap 4 requires auditing every component, replacing utility classes, and potentially rewriting the responsive layout logic. The migration was scoped at ~5 engineer-days. Given other priorities, it has been deferred twice. Full ADR in `adrs/adr-005-bootstrap-vs-tailwind.md`.

### Decision 5: JWT over session cookies

Chosen for stateless architecture — the backend has no session store, making horizontal scaling simpler. In practice, the project has never run more than two instances simultaneously, so the "easier scaling" argument has never been exercised. The main operational cost: no server-side session revocation (a compromised token remains valid until expiry). Mitigated by short-ish expiry (30 days) and secret rotation capability (as exercised in Incident i-003). Full ADR in `adrs/adr-003-jwt-vs-session.md`.

---

## 4. Lessons Learned

### What worked well

**Redux Toolkit from the start would have saved a week.** The original hand-rolled Redux setup was a learning exercise, but the migration effort in v1.0 was real cost. For any new project, RTK (or RTK Query) is the right starting point.

**MongoDB Atlas monitoring is underrated.** After the i-002 incident, enabling Atlas performance advisor and configuring connection alerts caught two other near-misses in 2024 before they became incidents. The built-in query profiler identified a missing index on `orders.user` that caused a 2.1s query on the admin order list — fixed in one line.

**`express-async-handler` is a legitimate solution.** Early reviews suggested it was "hacky." In practice it's been stable for three years and keeps the controller code clean. No regrets.

**Integration tests on the controller layer paid off.** The 34 tests added in v1.7 caught three regressions during later refactors, including a middleware ordering bug that would have re-opened the admin route vulnerability.

### What we'd do differently

**Server-side recalculation of order totals should have been in v0.1, not v0.6.** Trusting the client for any financial calculation is never acceptable. The fact that it took a manual QA tester four months in to catch this is an indictment of not having even basic security review on the first checkout flow.

**The `.env` commit was preventable.** `git-secrets` or a `.gitignore` template that includes `.env` by default would have caught it. The fact that it stayed in git history for 17 months before discovery (and was only found by a deliberate audit, not automated scanning) is a process failure. The pre-commit hook should have been day-one infrastructure.

**Image uploads should have gone to S3 from the start.** The `uploads/` local directory approach worked for a single instance but created a silent coupling between deployment topology and feature functionality. The correct solution was S3 + CloudFront from the first image upload feature. The incremental cost (S3 SDK, IAM role, ~5 lines of Multer config) was trivial compared to the operational risk.

**PayPal over Stripe was the wrong call.** PayPal's sandbox environment is notoriously unreliable — the double-charge incident (i-001) was caused by non-standard webhook behavior that only occurs in sandbox, not in production, making it impossible to reproduce and verify the fix with confidence. Stripe's test mode is a much more faithful replica of production behavior. For any future project, Stripe is the default choice. Full reasoning in `adrs/adr-004-paypal-vs-stripe.md`.

**CRA lock-in should have been addressed sooner.** Create React App was already showing signs of declining maintenance in 2023. Starting with Vite would have avoided the current situation where upgrading the build tool requires untangling Bootstrap 4 and legacy Babel config simultaneously.

**No load testing until after the first incident.** The Black Friday i-002 incident was entirely predictable — the traffic spike was not exceptional, and a basic `k6` smoke test would have revealed the connection pool ceiling in 20 minutes. Load testing should be a prerequisite for any endpoint that serves public traffic, not a postmortem action item.
