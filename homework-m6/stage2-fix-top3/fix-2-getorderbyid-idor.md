# Fix #2 — IDOR in `getOrderById`

## 1. Original finding (from synthesis.md)

> **`backend/controllers/orderController.js:43`** — IDOR in `getOrderById` (`GET /api/orders/:id`): any authenticated user reads any order's PII / address / email / payment data by iterating ids. No ownership or admin check.
> - Source: security-mate (HIGH, A01)
> - Fix approach: after loading the order, allow only `order.user === req.user._id` OR `req.user.isAdmin`; else 401/404.
> - Effort: 30 min

OWASP: A01 Broken Access Control (IDOR).

## 2. What I changed (diff)

```diff
   const order = await Order.findById(req.params.id).populate(
     'user',
     'name email'
   )

   if (order) {
+    // Authorization: an order may only be read by its owner or an admin.
+    // Non-owners get the same 404 as a missing order so we don't disclose
+    // that the id exists (prevents the IDOR enumeration).
+    const ownerId = order.user._id ? order.user._id : order.user
+    const isOwner = ownerId.toString() === req.user._id.toString()
+
+    if (!isOwner && !req.user.isAdmin) {
+      res.status(404)
+      throw new Error('Order not found')
+    }
+
     res.json(order)
   } else {
     res.status(404)
     throw new Error('Order not found')
   }
 })
```

11 lines added, one file. Response shape unchanged for authorized callers
(owner / admin still get the full order). The route already requires `protect`,
so `req.user` is always present.

## 3. Why this approach (trade-offs)

I return **404** rather than 403 for an authenticated non-owner so the endpoint
does not confirm that a given order id exists — that closes the enumeration
vector that makes an IDOR cheap to exploit. The check reads `order.user._id`
because the query `.populate('user', ...)` replaces `user` with a document; the
`ownerId` fallback keeps it correct if populate is ever removed. I kept the
guard inline in the controller (no service-layer extraction) to stay within the
"don't change adjacent structure" constraint — the architectural fix (service
layer) is tracked separately in Stage 3.

## 4. Test status

Run: `npx vitest run homework-m6/stage2-fix-top3/tests/getOrderById-idor.test.js`

```
 ✓ getOrderById-idor.test.js (5 tests) 894ms
   ✓ denies a non-owner non-admin reading another user's order (fixed)  [TARGET]
   ✓ lets the owner read their own order                                [control]
   ✓ lets an admin read any order                                       [control]
   ✓ returns 404 for a non-existent order id                            [control]
   ✓ rejects an unauthenticated request with 401                        [control]
 Test Files  1 passed (1)   Tests  5 passed (5)
```

All 4 control tests stayed green → owner access, admin access, the genuine-404
path, and the auth gate are all preserved.

## 5. Behavior change

**Yes — intentional.** The target test originally asserted the attacker received
`200` + the owner's shipping address and email (the IDOR). It now asserts `404`
with no PII in the body, with a comment pointing back to this file. This is a
deliberate access-control correction, so updating the test to the new contract
is expected. Owner and admin behavior is unchanged, proven by the untouched
control tests.

## 6. Lessons learned

`updateOrderToPaid` (orderController.js:60) and `updateOrderToDelivered` share
the same "fetch by id, no ownership check" shape — the AI review correctly
flagged `updateOrderToPaid` as a separate HIGH. The lesson: an IDOR is rarely a
single endpoint; the same missing-guard pattern tends to repeat across a
controller, so the durable fix is a reusable `assertCanAccessOrder(order, user)`
helper rather than three independent inline checks.
