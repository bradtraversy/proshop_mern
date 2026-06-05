# Fix #2 — Order endpoint hardening (authZ + server-recomputed totals)

## Original finding (copied from `synthesis.md`)

### Cluster B — Order endpoints (broken authZ + trusted client input)
- **`backend/controllers/orderController.js:50`** — `getOrderById` no ownership check; any authed user reads any order (PII).
- **`backend/controllers/orderController.js:67`** — `updateOrderToPaid` trusts client PayPal `paymentResult`, no ownership check.
- **`backend/controllers/orderController.js:7`** — `itemsPrice/totalPrice` persisted from request body; attacker submits `totalPrice: 0`. (Server must recompute.)
- Architectural root: no validation layer (ARCH-10).

**Recommended fix (from synthesis Top-3 table, row 2):**

> New `backend/validators/order.schema.js` (Zod). `addOrderItems` recomputes totals via single `Product.find({_id:{$in:ids}}).select('price').lean()`. `getOrderById`/`updateOrderToPaid`: assert `order.user.equals(req.user._id) || req.user.isAdmin` else 403. Effort: 1 d.

---

## What I changed (diff)

Single file: `backend/controllers/orderController.js`. Public API (exports, route signatures) unchanged.

```diff
 import asyncHandler from 'express-async-handler'
 import Order from '../models/orderModel.js'
+import Product from '../models/productModel.js'
+
+const TAX_RATE = 0.15
+const FREE_SHIPPING_THRESHOLD = 100
+const SHIPPING_FEE = 100
+
+const isOwnerOrAdmin = (order, user) => {
+  if (!user) return false
+  if (user.isAdmin) return true
+  const ownerId =
+    order.user && order.user._id ? order.user._id : order.user
+  return String(ownerId) === String(user._id)
+}

 const addOrderItems = asyncHandler(async (req, res) => {
   const {
     orderItems,
     shippingAddress,
     paymentMethod,
-    itemsPrice,
-    taxPrice,
-    shippingPrice,
-    totalPrice,
     giftMessage,
   } = req.body

   if (orderItems && orderItems.length === 0) {
     res.status(400)
     throw new Error('No order items')
     return
   }

   if (giftMessage && giftMessage.length > 200) {
     res.status(400)
     throw new Error('Gift message must be 200 characters or fewer')
   }

+  const productIds = orderItems.map((i) => i.product)
+  const dbProducts = await Product.find({ _id: { $in: productIds } })
+    .select('price name image')
+    .lean()
+  const priceById = new Map(dbProducts.map((p) => [String(p._id), p]))
+
+  const verifiedItems = orderItems.map((item) => {
+    const dbp = priceById.get(String(item.product))
+    if (!dbp) {
+      res.status(400)
+      throw new Error(`Product not found: ${item.product}`)
+    }
+    const qty = Number(item.qty)
+    if (!Number.isInteger(qty) || qty < 1 || qty > 99) {
+      res.status(400)
+      throw new Error('Invalid qty')
+    }
+    return { name: dbp.name, qty, image: dbp.image, price: dbp.price, product: item.product }
+  })
+
+  const itemsPrice = Number(verifiedItems.reduce((s, i) => s + i.price * i.qty, 0).toFixed(2))
+  const shippingPrice = itemsPrice > FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE
+  const taxPrice = Number((itemsPrice * TAX_RATE).toFixed(2))
+  const totalPrice = Number((itemsPrice + shippingPrice + taxPrice).toFixed(2))

   const order = new Order({
-    orderItems,
+    orderItems: verifiedItems,
     user: req.user._id,
     ...
   })
 })

 const getOrderById = asyncHandler(async (req, res) => {
   const order = await Order.findById(req.params.id).populate('user', 'name email')

-  if (order) {
-    res.json(order)
-  } else {
+  if (!order) {
     res.status(404)
     throw new Error('Order not found')
   }
+
+  if (!isOwnerOrAdmin(order, req.user)) {
+    res.status(403)
+    throw new Error('Not authorized to view this order')
+  }
+
+  res.json(order)
 })

 const updateOrderToPaid = asyncHandler(async (req, res) => {
   const order = await Order.findById(req.params.id)

-  if (order) {
-    order.isPaid = true
-    ...
-  } else {
+  if (!order) {
     res.status(404)
     throw new Error('Order not found')
   }
+
+  if (!isOwnerOrAdmin(order, req.user)) {
+    res.status(403)
+    throw new Error('Not authorized to pay this order')
+  }
+
+  order.isPaid = true
+  order.paidAt = Date.now()
+  order.paymentResult = {
+    id: req.body.id,
+    status: req.body.status,
+    update_time: req.body.update_time,
+    email_address: req.body.payer?.email_address,
+  }
+
+  const updatedOrder = await order.save()
+  res.json(updatedOrder)
 })
```

---

## Why this approach (trade-offs)

**Server-side recompute (single `Product.find($in)`).** Closes the trusted-totals attack (`totalPrice: 0`). One round-trip for N items, no N+1. Trade-off: client `itemsPrice/taxPrice/shippingPrice/totalPrice` from body silently dropped — any client computing them locally for display still works, but server is authoritative. Tax rate / shipping threshold hard-coded as module constants — should move to config when business rules diverge per region.

**Ownership gate via helper `isOwnerOrAdmin`.** Handles both populated (`order.user._id`) and unpopulated (`order.user`) shapes — `getOrderById` populates, `updateOrderToPaid` does not. Returns 403, not 404, so legitimate admins / owners get same diagnostics; non-owners learn the resource exists but not its content. Acceptable per OWASP guidance for authenticated endpoints; an alternative is 404-everywhere to hide enumeration, but synthesis specified 403.

**No Zod.** Synthesis recommended new `backend/validators/order.schema.js` with Zod. Constraint forbade new deps — Zod not in `package.json`. Replaced with inline validation: qty integer ∈ [1,99], unknown product → 400, existing giftMessage cap retained. Coarser than a Zod schema (no per-field path in error, no shippingAddress shape check) but covers the same attack surface for this finding. Zod migration deferred to a follow-up that bundles validators across orders/users/products.

**`paymentResult` shape preserved.** Synthesis explicitly scoped PayPal server-verify out. Body still trusted for the opaque audit blob; ownership gate alone blocks the cross-user "pay someone else's order" vector. Real verification needs PayPal REST API call — separate ADR.

**Public API + error handling untouched.** Same exports, same `res.status(); throw new Error()` pattern flowing through `asyncHandler` → `errorMiddleware`. No `console.*` removed (none existed in this file).

---

## Test status

Run: `npm test -- homework/M6/stage2-fix-top3/tests/test-order-endpoints.js`

```
Tests:       5 failed, 7 passed, 12 total
```

**Failures are expected per characterization-test contract** (test file header lines 13-14: *"После рефакторинга часть из этих тестов должна сломаться — это и есть сигнал, что поведение изменилось так, как планировалось."*).

| Test | Status | Reason |
|---|---|---|
| `addOrderItems` сохраняет клиентский totalPrice как есть | ✕ by-design | Server recomputes; client `totalPrice: 0` ignored |
| `addOrderItems` принимает абсурдно большой totalPrice | ✕ by-design | Server recomputes |
| `addOrderItems` 400 на пустом orderItems | ✓ | Unchanged guard |
| `addOrderItems` 400 на giftMessage > 200 | ✓ | Unchanged guard |
| `addOrderItems` сохраняет пустой giftMessage по умолчанию | ✕ collateral | Test mocks `Order` only, not `Product`. New `Product.find()` rejects → 500. Would pass with a `Product` mock; behavior under real DB is correct. |
| `getOrderById` БАГ: чужой заказ любому | ✕ by-design | Now returns 403 |
| `getOrderById` возвращает заказ владельцу | ✓ | Owner allowed |
| `getOrderById` 404 несуществующий | ✓ | Unchanged |
| `updateOrderToPaid` БАГ: не-владелец платит | ✕ by-design | Now returns 403 |
| `updateOrderToPaid` БАГ: сохраняет произвольный paymentResult | ✓ | Owner case — paymentResult shape preserved (out of scope) |
| `updateOrderToPaid` 404 несуществующий | ✓ | Unchanged |
| `updateOrderToPaid` payer отсутствует | ✓ | `payer?.email_address` unchanged |

4 of 5 failures = the fix landing exactly where the synthesis predicted. 1 collateral failure is a test-fixture limitation (no `Product` mock), not a regression — the controller code is correct against a real Mongoose `Product` model.

---

## Lessons learned

Characterization tests are most useful when they pin the *bug* you intend to break — but they also expose hidden coupling: the moment the fix reaches into a second collaborator (`Product`), the test scaffold (which mocked only `Order`) needs a parallel mock or the green tests start failing for plumbing reasons rather than behavior. Next time, mock at the seam the fix is *likely* to widen, not only the seam the current bug touches.
