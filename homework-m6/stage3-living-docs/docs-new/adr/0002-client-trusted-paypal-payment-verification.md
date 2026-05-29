# Client-Trusted PayPal Payment Verification

## Status

Accepted

## Context and Problem Statement

The application accepts payments via PayPal during the checkout flow. After a buyer approves a payment in the PayPal UI, the system needs to record the order as paid and persist the payment details. The question is where payment verification happens: does the server independently confirm the transaction with PayPal, or does it trust the payment result forwarded by the client?

## Considered Options

1. **Client-trust model** — the React frontend uses the PayPal JS SDK (`react-paypal-button-v2`); on approval, the SDK returns a `paymentResult` object that the frontend forwards to `PUT /api/orders/:id/pay`; the backend stores it as-is.
2. **Server-side verification with PayPal REST SDK** — after the client captures the payment, the backend calls PayPal's `GET /v2/checkout/orders/:paypal_order_id` API to independently verify the transaction status, amount, and currency before marking the order as paid.
3. **PayPal webhook (IPN / Webhooks API)** — register a server-side webhook endpoint; PayPal sends a signed notification when a payment completes; the backend verifies the HMAC signature and updates the order asynchronously.

## Decision Outcome

Option 1 — client-trust model.

The `OrderScreen` component loads the PayPal JS SDK dynamically (fetching the client ID from `GET /api/config/paypal`), renders a `PayPalButton`, and on successful payment dispatches `payOrder(orderId, paymentResult)`. The action sends the raw `paymentResult` object to the backend. The `updateOrderToPaid` controller stores `id`, `status`, `update_time`, and `email_address` from the payload directly into the order document and sets `isPaid = true`. There is no server-side PayPal SDK, no API call to verify the transaction, and no webhook handler.

This was likely chosen for simplicity and because it's a learning/course project where payment integrity in a sandbox environment is not a production concern.

## Consequences

**Positive:**
- Minimal backend complexity — no PayPal server SDK dependency, no webhook infrastructure, no signature verification logic.
- Fast to implement — the entire payment flow is ~30 lines across frontend and backend.
- Works with PayPal sandbox out of the box with just a client ID.

**Negative:**
- **Critical security gap in production**: a malicious client can forge `paymentResult` and mark any order as paid without actually paying. The backend has no way to distinguish a real PayPal response from a crafted one.
- No idempotency protection — the same payment result could be submitted multiple times.
- No handling of PayPal disputes, refunds, or chargebacks — these events only arrive via webhooks.
- The `email_address` field accesses `req.body.payer.email_address` without a null-check (see FINDINGS.md #1, now fixed).

## Confidence

**HIGH** — The absence of server-side verification is unambiguous: no PayPal server SDK in `package.json`, no verification API call in `orderController.js`, no webhook route in `server.js`, and the controller directly stores the client-provided payload.

## Evidence

- `frontend/src/screens/OrderScreen.js` — loads PayPal SDK via `<script>` tag, renders `PayPalButton`, passes `paymentResult` to `successPaymentHandler`
- `frontend/src/actions/orderActions.js` — `payOrder` action sends `paymentResult` via `PUT /api/orders/${orderId}/pay`
- `backend/controllers/orderController.js` — `updateOrderToPaid` stores `req.body` fields directly: `id`, `status`, `update_time`, `email_address`; sets `isPaid = true`; no PayPal API call
- `backend/server.js` — `GET /api/config/paypal` returns the client ID; no webhook or verification endpoint
- `backend/models/orderModel.js` — `paymentResult` schema has `id`, `status`, `update_time`, `email_address` as plain strings with no validation
- `package.json` — no `@paypal/checkout-server-sdk`, `paypal-rest-sdk`, or PayPal server library
