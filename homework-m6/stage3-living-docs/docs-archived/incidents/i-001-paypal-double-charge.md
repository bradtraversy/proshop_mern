# Incident i-001: PayPal Sandbox Webhook Double-Charge

**Severity:** P1 (production financial impact)
**Status:** Resolved
**Date detected:** 2023-11-04
**Date resolved:** 2023-11-06
**Duration:** ~38 hours (detection to full resolution)
**Author:** On-call Engineer (incident commander)
**Reviewed by:** Engineering team — postmortem meeting 2023-11-08

---

## Summary

A subset of orders placed via PayPal were being marked as paid twice in the database, resulting in duplicate `paymentResult` documents and — in three cases — inventory being decremented twice for the same order. No customer was charged twice (PayPal correctly processed each payment once); the duplication was internal to the application layer. The root cause was a race condition triggered by PayPal sandbox's non-standard behavior of firing the `onApprove` callback twice on certain network conditions.

---

## Timeline

All times UTC.

| Time | Event |
|------|-------|
| 2023-11-03 21:14 | PayPal sandbox receives payment for order `63c4a...` (test environment) |
| 2023-11-03 21:14:02 | First `onApprove` callback fires; backend marks order paid, decrements stock |
| 2023-11-03 21:14:04 | Second `onApprove` fires (2-second jitter from PayPal sandbox retry logic) |
| 2023-11-03 21:14:04 | Backend processes second callback; order updated again, stock decremented again |
| 2023-11-04 09:30 | QA Engineer notices `countInStock` for "Airpods Wireless Bluetooth Headphones" shows -1 in admin panel |
| 2023-11-04 09:45 | On-call Engineer begins investigation |
| 2023-11-04 11:00 | Root cause identified: no idempotency check on `PUT /api/orders/:id/pay` |
| 2023-11-04 14:00 | Fix deployed to staging, manually tested across 15 sandbox transactions |
| 2023-11-05 10:00 | Fix deployed to production |
| 2023-11-06 08:00 | Monitoring confirmed no recurrence over 22-hour observation window |
| 2023-11-08 14:00 | Postmortem meeting |

---

## Impact

- **Orders affected:** 7 orders in the database with duplicate `paymentResult` entries
- **Inventory affected:** 3 products with `countInStock` decremented below true value (including one at -1)
- **Customer impact:** Zero. No customer was double-charged. PayPal's own idempotency layer prevented duplicate financial transactions.
- **Revenue impact:** None.
- **Trust impact:** Low (internal only; no external visibility).

---

## Root Cause Analysis

The `@paypal/react-paypal-js` SDK fires the `onApprove` callback when PayPal confirms payment authorization. The application's `onApprove` handler called `payOrder(orderId, paymentResult)` which made a PUT request to `/api/orders/:id/pay`.

The backend handler at that time was:

```javascript
const payOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  order.isPaid = true;
  order.paidAt = Date.now();
  order.paymentResult = { ... };
  const updatedOrder = await order.save();
  res.json(updatedOrder);
});
```

No check was made to see if the order was already marked as paid before writing. PayPal's sandbox environment, unlike production, occasionally fires `onApprove` twice for a single authorization event — a known quirk documented in PayPal's developer forums but not in the primary SDK documentation. The second callback arrived 2 seconds after the first, which was enough time for the first database write to complete, meaning both callbacks received a `200 OK` and each triggered a separate stock decrement via a Mongoose `pre('save')` middleware hook.

**Contributing factors:**
1. No idempotency guard on the pay endpoint.
2. Stock decrement was a side effect in a Mongoose middleware hook, not an explicit step with a guard condition.
3. The sandbox testing protocol did not cover the double-callback scenario.

---

## Resolution

A guard was added to the backend handler:

```javascript
const payOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (order.isPaid) {
    res.status(200).json(order); // idempotent: already paid, return current state
    return;
  }
  order.isPaid = true;
  order.paidAt = Date.now();
  order.paymentResult = { ... };
  const updatedOrder = await order.save();
  res.json(updatedOrder);
});
```

The stock decrement middleware was also updated to check `isModified('isPaid')` and `!this.isPaid` (the previous value) before decrementing, making it safe to call multiple times.

Affected inventory records were corrected manually by the on-call engineer after verifying actual order counts.

---

## Postmortem — Action Items

| Action | Owner | Status | Due |
|--------|-------|--------|-----|
| Add idempotency check to `/api/orders/:id/pay` | Engineer A | Done | 2023-11-05 |
| Add guard to stock decrement middleware | Engineer A | Done | 2023-11-05 |
| Add sandbox regression test: simulate double `onApprove` | Engineer B | Done | 2023-11-15 |
| Document PayPal sandbox double-callback behavior in project wiki | Tech Lead | Done | 2023-11-10 |
| Review all other mutation endpoints for idempotency gaps | Engineer B | Done | 2023-11-22 |
| Monitor production for 60 days before switching PayPal sandbox → production credentials | Tech Lead | Done (2024-10-07, v2.3) | 2024-01-05 |

---

## Lessons

**PayPal sandbox does not faithfully replicate production behavior.** The double-callback occurs in sandbox due to sandbox infrastructure retry logic that does not occur (or occurs far less frequently) in production PayPal. This means a bug class exists that can only be reliably reproduced in sandbox, making fix verification uncertain. This experience is one of the primary reasons Stripe is preferred for new projects (see ADR-004).

**Side effects in Mongoose middleware hooks are hard to reason about.** The stock decrement as a `pre('save')` hook felt elegant but created invisible coupling between the payment flow and the inventory system. Moving it to an explicit controller step made the flow auditable and testable.

**Idempotency on financial endpoints is non-negotiable.** Any endpoint that records a payment, transfers value, or affects inventory should be idempotent by design, not bolted on after an incident.
