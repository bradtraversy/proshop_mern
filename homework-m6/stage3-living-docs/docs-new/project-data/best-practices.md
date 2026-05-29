# MERN E-commerce Best Practices 2026

> Practical engineering guidance for building production-grade e-commerce systems on the MERN stack.
> Written for the `proshop_mern` study project — a deliberately "dirty" 2020-era codebase used as a
> RAG demonstration vehicle. The goal here is not to rewrite the project, but to document what
> production teams do differently in 2026.

---

## 1. Introduction: Why proshop_mern Is Deprecated

The original `proshop_mern` fork (bradtraversy/proshop_mern) was built circa 2020–2022 with:

- **React 17** — predates concurrent rendering and Server Components
- **Create React App** — unmaintained since 2023, superseded by Vite
- **Classic Redux** — hand-written action creators, action types, and reducers
- **localStorage for JWT** — known XSS vector
- **No TypeScript** — runtime errors catch what the compiler should
- **Bootstrap 4** — not tree-shakeable, global CSS collisions
- **Single flat Node process** — no clustering, no health checks, no graceful shutdown

None of these choices were wrong for their time. The codebase is marked `DEPRECATED` precisely because it makes an honest reference point: you can see _every shortcut_ that a real 2026 production build would address.

In 2026, the MERN stack itself is alive and well — it just looks different. The dominant shift is:

| 2020 era | 2026 production |
|---|---|
| Create React App | Vite or Next.js 15 |
| React 17 class/hook mix | React 19, Server Components where SSR helps |
| Classic Redux + thunks | RTK Query (if Redux in use) or TanStack Query |
| `localStorage` JWT | `httpOnly` cookie, refresh token rotation |
| Mongoose with no indexes | Compound indexes, lean(), projections |
| PayPal JS SDK direct | Webhook-driven, idempotency keys |
| No feature flags | OpenFeature / LaunchDarkly / Unleash |
| Ad-hoc admin CRUD | RBAC + audit log |

Sources:
- [How to Build a Production-Ready MERN Stack App in 2026](https://medium.com/@lomcos/how-to-build-a-production-ready-mern-stack-app-in-2026-cc5dc9d8bd81)
- [The Production MERN Stack Guide for 2026](https://dev.to/krunal_groovy/the-production-mern-stack-guide-for-2026-not-another-todo-app-4n31)
- [Architectural Best Practices for MERN E-commerce](https://www.technetexperts.com/mern-nextjs-ecommerce-architecture/)

---

## 2. MERN Production Patterns 2025–2026

### 2.1 TypeScript end-to-end

Modern MERN projects use TypeScript across the full stack with shared interfaces in a `packages/shared/` monorepo package. The compiler catches shape mismatches between Mongoose documents, API responses, and React props at build time rather than in production.

```
project/
├── apps/
│   ├── web/          # React / Next.js frontend
│   └── api/          # Express / Fastify backend
├── packages/
│   ├── shared/       # Shared TypeScript interfaces
│   └── db/           # Mongoose models + migrations
```

### 2.2 Vite replaces Create React App

CRA is unmaintained. Vite provides faster HMR, ES module-native dev server, and significantly smaller production bundles. For e-commerce with SEO requirements, Next.js 15 with the App Router (Server Components + ISR) is the standard choice.

### 2.3 Fastify as Express alternative

For API throughput-sensitive services, Fastify provides roughly 2x requests/second versus Express with a near-identical developer surface area. Schema validation is built-in via JSON Schema rather than bolted on.

### 2.4 Node.js 22 LTS

Node.js 22 ships with native `fetch`, a built-in test runner, and improved ESM support. Projects started today should target the current LTS, not Node 14/16.

### 2.5 MongoDB Atlas with connection pooling

Production MongoDB goes through Atlas (managed backups, monitoring, automatic failover). Connection pooling must be configured explicitly:

```js
mongoose.connect(process.env.MONGO_URI, {
  maxPoolSize: 10,        // default is 5
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
});
```

Retry logic on `ECONNRESET` and `MongoNetworkError` is mandatory for resilience.

### 2.6 Docker + CI/CD from day one

Containerization ensures parity between local, staging, and production. CI/CD pipelines (GitHub Actions, GitLab CI) automatically run lint, type-check, tests, and build on every push. Deployment to Railway, Render, or AWS follows without manual steps.

### 2.7 Structured logging and monitoring

Winston for structured JSON logs, Sentry for error tracking, New Relic or Datadog for APM. Health check endpoints (`/health`, `/ready`) are required for load balancers and container orchestrators.

Sources:
- [MERN Stack Production Deployment Checklist](https://navanathjadhav.medium.com/mern-stack-production-deployment-the-complete-checklist-for-going-live-975104e743f4)
- [How to Build Production-Ready Full Stack Apps](https://freecodecamp.org/news/how-to-build-production-ready-full-stack-apps-with-the-mern-stack)
- [Properly Deploy a MERN Application](https://www.baeldung.com/ops/mongodb-express-react-nodejs-app-deploy)

---

## 3. Mongoose Schema Design Best Practices

### 3.1 Embed vs. reference — the decision rule

| Relationship | Strategy | Why |
|---|---|---|
| One-to-few (e.g., order items) | Embed | Single read, atomically updated |
| One-to-many (e.g., user → orders) | Reference | Documents stay bounded, queries stay fast |
| Hybrid (e.g., product with top-3 reviews cached) | Partial embed + reference | Balance read speed with write cost |

Unbounded arrays embedded in a document are a common production failure mode. An order with `items: [...]` is fine; a user document with `allOrderHistory: [...]` grows without bound.

### 3.2 Compound indexes for real query patterns

Every field combination used in a filter or sort in production API endpoints should have a corresponding index. Missing indexes cause full collection scans — invisible in development, catastrophic under load.

```js
// Product listing: filter by category + sort by price
productSchema.index({ category: 1, price: 1 });

// Order history: filter by user + sort by date
orderSchema.index({ user: 1, createdAt: -1 });

// User lookup on login
userSchema.index({ email: 1 }, { unique: true });
```

Rule: index fields used in `filter`, `sort`, and `unique` constraints. Avoid over-indexing — each index consumes RAM and slows writes. Use MongoDB Atlas's Index Advisor or Compass to identify missing indexes from slow query logs.

### 3.3 `lean()` for read-only endpoints

By default, Mongoose returns full document instances with getters, setters, virtuals, and internal metadata. For list endpoints that only need to serialize and return data, `.lean()` returns plain JS objects and is 30–50% faster.

```js
// List endpoint — use lean()
const products = await Product.find({ category }).lean();

// Requires mongoose document (save, virtuals) — skip lean()
const user = await User.findById(id);
await user.save();
```

### 3.4 Virtuals for computed properties

Virtuals are computed on read and not stored in MongoDB. Use them for derived values that would otherwise require storing redundant data:

```js
userSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

orderSchema.virtual('total').get(function () {
  return this.items.reduce((sum, item) => sum + item.price * item.qty, 0);
});
```

Critical caveat: virtuals are not stored, so they cannot be queried or sorted on. If you need to filter by a computed value, store it explicitly and keep it in sync via a `pre('save')` hook.

### 3.5 Hooks for cross-cutting concerns

Pre/post hooks keep business logic out of controllers and apply it uniformly regardless of call site.

```js
// Password hashing — pre('save') only, not findByIdAndUpdate
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

// Soft-delete filter applied to all find operations
productSchema.pre(/^find/, function () {
  this.where({ deletedAt: null });
});
```

**Critical gotcha**: `findByIdAndUpdate()` and `updateOne()` bypass `pre('save')` hooks entirely. They update MongoDB directly. Password change endpoints must use `doc.save()`, not `findByIdAndUpdate`, or the hook will not run and the password is stored in plaintext.

### 3.6 Soft deletes over hard deletes

Mark documents with `deletedAt: Date` rather than removing them. This preserves order history, audit trails, and referential integrity. Apply a `pre(/^find/)` hook to exclude deleted documents automatically.

### 3.7 Pagination — cursor-based for large collections

Offset-based pagination (`skip(n).limit(20)`) is O(n) — MongoDB scans and discards the first n documents. For large catalogs, cursor-based pagination (filtering by `_id > lastSeenId`) is O(log n) after the index lookup.

Sources:
- [Best Practices for Designing Scalable MongoDB Models with Mongoose](https://medium.com/%40babarbilal303/best-practices-for-designing-scalable-mongodb-models-with-mongoose-98972e6624e4)
- [5 Mongoose Performance Mistakes That Slow Your App](https://medium.com/@arunangshudas/5-mongoose-performance-mistakes-that-slow-your-app-e204577b90f5)
- [Mongoose Schemas and Creating a Model In Practice](https://thelinuxcode.com/mongoose-schemas-and-creating-a-model-in-practice-how-i-keep-mongodb-flexible-without-letting-it-drift/)
- [How to Use Mongoose Pre and Post Middleware](https://oneuptime.com/blog/post/2026-03-31-mongodb-mongoose-pre-post-middleware/)

---

## 4. Redux State Management for E-commerce

### 4.1 RTK Query vs. TanStack Query — choose by existing stack

Both solve server-state caching. The decision is architectural:

| Condition | Choice |
|---|---|
| Already using Redux for global state | RTK Query — colocates server and client state |
| No Redux, starting fresh | TanStack Query — smaller bundle, framework-agnostic |
| Next.js SSR-heavy | TanStack Query — better RSC/SSR support |
| Complex admin with OpenAPI spec | RTK Query — code generation from Swagger |

RTK Query bundle is ~40KB (includes Redux Toolkit); TanStack Query is ~16KB standalone. Don't adopt Redux solely for RTK Query.

### 4.2 RTK Query cache invalidation via tags

Tags replace manual refetch logic. When a mutation completes, invalidated tags cause related queries to refetch automatically:

```js
const api = createApi({
  tagTypes: ['Product', 'Order', 'Cart'],
  endpoints: (build) => ({
    getProducts: build.query({
      providesTags: ['Product'],
    }),
    createProduct: build.mutation({
      invalidatesTags: ['Product'],  // triggers product list refetch
    }),
  }),
});
```

### 4.3 Optimistic updates for cart interactions

Cart add/remove should feel instant. RTK Query's `onQueryStarted` lifecycle enables optimistic updates with automatic rollback on failure:

```js
addToCart: build.mutation({
  async onQueryStarted(arg, { dispatch, queryFulfilled }) {
    const patch = dispatch(
      cartApi.util.updateQueryData('getCart', undefined, (draft) => {
        draft.items.push(arg);
      })
    );
    try {
      await queryFulfilled;
    } catch {
      patch.undo();  // rolls back if server rejects
    }
  },
}),
```

### 4.4 Normalized state with `createEntityAdapter`

For product catalogs and order lists, `createEntityAdapter` provides CRUD operations and memoized selectors without hand-writing lookup logic:

```js
const productsAdapter = createEntityAdapter();
const initialState = productsAdapter.getInitialState();

// Selectors auto-generated:
const { selectAll, selectById, selectTotal } = productsAdapter.getSelectors(
  (state) => state.products
);
```

### 4.5 Separate server state from client state

A common Redux mistake is putting everything in the store: fetched data (server state), UI toggles (client state), and form state. In 2026, the pattern is:

- **Server state** (products, orders, user profile): RTK Query or TanStack Query cache
- **Client/UI state** (modal open, selected tab, cart drawer): Redux slice or Zustand
- **Form state**: React Hook Form (not Redux)

### 4.6 Classic Redux is not wrong, just verbose

For the `proshop_mern` codebase, the classic Redux pattern (action creators, reducers, thunks) works correctly — it is just boilerplate-heavy compared to RTK. The mental model is identical; RTK automates the repetitive parts.

Sources:
- [Redux Essentials Part 8: RTK Query Advanced Patterns](http://redux.js.org/tutorials/essentials/part-8-rtk-query-advanced)
- [Manual Cache Updates — Optimistic Updates](https://redux-toolkit.js.org/rtk-query/usage/optimistic-updates)
- [Modern Redux with Redux Toolkit & RTK Query in 2025](https://rishikc.com/articles/modern-redux-toolkit-rtk-query-2025/)
- [TanStack Query v5 vs SWR v3 vs RTK Query 2026](https://www.pkgpulse.com/blog/tanstack-query-v5-vs-swr-v3-vs-rtk-query-data-fetching-2026)
- [TanStack Query vs Redux Toolkit Query in 2025](https://medium.com/@alifazmiruddin/tanstack-query-vs-redux-toolkit-query-in-2025-which-should-you-choose-7e2f18d1f709)

---

## 5. PayPal Integration Patterns 2026

### 5.1 Webhook-driven payment confirmation

Never confirm an order based solely on the client-side PayPal callback. The browser is untrusted. The canonical 2026 pattern:

1. Client initiates PayPal order (creates order on server → gets PayPal order ID)
2. User completes payment in PayPal UI
3. Client calls your API: `POST /orders/:id/pay` with PayPal order ID
4. Server captures payment via PayPal REST API → confirms amount
5. **Additionally**: PayPal sends `PAYMENT.CAPTURE.COMPLETED` webhook → second confirmation path

Webhook is the authoritative confirmation. The synchronous capture call is for immediate UX response.

### 5.2 Idempotency keys — `PayPal-Request-Id`

Every PayPal REST API `POST` call should include a `PayPal-Request-Id` header with a UUID unique to that operation. This prevents double charges on network retries:

```js
const { v4: uuidv4 } = require('uuid');

await paypalClient.execute(captureRequest, {
  headers: {
    'PayPal-Request-Id': `order-${orderId}-capture`,  // stable, idempotent
    'Prefer': 'return=representation',
  }
});
```

Using `order-${orderId}-capture` as the key (not a random UUID per attempt) ensures that a second call for the same order returns the first result rather than issuing a new charge.

### 5.3 Webhook signature verification

PayPal signs webhook payloads with RSA-SHA256. Verify on the raw body before processing:

```js
app.post('/webhooks/paypal', express.raw({ type: 'application/json' }), async (req, res) => {
  const isValid = await verifyPayPalSignature(req.headers, req.body, process.env.PAYPAL_WEBHOOK_ID);
  if (!isValid) return res.status(401).send('Invalid signature');

  // Acknowledge immediately, then process async
  res.status(200).send('OK');
  processPayPalEvent(JSON.parse(req.body));
});
```

Always parse the body _after_ verification. Body parsers (JSON middleware) consume the raw buffer needed for signature validation.

### 5.4 Idempotent webhook handlers

PayPal retries failed webhook deliveries up to 25 times over 3 days. Your handler must be idempotent — processing the same event twice must have the same result as processing it once:

```js
async function processPayPalEvent(event) {
  const exists = await ProcessedEvent.findOne({ eventId: event.id });
  if (exists) return;  // already handled

  await handleEvent(event);
  await ProcessedEvent.create({ eventId: event.id, processedAt: new Date() });
}
```

Use a `ProcessedEvent` collection with a unique index on `eventId`, or Redis with TTL. Do not use `find + insert` — use `upsert` or atomic operations to prevent race conditions.

### 5.5 Sandbox/live environment separation

Register distinct sandbox and live webhook listeners. Never mix credentials. Use environment variables: `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_MODE=sandbox|live`. The PayPal sandbox is reliable for manual testing; use the webhook simulator in the Developer Dashboard for event replay.

### 5.6 Double-charge prevention at the order level

In addition to idempotency keys, add a database-level guard: an order can only transition to `paid` state once. Implement with a Mongoose `enum` status field and an `updateOne` with a query filter:

```js
const result = await Order.updateOne(
  { _id: orderId, isPaid: false },  // guard: only update unpaid orders
  { $set: { isPaid: true, paidAt: new Date(), paymentResult: captureData } }
);
if (result.modifiedCount === 0) {
  // Order was already paid — idempotent no-op
}
```

Sources:
- [Guide to PayPal Webhooks Features and Best Practices](https://hookdeck.com/webhooks/platforms/guide-to-paypal-webhooks-features-and-best-practices)
- [PayPal Webhooks Guide: Secure Verification & Listener Setup](https://www.hooklistener.com/learn/paypal-webhooks-guide)
- [PayPal Idempotency — Official Docs](https://developer.paypal.com/reference/guidelines/idempotency/)
- [Node.js Webhooks: Idempotency Patterns That Save You](https://medium.com/@Quaxel/node-js-webhooks-idempotency-patterns-that-save-you-769ae4bb4ebc)

---

## 6. JWT Security Best Practices

### 6.1 Never store tokens in localStorage

`localStorage` is accessible to any JavaScript running on the page, including injected code from XSS. A single compromised npm dependency can exfiltrate every token in `localStorage`. This is not a theoretical risk.

The 2026 consensus:

| Storage | XSS Protection | CSRF Protection | Verdict |
|---|---|---|---|
| `localStorage` | None | Inherent | **Avoid** |
| `httpOnly` cookie | High | Requires `SameSite` | **Recommended** |
| In-memory (React state) | High | Inherent | Good for access tokens |

### 6.2 Short-lived access tokens + refresh token rotation

Access tokens expire in 15 minutes. Refresh tokens last 7–30 days but are opaque (random strings stored server-side), not JWTs.

```js
// Access token — short-lived, stateless
const accessToken = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
  expiresIn: '15m',
  algorithm: 'HS256',
});

// Refresh token — long-lived, stored in DB, issued in httpOnly cookie
res.cookie('refreshToken', newRefreshToken, {
  httpOnly: true,
  secure: true,           // HTTPS only
  sameSite: 'Strict',
  path: '/api/auth/refresh',  // scoped to refresh endpoint only
  maxAge: 7 * 24 * 60 * 60 * 1000,  // 7 days
});
```

On each refresh: issue a new access token AND a new refresh token, revoke the old refresh token. If a refresh token is used twice (reuse detection), revoke the entire session family — this catches token theft.

### 6.3 Refresh token rotation (RTR) — detecting theft

Store refresh tokens in a `RefreshToken` collection with `{ token, userId, used: false, expiresAt }`. On use:

1. Find token by value. If not found → reject.
2. If `used: true` → **revoke all sessions for this user** (token reuse = theft signal).
3. Mark old token `used: true`, issue new token.

### 6.4 CSRF protection with `SameSite` cookies

`httpOnly` cookies are immune to XSS but vulnerable to CSRF. Use `SameSite=Strict` (or `Lax` for OAuth flows) to prevent the browser from sending cookies on cross-site requests. For state-changing API calls, add a CSRF token header (double-submit cookie pattern) if `SameSite=Strict` is insufficient for your use case.

### 6.5 Content Security Policy (CSP)

CSP is the second layer of XSS defense, limiting what scripts can execute. Set via HTTP headers, not meta tags (meta tags can be bypassed by injected content):

```
Content-Security-Policy: default-src 'self'; script-src 'self'; connect-src 'self' https://api.paypal.com
```

### 6.6 Rate limiting on auth endpoints

Login, register, and token refresh endpoints must be rate-limited (e.g., express-rate-limit). Without rate limiting, brute force and credential stuffing attacks are trivial.

### 6.7 Algorithm lockdown

Explicitly specify the expected algorithm when verifying tokens. The `alg: none` vulnerability (JWT with no signature accepted) was fixed in modern libraries but requires explicit configuration:

```js
jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
```

Sources:
- [JWT Security Best Practices for 2025](https://jwt.app/blog/jwt-best-practices)
- [JWT Best Practices: Security Tips for 2026](https://jsmanifest.com/jwt-security-best-practices-2026)
- [JWT Authentication: Security Best Practices in 2026](https://ecosire.com/blog/jwt-authentication-best-practices)
- [Secure JWT Authentication: Refresh Token Rotation and HttpOnly Cookies](https://blogdeveloperspot.blogspot.com/2026/03/secure-jwt-authentication-refresh-token.html)
- [JWT Security Best Practices: Complete Guide for 2026](https://nyx-development.uk/dev-tools/blog/jwt-security/)

---

## 7. E-commerce Performance

### 7.1 Core Web Vitals targets (2026)

Google's ranking algorithm uses field data at the 75th percentile over 28 days. Only 39% of e-commerce sites pass all three metrics simultaneously:

| Metric | Good | Needs Improvement | Poor |
|---|---|---|---|
| LCP (Largest Contentful Paint) | ≤ 2.5s | 2.5–4.0s | > 4.0s |
| INP (Interaction to Next Paint) | ≤ 200ms | 200–500ms | > 500ms |
| CLS (Cumulative Layout Shift) | ≤ 0.1 | 0.1–0.25 | > 0.25 |

Business impact: every 0.1s of LCP improvement increases conversions by ~8% in retail (Google/Deloitte). A 1s improvement on a mid-size store can add thousands in monthly revenue.

### 7.2 Performance budgets

Set budgets as hard limits in CI:

| Asset | Target |
|---|---|
| Total JavaScript (compressed) | < 300 KB |
| Total CSS (compressed) | < 80 KB |
| Hero image | < 200 KB |
| Total page weight | < 1.5 MB (mobile) |
| Third-party scripts | ≤ 5 |
| TTFB (Time to First Byte) | < 200ms |
| LCP internal target | < 2.0s (buffer below 2.5s) |

### 7.3 Image optimization pipeline

Unoptimized product images are the #1 performance failure in e-commerce:

- Serve **WebP** (30–40% smaller than JPEG) with AVIF as next-gen option
- Use a CDN (Cloudinary, Imgix, or Cloudflare Images) for on-the-fly format conversion, resizing, and compression
- `loading="lazy"` on all below-fold images; `fetchpriority="high"` on the LCP hero image
- Set explicit `width` and `height` to prevent Cumulative Layout Shift
- Never lazy-load the largest image in the first viewport

```html
<!-- Hero image — above fold, prioritize -->
<img src="/hero.webp" fetchpriority="high" width="1200" height="600" alt="..." />

<!-- Product thumbnails — below fold, lazy load -->
<img src="/product-42.webp" loading="lazy" width="300" height="300" alt="..." />
```

### 7.4 Code splitting with `React.lazy`

Split the bundle by route so users download only what they need for the current page:

```js
const AdminDashboard = React.lazy(() => import('./pages/AdminDashboard'));
const ProductDetail = React.lazy(() => import('./pages/ProductDetail'));
```

Heavy components (carousels, rich text editors, chart libraries) should be lazy-loaded even within a page.

### 7.5 Server response time — TTFB under 200ms

LCP cannot be faster than TTFB. A slow server makes every frontend optimization irrelevant. Key levers:

- CDN with edge caching for product pages (ISR with 60s revalidation)
- Database query optimization (compound indexes, lean(), projections)
- Connection pooling for MongoDB
- Response compression (gzip/brotli via Express `compression` middleware)

### 7.6 Virtualize long lists

A product listing with 500 items in the DOM is a browser performance disaster. Use `react-window` or `@tanstack/react-virtual` to render only the visible rows.

Sources:
- [Core Web Vitals for E-commerce in 2026](https://ecomdesignpro.com/core-web-vitals-ecommerce/)
- [Core Web Vitals 2026: INP, LCP & CLS Optimization](https://www.digitalapplied.com/blog/core-web-vitals-2026-inp-lcp-cls-optimization-guide)
- [How to optimize images in React for better web performance](https://blog.logrocket.com/optimize-images-in-react/)
- [React Performance Optimization: 15 Best Practices for 2025](https://dev.to/alex_bobes/react-performance-optimization-15-best-practices-for-2025-17l9)
- [Lazy Loading + Image CDN — Cut Initial Page Load by 50–70%](https://theimagecdn.com/docs/lazy-loading-image-cdn)
- [Core Web Vitals for Ecommerce: Complete Guide 2026](https://ighenatt.es/en/resources/core-web-vitals/core-web-vitals-ecommerce/)

---

## 8. Feature Flags and Rollout Strategies

### 8.1 Decouple deployment from release

The core principle: code reaches production before users see it. A feature flag controls visibility independently of the deployment. This makes every deploy a non-event — you can ship code on Friday and flip the flag on Tuesday after monitoring.

### 8.2 OpenFeature — vendor-neutral standard

In 2026, [OpenFeature](https://openfeature.dev) (CNCF project) is the open standard for feature flag evaluation. It provides a vendor-agnostic SDK that works with LaunchDarkly, Unleash, Flagsmith, or a self-hosted provider:

```js
const { OpenFeature } = require('@openfeature/server-sdk');

await OpenFeature.setProviderAndWait(new YourProvider());
const client = OpenFeature.getClient();

const newCheckoutEnabled = await client.getBooleanValue(
  'new-checkout-flow',
  false,  // default if flag unavailable
  { targetingKey: req.user.id }
);
```

### 8.3 Progressive rollout — canary pattern

```
Day 1: Internal team only (0.1%)
Day 3: 1% of users
Day 5: 10% — monitor error rates and conversion
Day 7: 50%
Day 9: 100%
```

Each stage gates on observability metrics. If error rates spike at 10%, flip the flag off — no redeployment needed.

### 8.4 Blue-green vs. canary — choosing the strategy

| Strategy | Downtime | Rollback Speed | Best For |
|---|---|---|---|
| Blue-Green | None | Instant (flip load balancer) | High-stakes schema changes, major rewrites |
| Canary | None | Fast (reduce canary weight to 0) | New features, algorithm changes |
| Feature Flags | None | Instant (toggle flag) | UI changes, business logic, A/B tests |

Feature flags operate at the application layer (user-level targeting). Blue-green and canary operate at the infrastructure layer (traffic routing). Use them together.

### 8.5 Kill switches

Every significant new feature ships with a kill switch flag: a boolean that defaults to `false` (new feature off). If the feature causes incidents, flip the flag from any admin UI without touching code or infrastructure.

### 8.6 Flag lifecycle management

Flags have four states: `created → active → rolled-out → archived`. Flags that have been at 100% for 30+ days should be archived and the conditional code removed. Flag debt (stale flags) accumulates fast in active codebases.

### 8.7 Backend A/B testing

Feature flags enable backend experiments: route 50% of users to Algorithm A, 50% to Algorithm B, measure conversion rate difference. This works for search ranking, recommendation engines, pricing logic, and checkout flows.

Sources:
- [Feature Flags in Node.js with OpenFeature 2026](https://1xapi.com/blog/feature-flags-nodejs-openfeature-2026-guide)
- [Node.js Canary Deploys with Feature Flags: Safe Releases at Scale](https://medium.com/@kaushalsinh73/node-js-canary-deploys-with-feature-flags-safe-releases-at-scale-f1d743f33e7b)
- [Release Engineering Playbook: Blue/Green, Canary, and Feature Rollouts](https://certvanta.com/blog/2025/08/release_engineering_playbook_blue_green_canary_rollouts)
- [Ship Faster, Safer: A Guide to Feature Flags for Canary Releases & A/B Testing](https://www.meerako.com/blogs/feature-flags-guide-canary-release-ab-testing-launchdarkly)
- [Feature Flagging Strategies for Continuous Deployment](https://dev.to/yash_pritwani_07a77613fd6/feature-flagging-strategies-for-continuous-deployment-ship-daily-without-breaking-anything-43ci)

---

## 9. Admin Dashboard Patterns

### 9.1 Role-Based Access Control (RBAC)

RBAC assigns permissions to roles, not directly to users. A user has one or more roles; roles have sets of permissions. This scales: adding a new role doesn't require code changes, only a database record.

Minimal role set for e-commerce:
- `customer` — read own orders, update own profile
- `support` — read all orders, update order status (no delete)
- `product_manager` — CRUD products and categories
- `admin` — all of the above + user management, financial data

```js
// Middleware: check permission, not role
function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user.permissions.includes(permission)) {
      logAuthorizationFailure(req, permission);  // always log failures
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

router.delete('/products/:id', requirePermission('products:delete'), deleteProduct);
```

### 9.2 Permissions in the database, not the codebase

Hard-coded role checks (`if (user.role === 'admin')`) scattered across routes are unmaintainable. Store permissions in MongoDB, load on authentication, cache in the JWT claims or session:

```
Role document: { name: 'support', permissions: ['orders:read', 'orders:update_status'] }
User document: { roles: ['support'] }
```

When a role's permissions change, the next login picks up the new set without redeployment.

### 9.3 Immutable audit log

Every admin action (product created/updated/deleted, order status changed, refund issued, user role modified) must be logged. The audit log is write-only — no update or delete API:

```js
const auditLogSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, index: true },
  action:    { type: String, required: true },
  resource:  { type: String, required: true },
  resourceId: { type: mongoose.Schema.Types.ObjectId },
  before:    { type: Object },  // state before change
  after:     { type: Object },  // state after change
  ipAddress: { type: String },
  userAgent: { type: String },
  createdAt: { type: Date, default: Date.now, immutable: true },
}, { versionKey: false });

// Compound index for common queries: user activity + time
auditLogSchema.index({ userId: 1, createdAt: -1 });
// TTL index for retention (e.g., 2 years)
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 63072000 });
```

`immutable: true` on `createdAt` prevents updates at the Mongoose level. Expose only `create` and `read` APIs — no `update` or `delete`.

### 9.4 Bulk operations — safety patterns

Admin bulk actions (delete 500 products, mark 200 orders as shipped) need:

1. **Preview step**: show count and sample before executing
2. **Confirmation dialog**: explicit user acknowledgment
3. **Batch processing**: execute in chunks (e.g., 100 at a time) to avoid timeout and memory pressure
4. **Audit logging**: log the bulk action with filter criteria and count, not individual records
5. **Undo within time window**: soft delete + 30-second undo window before hard commit

### 9.5 Authorization failure logging

Every 403 response should be logged with user ID, role, attempted endpoint, and timestamp. Patterns of authorization failures indicate misconfiguration, bugs, or probing attacks.

### 9.6 Server-side permission checks are mandatory

Client-side role checks (hiding buttons, disabling routes) are UX improvements, not security. The API must enforce permissions on every request regardless of what the UI shows. Never trust client-supplied role claims in request bodies.

Sources:
- [How to Implement Role-Based Access Control in Node.js and Express](https://www.boxsoftware.net/how-to-implement-role-based-access-control-in-node-js-and-express/)
- [How to Implement RBAC in an Express.js Application](https://permit.io/blog/how-to-implement-rbac-in-an-expressjs-application)
- [How to Build Secure Audit Logging in Node.js](https://www.sevensquaretech.com/secure-audit-logging-activity-trail-nodejs-with-code/)
- [How to Model an Event Logging System in MongoDB](https://oneuptime.com/blog/post/2026-03-31-mongodb-how-to-model-an-event-logging-system-in-mongodb/)
- [Audit Logging Looked Like a Weekend Project. It Took Us 3 Months.](https://dev.to/robertatkinson3570/audit-logging-looked-like-a-weekend-project-it-took-us-3-months-509o)

---

## 10. Concrete Patterns to Apply to proshop_mern

These are guidance-level TODOs — what an engineering team would do when migrating this codebase to 2026 production standards. They are not a refactoring task; they are a learning exercise in reading a codebase and identifying gaps.

### Authentication & JWT

- [ ] **Move JWT from `localStorage` to `httpOnly` cookie**: change `localStorage.setItem('userInfo', ...)` in Redux auth slice to receive a `Set-Cookie` header. Add `credentials: 'include'` to all fetch calls.
- [ ] **Add refresh token endpoint**: store refresh tokens in a `RefreshToken` MongoDB collection. Add `POST /api/auth/refresh` route. Set refresh token cookie with `path: '/api/auth/refresh'` to scope it.
- [ ] **Add refresh token rotation**: on each refresh, mark old token used, detect reuse, revoke session family on reuse detection.
- [ ] **Rate-limit auth routes**: add `express-rate-limit` to `/api/users/login` and `/api/auth/refresh` (e.g., 10 attempts per 15 minutes per IP).
- [ ] **Lock JWT algorithm**: add `{ algorithms: ['HS256'] }` to all `jwt.verify()` calls.

### Mongoose / Database

- [ ] **Add compound indexes**: `Product.index({ category: 1, price: 1 })`, `Order.index({ user: 1, createdAt: -1 })`, `User.index({ email: 1 }, { unique: true })`.
- [ ] **Add `.lean()` to list endpoints**: all `GET /api/products` and `GET /api/orders` (admin) routes that just serialize and return data.
- [ ] **Verify password hashing hook**: confirm the `pre('save')` hook runs on password updates. If any controller uses `findByIdAndUpdate` for password changes, switch to `doc.save()`.
- [ ] **Add soft delete to products**: add `deletedAt: Date` field, `pre(/^find/)` filter hook, and change `router.delete` to set `deletedAt` rather than remove.
- [ ] **Migrate from offset to cursor pagination**: replace `skip(pageNumber * pageSize).limit(pageSize)` with filter-based pagination for the product catalog.

### PayPal Integration

- [ ] **Add PayPal-Request-Id header**: generate `order-${orderId}-capture` as the idempotency key for every capture call.
- [ ] **Add webhook endpoint**: register `POST /api/webhooks/paypal` with `express.raw()` middleware (before JSON middleware parses the body). Verify signature, acknowledge with 200, process async.
- [ ] **Add ProcessedEvent deduplication**: store processed PayPal event IDs in a `ProcessedEvents` collection with unique index on `eventId`.
- [ ] **Guard payment state at DB level**: change the pay route to use `Order.updateOne({ _id: id, isPaid: false }, ...)` and check `modifiedCount === 0` as a double-charge guard.

### Frontend Performance

- [ ] **Replace CRA with Vite**: migrate build tool. This is a significant but well-documented migration path (see [vitejs.dev/guide/migration](https://vitejs.dev/guide/migration)).
- [ ] **Add route-based code splitting**: wrap `<AdminScreen>`, `<ProfileScreen>`, `<OrderScreen>` in `React.lazy()` and `<Suspense>`.
- [ ] **Optimize product images**: serve WebP from an image CDN (Cloudinary free tier works). Add `loading="lazy"` to all product card `<img>` tags. Set explicit `width` and `height`.
- [ ] **Add response compression**: add `compression` middleware to Express server.

### State Management

- [ ] **Annotate Redux slices as RTK candidates**: identify which slices are pure server state (products, orders, user) vs. client state (cart UI, modal). Server state slices are candidates for RTK Query migration.
- [ ] **Add optimistic cart updates**: implement `onQueryStarted` with rollback for add-to-cart mutation if migrating to RTK Query.

### Admin / RBAC

- [ ] **Replace `isAdmin` boolean with role array**: change `User.isAdmin` to `User.roles: ['admin']` and add a `permissions` resolver. Update auth middleware accordingly.
- [ ] **Add audit log collection**: create `AuditLog` Mongoose model with `immutable: true` on `createdAt`. Log all admin mutations (product create/update/delete, order status change).
- [ ] **Add permission middleware factory**: replace inline `if (!req.user.isAdmin)` checks with `requirePermission('products:delete')` middleware.
- [ ] **Add bulk action safety UI**: confirm dialogs + preview count before executing bulk order updates.

### Reliability

- [ ] **Add health check endpoint**: `GET /health` returns `{ status: 'ok', db: 'connected' }`. Required for load balancers and container orchestrators.
- [ ] **Add graceful shutdown**: handle `SIGTERM` to close MongoDB connection and drain in-flight requests before exiting.
- [ ] **Add structured logging**: replace `console.log` with Winston. Log level, timestamp, request ID, and error stack in JSON.

---

## References

All sources are publicly available. Retrieved April 2026.

### MERN Production Patterns
1. https://medium.com/@lomcos/how-to-build-a-production-ready-mern-stack-app-in-2026-cc5dc9d8bd81
2. https://dev.to/krunal_groovy/the-production-mern-stack-guide-for-2026-not-another-todo-app-4n31
3. https://www.baeldung.com/ops/mongodb-express-react-nodejs-app-deploy
4. https://navanathjadhav.medium.com/mern-stack-production-deployment-the-complete-checklist-for-going-live-975104e743f4
5. https://freecodecamp.org/news/how-to-build-production-ready-full-stack-apps-with-the-mern-stack
6. https://www.technetexperts.com/mern-nextjs-ecommerce-architecture/

### Mongoose Schema Design
7. https://medium.com/%40babarbilal303/best-practices-for-designing-scalable-mongodb-models-with-mongoose-98972e6624e4
8. https://dev.to/babar_bilal_2e14c231dfa8d/best-practices-for-designing-scalable-mongodb-models-with-mongoose-10nm
9. https://medium.com/@arunangshudas/5-mongoose-performance-mistakes-that-slow-your-app-e204577b90f5
10. https://moldstud.com/articles/p-optimizing-mongoose-schema-design-for-performance
11. https://thelinuxcode.com/mongoose-schemas-and-creating-a-model-in-practice-how-i-keep-mongodb-flexible-without-letting-it-drift/
12. https://oneuptime.com/blog/post/2026-03-31-mongodb-mongoose-pre-post-middleware/view
13. https://www.stacklesson.com/mern-stack-tutorial/mern-mongoose-schemas/ch12-lesson-04-mongoose-middleware-pre-post-hooks/

### Redux / State Management
14. http://redux.js.org/tutorials/essentials/part-8-rtk-query-advanced
15. https://redux-toolkit.js.org/rtk-query/usage/optimistic-updates
16. https://rishikc.com/articles/modern-redux-toolkit-rtk-query-2025/
17. https://www.pkgpulse.com/blog/tanstack-query-v5-vs-swr-v3-vs-rtk-query-data-fetching-2026
18. https://medium.com/@alifazmiruddin/tanstack-query-vs-redux-toolkit-query-in-2025-which-should-you-choose-7e2f18d1f709
19. https://beta.refine.dev/blog/rtk-query-redux-toolkit-2025/

### PayPal Integration
20. https://hookdeck.com/webhooks/platforms/guide-to-paypal-webhooks-features-and-best-practices
21. https://medium.com/@Quaxel/node-js-webhooks-idempotency-patterns-that-save-you-769ae4bb4ebc
22. https://developer.paypal.com/reference/guidelines/idempotency/
23. https://developer.paypal.com/docs/platforms/develop/idempotency/
24. https://www.hooklistener.com/learn/paypal-webhooks-guide

### JWT Security
25. https://jwt.app/blog/jwt-best-practices
26. https://blogdeveloperspot.blogspot.com/2026/03/secure-jwt-authentication-refresh-token.html
27. https://jsmanifest.com/jwt-security-best-practices-2026
28. https://ecosire.com/blog/jwt-authentication-best-practices
29. https://nyx-development.uk/dev-tools/blog/jwt-security/

### Performance
30. https://dev.to/seyedahmaddv/how-i-achieved-a-95-lighthouse-performance-score-in-a-nextjs-e-commerce-site-and-how-you-can-2pe5
31. https://dev.to/alex_bobes/react-performance-optimization-15-best-practices-for-2025-17l9
32. https://blog.logrocket.com/optimize-images-in-react/
33. https://theimagecdn.com/docs/lazy-loading-image-cdn
34. https://ecomdesignpro.com/core-web-vitals-ecommerce/
35. https://ighenatt.es/en/resources/core-web-vitals/core-web-vitals-ecommerce/
36. https://www.digitalapplied.com/blog/core-web-vitals-2026-inp-lcp-cls-optimization-guide

### Feature Flags
37. https://1xapi.com/blog/feature-flags-nodejs-openfeature-2026-guide
38. https://medium.com/@kaushalsinh73/node-js-canary-deploys-with-feature-flags-safe-releases-at-scale-f1d743f33e7b
39. https://certvanta.com/blog/2025/08/release_engineering_playbook_blue_green_canary_rollouts
40. https://www.meerako.com/blogs/feature-flags-guide-canary-release-ab-testing-launchdarkly
41. https://dev.to/yash_pritwani_07a77613fd6/feature-flagging-strategies-for-continuous-deployment-ship-daily-without-breaking-anything-43ci

### Admin / RBAC / Audit Logging
42. https://www.boxsoftware.net/how-to-implement-role-based-access-control-in-node-js-and-express/
43. https://permit.io/blog/how-to-implement-rbac-in-an-expressjs-application
44. https://www.sevensquaretech.com/secure-audit-logging-activity-trail-nodejs-with-code/
45. https://oneuptime.com/blog/post/2026-03-31-mongodb-how-to-model-an-event-logging-system-in-mongodb/
46. https://dev.to/robertatkinson3570/audit-logging-looked-like-a-weekend-project-it-took-us-3-months-509o
47. https://github.com/thihaswe/rbac-expressjs-starter
