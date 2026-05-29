# Feature Flags Specification — ProShop MERN

> This document is the authoritative reference for the `features.json` file and the MCP server that manages it. Read it before implementing any part of the homework assignment.

---

## 1. Introduction

### What Are Feature Flags?

A **feature flag** (also called a feature toggle, feature switch, or feature gate) is a software engineering technique that lets you turn functionality on or off without deploying new code. Instead of shipping a feature to all users at once, you ship the code behind a conditional check, then control visibility through a configuration file — in this project, `features.json`.

Feature flags solve a core tension in software delivery: teams want to ship code frequently (to avoid merge conflicts and integration hell), but they also want to protect end users from half-finished or risky changes. The flag is the mechanism that decouples **code deployment** from **feature release**.

### Why Do Feature Flags Matter in Production Systems?

Consider the following real-world scenarios that feature flags handle elegantly:

**Gradual rollout (Canary Deployment).** You have a redesigned checkout flow. You do not want to expose 100% of your traffic to a change that might have edge-case bugs. Instead, you enable it for 5% of users, monitor error rates and conversion metrics, then expand to 25%, 50%, and finally 100% if no regressions appear. If something breaks, you turn the flag off — no rollback deploy required.

**A/B Testing.** You want to know whether a single-page cart or a multi-step cart produces higher average order value. You split traffic 50/50 with `status: "Testing"` and `traffic_percentage: 50`, instrument your analytics events, run for two weeks, and pick the winner. The loser gets disabled; the winner gets promoted to Enabled.

**Kill Switch.** An external payment provider has a service outage. You disable `stripe_alternative` in seconds, routing all traffic back to PayPal. No code changes, no redeployment.

**Beta and Internal Testing.** A new admin dashboard is not ready for public users, but you want your QA team and internal stakeholders to use it. You set `status: "Testing"`, `traffic_percentage: 100`, and `targeted_segments: ["admin", "internal"]`.

### Feature Flags in This Project

The ProShop MERN codebase is a teaching project: a full-stack e-commerce application built with MongoDB, Express, React, and Node.js. It contains a product catalog, shopping cart, multi-step checkout, PayPal payment integration, user authentication, admin panel, and product review system.

The `features.json` file in this project defines 25 feature flags covering the full surface area of the application. Your MCP server reads this file and exposes three tools that allow an AI assistant to query and modify flags in real time — simulating how a product engineer or engineering manager would operate feature flags during a rollout.

---

## 2. The `features.json` Format

The file contains a single top-level JSON object. Each key is a **feature ID** in `snake_case`. Each value is a **feature object** with the following fields.

### Required Fields

| Field | Type | Description |
|---|---|---|
| `name` | string | Human-readable display name of the feature. Used in UI and logs. |
| `description` | string | Detailed explanation of what the feature does, which parts of the system it affects, and why it exists. Written for discoverability — this is the text a RAG system would search against. |
| `status` | string | One of: `"Disabled"`, `"Testing"`, `"Enabled"`. See status semantics below. |
| `traffic_percentage` | number | Integer 0–100. Percentage of eligible requests or sessions that will have this feature active. Meaningful only when `status` is `"Testing"`. When `"Enabled"`, should be `100`. When `"Disabled"`, should be `0`. |
| `last_modified` | string | ISO 8601 date (`YYYY-MM-DD`) of the most recent change to any field in this record. Your MCP server must update this field on every write. |

### Optional Fields

| Field | Type | Description |
|---|---|---|
| `targeted_segments` | array of strings | User segments that this flag applies to. Examples: `"beta_users"`, `"admin"`, `"guests"`, `"authenticated"`, `"mobile"`, `"internal"`, `"safari_users"`, `"all"`. If omitted, the flag applies to all traffic. |
| `rollout_strategy` | string | One of: `"canary"`, `"ab_test"`, `"full_release"`. Documents the intended rollout pattern for this flag. |
| `dependencies` | array of strings | Feature IDs that must be `"Enabled"` before this flag can be meaningfully activated. Your MCP server should warn (but not block) when a flag is set to `"Testing"` or `"Enabled"` while its dependencies are `"Disabled"`. |

### Status Semantics

**`"Disabled"`** — The feature is completely off. No traffic receives it. `traffic_percentage` must be `0`. This is the safe default for any new flag. Use this state for features in early development, features that have been rolled back, or permanently retired flags awaiting cleanup.

**`"Testing"`** — The feature is active for a controlled subset of traffic defined by `traffic_percentage` and optionally `targeted_segments`. This is the state during canary deployments and A/B tests. `traffic_percentage` can be any value from 1 to 99. A flag in `"Testing"` at 100% is valid but typically short-lived — it means you are doing a final soak before promoting to `"Enabled"`.

**`"Enabled"`** — The feature is fully live for all eligible traffic. `traffic_percentage` is `100`. This is the steady-state for launched features. Once a flag reaches this state, schedule it for cleanup: the conditional logic should be removed from code within the next release cycle.

### Example Feature Object

```json
{
  "search_v2": {
    "name": "New Search Algorithm",
    "description": "Replaces legacy regex-based keyword matching with a hybrid BM25 + TF-IDF ranking pipeline. Improves relevance for multi-word queries and handles common misspellings via fuzzy matching.",
    "status": "Testing",
    "traffic_percentage": 15,
    "last_modified": "2026-03-10",
    "targeted_segments": ["beta_users", "internal"],
    "rollout_strategy": "canary"
  }
}
```

---

## 3. MCP Server Tool Contract

Your MCP server must implement exactly **three tools**. The server reads `features.json` on every read call and writes it atomically (write to a temp file, then rename) on every write call to prevent data corruption.

---

### Tool 1: `get_feature_info`

**Purpose:** Retrieve the complete current state of a single feature flag.

**Signature:**
```
get_feature_info(feature_id: string) -> FeatureObject | ErrorObject
```

**Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `feature_id` | string | Yes | The `snake_case` key of the feature in `features.json`, e.g. `"search_v2"`. |

**Return value on success:**

Returns the full feature object with all fields, plus the `feature_id` echoed back for convenience:

```json
{
  "feature_id": "search_v2",
  "name": "New Search Algorithm",
  "description": "Replaces legacy regex-based keyword matching...",
  "status": "Testing",
  "traffic_percentage": 15,
  "last_modified": "2026-03-10",
  "targeted_segments": ["beta_users", "internal"],
  "rollout_strategy": "canary"
}
```

**Return value on error:**

```json
{
  "error": "FEATURE_NOT_FOUND",
  "message": "No feature with ID 'search_v3' exists in features.json.",
  "feature_id": "search_v3"
}
```

**Error conditions:**

| Error code | Trigger |
|---|---|
| `FEATURE_NOT_FOUND` | `feature_id` does not exist as a key in `features.json`. |
| `FILE_READ_ERROR` | `features.json` cannot be read (permissions, missing file). |
| `JSON_PARSE_ERROR` | `features.json` exists but contains invalid JSON. |

**Example call from an AI assistant:**

> "What is the current status of the dark mode feature?"

The assistant calls:
```json
{ "tool": "get_feature_info", "arguments": { "feature_id": "dark_mode" } }
```

The server returns the full object, and the assistant answers: "Dark mode is currently in Testing at 20% traffic, targeting all users."

---

### Tool 2: `set_feature_state`

**Purpose:** Change the `status` of a feature flag. Automatically adjusts `traffic_percentage` to the canonical value for the new state and updates `last_modified`.

**Signature:**
```
set_feature_state(feature_id: string, state: "Disabled" | "Testing" | "Enabled") -> FeatureObject | ErrorObject
```

**Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `feature_id` | string | Yes | The `snake_case` key of the target feature. |
| `state` | string | Yes | Must be exactly one of: `"Disabled"`, `"Testing"`, `"Enabled"` (case-sensitive). |

**Side effects:**

- When transitioning to `"Disabled"`: sets `traffic_percentage` to `0`.
- When transitioning to `"Enabled"`: sets `traffic_percentage` to `100`.
- When transitioning to `"Testing"`: leaves `traffic_percentage` unchanged if it is already in 1–99 range; otherwise sets it to `10` as a safe default starting point.
- Always updates `last_modified` to today's date (`YYYY-MM-DD`).
- If the feature has `dependencies` and the new state is `"Testing"` or `"Enabled"`, check each dependency. If any dependency has `status !== "Enabled"`, include a `warnings` array in the response.

**Return value on success:**

Returns the updated feature object after the write, plus a `warnings` array (empty if none):

```json
{
  "feature_id": "semantic_search",
  "name": "Semantic Vector Search",
  "status": "Testing",
  "traffic_percentage": 10,
  "last_modified": "2026-04-27",
  "warnings": [
    "Dependency 'search_v2' is in status 'Testing', not 'Enabled'. semantic_search may not function correctly."
  ]
}
```

**Return value on error:**

```json
{
  "error": "INVALID_STATE",
  "message": "State 'enabled' is not valid. Must be one of: Disabled, Testing, Enabled (case-sensitive).",
  "feature_id": "dark_mode"
}
```

**Error conditions:**

| Error code | Trigger |
|---|---|
| `FEATURE_NOT_FOUND` | `feature_id` does not exist in `features.json`. |
| `INVALID_STATE` | `state` is not one of the three allowed values (case-sensitive check). |
| `FILE_READ_ERROR` | Cannot read `features.json`. |
| `FILE_WRITE_ERROR` | Cannot write the updated `features.json`. |

**Example call:**

> "Disable the Stripe payment option — there's a bug in the webhook handler."

The assistant calls:
```json
{ "tool": "set_feature_state", "arguments": { "feature_id": "stripe_alternative", "state": "Disabled" } }
```

The server writes the update and returns the new state with `traffic_percentage: 0`.

---

### Tool 3: `adjust_traffic_rollout`

**Purpose:** Change the `traffic_percentage` of a feature that is currently in `"Testing"` state. Does not change the `status`. Updates `last_modified`.

**Signature:**
```
adjust_traffic_rollout(feature_id: string, percentage: number) -> FeatureObject | ErrorObject
```

**Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `feature_id` | string | Yes | The `snake_case` key of the target feature. |
| `percentage` | number | Yes | Integer from 0 to 100 inclusive. Non-integer values should be rejected. |

**Validation rules:**

- `percentage` must be an integer (no decimals).
- `percentage` must be in the range 0–100.
- The feature's `status` must be `"Testing"`. If the feature is `"Disabled"` or `"Enabled"`, return an error — use `set_feature_state` to change state first.

**Side effects:**

- Sets `traffic_percentage` to the provided value.
- Updates `last_modified` to today's date.
- If `percentage` is `0`, include a `hint` in the response suggesting the caller use `set_feature_state` with `"Disabled"` instead.
- If `percentage` is `100`, include a `hint` suggesting promotion to `"Enabled"` via `set_feature_state`.

**Return value on success:**

```json
{
  "feature_id": "search_v2",
  "name": "New Search Algorithm",
  "status": "Testing",
  "traffic_percentage": 50,
  "last_modified": "2026-04-27",
  "hint": null
}
```

**Return value on error:**

```json
{
  "error": "WRONG_STATUS_FOR_ROLLOUT",
  "message": "adjust_traffic_rollout can only be called on features with status 'Testing'. 'paypal_express_buttons' is currently 'Enabled'. Use set_feature_state to change its status first.",
  "feature_id": "paypal_express_buttons"
}
```

**Error conditions:**

| Error code | Trigger |
|---|---|
| `FEATURE_NOT_FOUND` | `feature_id` does not exist. |
| `WRONG_STATUS_FOR_ROLLOUT` | Feature `status` is not `"Testing"`. |
| `INVALID_PERCENTAGE` | `percentage` is not an integer, or is outside 0–100. |
| `FILE_READ_ERROR` | Cannot read `features.json`. |
| `FILE_WRITE_ERROR` | Cannot write the updated `features.json`. |

**Example call:**

> "Expand the dark mode test from 20% to 50%."

The assistant calls:
```json
{ "tool": "adjust_traffic_rollout", "arguments": { "feature_id": "dark_mode", "percentage": 50 } }
```

The server writes the update. Response includes `traffic_percentage: 50` and `last_modified` set to today.

---

## 4. Feature Flag Catalog

This section describes all 25 feature flags defined in `features.json`. Each entry includes the flag's purpose, which parts of the system it touches, its typical rollout path, and any dependencies on other flags.

---

### Search & Discovery

#### `search_v2` — New Search Algorithm
**Default state:** Testing (15%)

The current product search in `productController.getProducts` uses MongoDB `$regex` on the product name field only. `search_v2` replaces this with a hybrid BM25 + TF-IDF ranking pipeline that indexes `name`, `brand`, `category`, and `description`. It also adds fuzzy tolerance for single-character misspellings, so a query for "headphone" still returns "Headphones".

**System impact:** `backend/controllers/productController.js` (new search path), MongoDB text index on Product collection. No frontend changes — the `SearchBox` component sends the same keyword query param.

**Typical rollout:** Start at 5% internal traffic. After one week with no index performance regressions, expand to 25%, then 50% with A/B comparison of zero-result rate, then 100%.

**Dependencies:** None. This is a prerequisite for `semantic_search`.

---

#### `semantic_search` — Semantic Vector Search
**Default state:** Disabled

Extends `search_v2` with embedding-based retrieval. Product embeddings are pre-computed and stored; at query time, the user's search string is embedded and matched by cosine similarity. Dramatically improves discoverability for natural-language queries ("something warm to wear for a hike") that keyword search cannot handle.

**System impact:** New embedding pipeline (background job), vector index on Product collection, extended productController search endpoint. High infrastructure cost — requires GPU or embedding API budget.

**Typical rollout:** Internal only → 5% beta → 25% after precision metrics validation.

**Dependencies:** `search_v2` must be `"Enabled"` first. If `search_v2` is still in Testing, semantic search results and keyword results will be inconsistent across user sessions.

---

#### `search_autosuggest` — Search Autocomplete
**Default state:** Testing (25%)

As the user types in the `SearchBox` component, a dropdown shows matching product names and popular query strings. Calls debounced to a lightweight `/api/products/suggest` endpoint backed by a prefix-indexed query. Reduces time to first result and lowers zero-result search rate.

**System impact:** New backend route `/api/products/suggest`, minor extension to `SearchBox` component. No database schema changes.

**Typical rollout:** Safe to roll out broadly; primarily a UX change with low risk. Test at 25%, monitor latency p95, promote to 100%.

**Dependencies:** Works independently of `search_v2`. If `search_v2` is enabled, autosuggest can optionally use the improved index.

---

### Cart

#### `cart_redesign` — Redesigned Cart UI
**Default state:** Testing (10%)

The `CartScreen` currently uses a two-column layout with a separate card for the order summary. The redesigned version uses a sticky sidebar summary, inline quantity spinners (replacing the `<select>` dropdown), animated item removal, and a coupon code input field placeholder. Internal testing shows a 40% reduction in clicks to reach checkout.

**System impact:** React component (`CartScreen.js`) only. No backend changes. Cart state in Redux and localStorage is unchanged.

**Typical rollout:** A/B test at 50/50 for two weeks. Compare conversion rate (cart → order placed). Promote winner.

**Dependencies:** `save_for_later` depends on this flag.

---

#### `save_for_later` — Save Items for Later
**Default state:** Disabled

Adds a "Save for Later" button next to each cart item. Saved items are persisted to the authenticated user's profile in MongoDB (requires a `savedItems` array field added to `userModel`). Items appear in a separate "Saved for Later" section below the active cart and can be moved back with one click.

**System impact:** `userModel.js` schema extension, new API route `POST /api/users/saved-items`, update to CartScreen UI.

**Typical rollout:** Requires `cart_redesign` to be in Testing or Enabled for UI consistency. Release to authenticated users only. Start at 10% canary.

**Dependencies:** `cart_redesign`.

---

#### `guest_cart_persistence` — Guest Cart Persistence
**Default state:** Enabled (100%)

Cart items for unauthenticated users are already saved to `localStorage` by the Redux cart reducer. This flag controls the additional behavior of restoring the cart on the next browser session (when the user opens a new tab or returns the next day) and displaying a "Welcome back — your cart has been saved" banner.

**System impact:** `cartActions.js` (restore logic), a new `CartRestoreBanner` component. Fully client-side.

**Typical rollout:** Already fully enabled. If the banner causes UX complaints, dial back via `set_feature_state` to Disabled without touching code.

**Dependencies:** None.

---

### Checkout

#### `express_checkout` — Express One-Click Checkout
**Default state:** Disabled

Authenticated users who have previously completed an order (so their shipping address is on file) see a "Buy Now" button on `ProductScreen` and `CartScreen`. Clicking it creates the order immediately using the last-used shipping address and payment method, bypassing the four-step checkout flow.

**System impact:** New button component, new `POST /api/orders/express` endpoint in `orderController`, reads last shipping address from user's order history.

**Typical rollout:** High-value change; start with returning customers (segment `returning_customers`) at 5% canary. Monitor for accidental orders and order cancellation rate.

**Dependencies:** `guest_cart_persistence` (for session continuity).

---

#### `multi_step_checkout_v2` — Redesigned Multi-Step Checkout
**Default state:** Testing (20%)

Replaces the current hard redirects between `ShippingScreen → PaymentScreen → PlaceOrderScreen` (using `history.push`) with an animated stepper that lives on a single URL. Users can navigate backward without losing entered data. Includes real-time address validation via a third-party API.

**System impact:** New `CheckoutWizard` React component replaces three existing screen components. Router configuration change in `App.js`. No backend changes.

**Typical rollout:** A/B test at 50/50. Measure checkout completion rate and time-to-complete. Target: 15% improvement in completion rate over the 4-week test window.

**Dependencies:** None. Mutually exclusive with `express_checkout` UX — both can be enabled simultaneously but the express flow should take precedence.

---

#### `gift_message` — Gift Message at Checkout
**Default state:** Disabled

An optional textarea on `PlaceOrderScreen` lets the buyer add a personal message (max 280 characters). Stored in the Order document as `giftMessage: String`. Printed on packing slip. Email confirmation includes the message.

**System impact:** `orderModel.js` (new optional field), `PlaceOrderScreen.js` (new form field), `orderController.addOrderItems` (persist field).

**Typical rollout:** Low risk. Enable fully after confirming packing slip rendering is correct. No traffic ramp needed.

**Dependencies:** None.

---

### Payments

#### `paypal_express_buttons` — PayPal Express Checkout Buttons
**Default state:** Enabled (100%)

The PayPal Smart Payment Buttons appear on `CartScreen` and `ProductScreen` (above the fold), allowing users to authorize payment via PayPal without navigating through the shipping and payment form steps. PayPal provides the shipping address from the buyer's account.

**System impact:** PayPal SDK already integrated (`OrderScreen`). This flag controls whether the buttons appear in additional surface areas.

**Typical rollout:** Already fully enabled. Serves as a kill switch — if PayPal has a service incident, set to Disabled immediately.

**Dependencies:** None.

---

#### `apple_pay` — Apple Pay
**Default state:** Disabled

Shows an Apple Pay button on `PaymentScreen` for Safari users on iOS and macOS. Uses the Web Payments Request API. Merchant domain verification must be completed before enabling. Payment processor: Stripe (requires `stripe_alternative` to be in Testing or Enabled).

**System impact:** New `ApplePayButton` React component, backend Stripe payment intent endpoint, merchant identity verification file served at `/.well-known/apple-developer-merchantid-domain-association`.

**Typical rollout:** Enable for `safari_users` and `mobile_ios` segments only. Start at 5%, monitor error rate in Safari console.

**Dependencies:** `stripe_alternative` must be active.

---

#### `stripe_alternative` — Stripe as Alternative Payment Processor
**Default state:** Testing (5%)

The `PaymentScreen` currently has a Stripe radio button that is commented out. This flag enables the Stripe payment path: the user selects Stripe, enters card details in a Stripe Elements form, and payment is confirmed via a backend webhook. Acts as a redundant payment path when PayPal is unavailable.

**System impact:** `PaymentScreen.js` (uncomment + wrap in flag check), new backend route `POST /api/orders/stripe-pay`, Stripe webhook handler.

**Typical rollout:** Start at 5% of all orders (canary). If payment success rate matches PayPal's baseline (~98%), expand to 25% then 50%.

**Dependencies:** None.

---

### Catalog & Discovery

#### `product_recommendations` — Product Recommendations Engine
**Default state:** Testing (30%)

A "Customers also bought" section appears on `ProductScreen` below the reviews. The initial version uses a simple co-purchase matrix derived from existing orders in MongoDB. Falls back to `getTopProducts` (top-rated) when there is insufficient co-purchase data for a given product.

**System impact:** New backend route `GET /api/products/:id/recommendations`, aggregation query on Order collection, new `RecommendationRow` React component.

**Typical rollout:** A/B test at 30% vs. control. Measure add-to-cart rate and revenue per visit.

**Dependencies:** None. Falls back gracefully to top-rated products, so safe to enable independently.

---

#### `recently_viewed` — Recently Viewed Products
**Default state:** Enabled (100%)

The last 6 product detail pages visited in the current browser session are tracked in `localStorage`. A horizontal scroll row of these products is shown at the bottom of `HomeScreen` and `ProductScreen`.

**System impact:** Fully client-side. New `RecentlyViewedRow` component. No backend changes.

**Typical rollout:** Already fully enabled. Serves as a kill switch for performance or UX regression.

**Dependencies:** None.

---

#### `infinite_scroll` — Infinite Scroll on Product Listing
**Default state:** Disabled

Replaces the `Paginate` component on `HomeScreen` with an `IntersectionObserver`-based infinite loader. When the user scrolls near the bottom of the product grid, the next page is appended. URL query params are updated so deep links remain shareable.

**System impact:** `HomeScreen.js`, removal of `Paginate` component (or conditional render), new `useInfiniteProducts` hook.

**Typical rollout:** Target mobile users first (`targeted_segments: ["mobile"]`). Desktop users generally prefer pagination for navigation control. Start at 10% mobile canary.

**Dependencies:** None.

---

### Admin

#### `admin_dashboard_v2` — Redesigned Admin Dashboard
**Default state:** Disabled

Replaces the current table-heavy `OrderListScreen` and `ProductListScreen` with a unified admin dashboard featuring: revenue KPI cards, low-stock alert widget, orders-per-day bar chart, and a collapsible sidebar navigation. All existing admin API endpoints are unchanged.

**System impact:** New admin React component tree. `App.js` routing update. No backend changes.

**Typical rollout:** Enable for `admin` segment only. No traffic ramp needed (admin audience is small). Enable fully once QA sign-off is complete.

**Dependencies:** `admin_bulk_actions` and `admin_advanced_filters` build on top of this UI.

---

#### `admin_bulk_actions` — Bulk Product Actions
**Default state:** Disabled

Checkboxes appear on the admin product list table. Supported actions: bulk delete, apply percentage discount to all selected products, reassign category. Uses a new `PATCH /api/products/bulk` endpoint.

**System impact:** `ProductListScreen.js` (or the v2 equivalent), new bulk endpoint in `productController.js` and `productRoutes.js`.

**Typical rollout:** Enable for `admin` only after `admin_dashboard_v2` is live (UI is designed for the new layout).

**Dependencies:** `admin_dashboard_v2`.

---

#### `admin_advanced_filters` — Advanced Filters in Admin
**Default state:** Testing (100%, admin segment)

Adds multi-criteria filter panels to order and product list screens: order status, date range, payment method, delivery status, minimum/maximum price, stock level. Filters trigger a debounced API call with query params.

**System impact:** `OrderListScreen.js`, `ProductListScreen.js`, minor backend query param additions to existing routes.

**Typical rollout:** Low risk — purely additive UI. Already enabled for admin segment. Promoting to full Enabled after one cycle of admin feedback.

**Dependencies:** Works with both current and v2 admin UI.

---

### Reviews

#### `reviews_moderation` — Admin Review Moderation Queue
**Default state:** Disabled

New reviews submitted via `POST /api/products/:id/reviews` are saved with `status: "pending"` instead of going live immediately. Admins see a moderation queue in the dashboard. Approved reviews become visible; rejected ones trigger an optional notification email.

**System impact:** `reviewSchema` extension (add `status` field), `productController.createProductReview` update, new admin endpoint `PATCH /api/products/:id/reviews/:reviewId/moderate`, new admin UI component.

**Typical rollout:** Enable with `admin_dashboard_v2`. Consider the impact on review velocity — moderate by default adds friction. Start with `targeted_segments: ["admin"]` to validate workflow, then enable globally.

**Dependencies:** None. `photo_reviews` depends on this.

---

#### `photo_reviews` — Photo Attachments in Reviews
**Default state:** Disabled

Customers can attach up to 3 photos when writing a review. Photos upload to the existing `/api/upload` endpoint (which already handles product image uploads). Stored as `images: [String]` in `reviewSchema`. Displayed as a thumbnail gallery in `ProductScreen`.

**System impact:** `reviewSchema` extension, `createProductReview` controller update, updated review form in `ProductScreen.js`, thumbnail gallery component.

**Typical rollout:** Canary at 10% authenticated users. Monitor storage usage and upload success rate.

**Dependencies:** `reviews_moderation` recommended — unmoderated photo content is a risk. If `reviews_moderation` is Disabled, photo_reviews should remain Disabled.

---

#### `verified_purchase_badge` — Verified Purchase Badge
**Default state:** Enabled (100%)

Reviews written by users with a completed, delivered order containing the reviewed product display a "Verified Purchase" badge. The check cross-references the review author's user ID against the Order collection at render time.

**System impact:** `productController.getProductById` (or a new aggregation query), `ProductScreen.js` (badge display in review list).

**Typical rollout:** Already fully enabled. Kill switch available if the query causes performance issues at scale.

**Dependencies:** None.

---

### Performance

#### `image_lazy_loading` — Lazy Loading for Product Images
**Default state:** Enabled (100%)

Native `loading="lazy"` attribute applied to all product images in the `Product` component card and `ProductCarousel`. Low-quality image placeholder (LQIP) technique applies a CSS blur that resolves once the full image loads. Reduces initial page load weight by 60–70% on catalog pages.

**System impact:** `Product.js`, `ProductCarousel.js`, minor CSS additions.

**Typical rollout:** Already fully enabled. Kill switch for browser compatibility regressions.

**Dependencies:** None.

---

#### `code_splitting_optimisation` — Route-Level Code Splitting
**Default state:** Testing (50%)

All screen-level React components are wrapped in `React.lazy()` with `Suspense` fallbacks. Each route loads as a separate webpack chunk. Admin routes, order routes, and auth routes are never downloaded by anonymous users browsing the catalog. Reduces initial JS bundle from ~280 KB to ~90 KB for anonymous users.

**System impact:** `App.js` (import changes), `store.js` (no change), webpack config (no explicit change needed — CRA handles it automatically with dynamic imports).

**Typical rollout:** Technical change with no visible UX difference. Test at 50% to catch any lazy-load edge cases (SSR mismatches, preloading). Promote to 100% after one week of stable metrics.

**Dependencies:** None.

---

### UX & Localization

#### `dark_mode` — Dark Mode Theme
**Default state:** Testing (20%)

A sun/moon toggle in the `Header` component switches between light and dark CSS custom property themes. Dark mode overrides Bootstrap CSS variables. Preference persisted to `localStorage`. Respects the user's OS-level `prefers-color-scheme` media query as the initial default.

**System impact:** `Header.js` (toggle), `index.css` (dark theme variables), `App.js` (theme provider context). No backend changes.

**Typical rollout:** A/B test at 20% first. Measure session length and return visit rate — dark mode is correlated with engagement among developer-type audiences. Expand to 50%, then 100%.

**Dependencies:** None.

---

#### `guest_checkout` — Guest Checkout Without Registration
**Default state:** Disabled

Unauthenticated users can complete a purchase without creating an account. A temporary guest session token is issued at checkout entry, associated with the order, and valid for 24 hours. After purchase, the confirmation page prompts account creation pre-filled with the shipping address.

**System impact:** New backend middleware for guest token issuance, `orderModel` extension for guest orders, `CartScreen` checkout button behavior change, post-purchase prompt component.

**Typical rollout:** High-impact change — estimated 15-25% recovery of checkout-abandonment from registration friction. Start at 5% canary for guests. Monitor for order fraud rate and guest-to-registered conversion rate.

**Dependencies:** None.

---

## 5. Rollout Strategies

### Canary Deployment

A canary deployment introduces a change to a small percentage of production traffic before full rollout. The name comes from the historical practice of using a canary bird in coal mines to detect toxic gases.

**Standard canary ladder for this project:**

```
5% → 25% → 50% → 100% → promote to Enabled
```

Each step requires at minimum 48 hours of observation. Metrics to watch: error rate (HTTP 5xx on affected endpoints), p95 latency, conversion rate on the affected flow, and any business metric specific to the feature (e.g., checkout completion rate for `multi_step_checkout_v2`).

**MCP tool sequence for a canary rollout:**

```
1. set_feature_state("search_v2", "Testing")       → traffic_percentage becomes 10
2. adjust_traffic_rollout("search_v2", 25)          → after 48h with no regressions
3. adjust_traffic_rollout("search_v2", 50)          → after another 48h
4. adjust_traffic_rollout("search_v2", 100)         → soak for 24h
5. set_feature_state("search_v2", "Enabled")        → lock in the change
```

### A/B Testing

An A/B test compares two experiences to determine which performs better on a defined metric. With feature flags, the test variant is the feature itself; the control is the default experience.

**Setup:**
- Set `status: "Testing"`, `traffic_percentage: 50`, `rollout_strategy: "ab_test"`.
- Define your primary metric (e.g., conversion rate, average order value) before starting.
- Run for a minimum of two weeks to avoid day-of-week bias.
- Use a stats calculator to determine if the difference is significant before declaring a winner.

**After the test:**
- Winner: `set_feature_state` to `"Enabled"`.
- Loser: `set_feature_state` to `"Disabled"`, then schedule the flag for code cleanup.

### Kill Switch

The kill switch pattern means keeping a fully-deployed feature under a flag that remains Enabled in normal operation but can be disabled instantly without a code deploy.

`paypal_express_buttons`, `recently_viewed`, `verified_purchase_badge`, and `image_lazy_loading` are all currently Enabled and serve as kill switches for their respective subsystems.

**Kill switch activation:**
```
set_feature_state("paypal_express_buttons", "Disabled")
```

This takes effect on the next read of `features.json` — typically within one request cycle if the server is caching with a short TTL, or immediately if reading from disk on every request.

---

## 6. Best Practices

### Flag Lifecycle and Cleanup Policy

Feature flags have a lifecycle with a mandatory end. Flags that remain in the codebase indefinitely become **flag debt** — they make the code harder to read, harder to test, and they can conflict with each other in unexpected ways.

**The lifecycle:**
1. **Create** the flag in `features.json` with `status: "Disabled"`.
2. **Test** (canary or A/B).
3. **Enable** (promote to 100%).
4. **Clean up** — remove the flag from `features.json` and remove the conditional in code within 30 days of reaching `"Enabled"`. Create a backlog ticket at promotion time.

**Signals that a flag is overdue for cleanup:**
- `status` has been `"Enabled"` for more than 30 days.
- The flag has no `targeted_segments` (meaning it affects everyone equally — there is no reason to keep the conditional).
- No active rollout or A/B test is referencing it.

### Avoiding Flag Dependency Chains

Each dependency listed in a flag's `dependencies` array adds a constraint that must be managed manually. Deep chains — where flag C depends on B, which depends on A — create fragility: disabling A for a hotfix unexpectedly breaks C.

**Rules:**
- Maximum dependency depth: 2 levels (a flag may depend on another flag, but that flag should not itself have dependencies).
- Never create a circular dependency.
- When a flag graduates to `"Enabled"`, its dependents should be updated to remove the dependency reference (because the parent flag is now guaranteed to be on).
- When adding a dependency, document the reason in the `description` field.

### Naming Conventions

- Feature IDs are `snake_case`, lowercase, no hyphens.
- Use a noun-verb or noun-adjective structure: `cart_redesign`, `search_v2`, `photo_reviews`.
- Version suffixes (`_v2`, `_v3`) signal replacement of an existing feature, not an incremental improvement.
- Avoid generic names like `new_feature` or `experiment_1` — the name should be meaningful to someone reading `features.json` six months later.

### Testing Flags in Development

During local development, you should be able to override any flag to any state without touching `features.json`. A common pattern is to check for an environment variable or a query parameter (`?ff_dark_mode=enabled`) that takes precedence over the JSON-based value. This is not implemented in the current spec but is noted here as a natural extension.

When writing unit tests for code that is guarded by a flag, always write tests for both the `Enabled` and `Disabled` paths. Do not assume the flag will always be in its current default state.

### Security Considerations

`features.json` is a configuration file that controls production behavior. In a real system:
- It should not be committed to a public repository if it exposes internal product roadmap information.
- The MCP server that writes it should require authentication — do not expose the write tools publicly.
- Treat `targeted_segments` values as non-secret labels; do not put user-identifiable information in the flag definitions themselves.

---

*Specification version 1.0. Last updated: 2026-04-27.*
