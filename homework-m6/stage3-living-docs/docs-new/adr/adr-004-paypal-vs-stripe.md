> **TODO(audit-2026-05-29):** Decision still holds (PayPal). Overlaps the canonical docs/adr/0002 which covers the client-trusted verification model — cross-link, do not duplicate.
>
> _Marker added during M6 Stage 3 living-docs audit. Behavioural content below verified accurate; only the noted parts are stale._

# ADR-004: Use PayPal as the Payment Processor

**Status:** Accepted (for current deployment); Superseded by preference for Stripe on new projects
**Date:** 2023-04-20
**Decision Makers:** Engineering team

---

## Context

The ProShop application needed a payment processor for the checkout flow. The requirements at decision time:
- Accept card payments (the primary use case)
- Provide a sandbox/test environment for development
- Minimal PCI compliance burden (no storing raw card data on our servers)
- Reasonable integration complexity for a two-person team
- Cost: transaction fee acceptable; no flat monthly minimums preferred

The application had already scaffolded a placeholder "PayPal" button based on the tutorial the project was modeled after. The question was whether to commit to PayPal or evaluate alternatives before building the full integration.

---

## Decision

Use **PayPal** via the `@paypal/react-paypal-js` React SDK. The integration flow:
1. User clicks "Pay with PayPal" on the Order screen
2. The PayPal JS SDK opens the PayPal popup (card entry or PayPal account login)
3. On payment approval, the SDK fires `onApprove` with a PayPal order ID
4. The React frontend sends the PayPal order ID to the backend (`PUT /api/orders/:id/pay`)
5. The backend verifies the payment with PayPal's API and marks the order as paid in MongoDB

The PayPal `PAYPAL_CLIENT_ID` is served from the backend environment to the frontend on demand (not bundled), preventing the client ID from being hardcoded in the JavaScript bundle.

---

## Consequences

### Positive

- **Zero PCI compliance scope for card data.** The PayPal SDK handles card entry inside PayPal's iframe/popup. No raw card numbers touch our servers. PCI scope is reduced to SAQ A (the lowest level).
- **Widely recognized brand.** PayPal is familiar to users globally. The "Pay with PayPal" button has established trust signals.
- **Free sandbox environment.** The PayPal Developer Console provides sandbox buyer and seller accounts for end-to-end testing without real money.
- **`@paypal/react-paypal-js` SDK is straightforward.** The SDK wraps the PayPal JS SDK in React components (`PayPalScriptProvider`, `PayPalButtons`) with reasonable TypeScript support.
- **No monthly fee.** PayPal charges per-transaction (2.9% + $0.30 in the US). No flat minimum makes it cost-effective for low-volume deployments.

### Negative

- **Sandbox behavior does not faithfully replicate production.** The most significant operational issue encountered. PayPal sandbox fires the `onApprove` callback twice under certain network conditions — behavior that does not occur (or occurs far less frequently) in production PayPal. This caused Incident i-001: a double-charge bug that was impossible to reproduce reliably in production and difficult to verify the fix for in sandbox. The 60-day sandbox observation period before switching to production credentials was driven entirely by this concern.
- **PayPal popup UX is disruptive.** The PayPal checkout flow opens a popup window (or redirect). Users may have popup blockers enabled. The user experience is a context switch that takes them out of the ProShop UI briefly. Stripe's Elements allow card entry inline, within the application's own UI.
- **PayPal's API and documentation are fragmented.** The PayPal developer docs span multiple product generations (Classic, REST, Braintree). Finding the correct REST API documentation for the current SDK version required significant trial and error.
- **Limited webhook reliability (sandbox).** PayPal sandbox webhooks have non-deterministic delivery timing and occasional duplicate events. Production webhooks are more reliable, but the sandbox limitations make webhook-driven flows difficult to test thoroughly.
- **User must have or create a PayPal account for best experience.** While PayPal supports guest card entry, the default experience prompts users to log in to PayPal. Users without PayPal accounts may drop off.

---

## Alternatives Considered

### Stripe

Stripe is now the team's preferred payment processor for new projects. Key advantages over PayPal:

- **Test mode is a faithful replica of production.** Stripe test mode uses the same code paths as production. Test card numbers produce predictable, reproducible behavior. The double-callback incident (i-001) would have been surfaced and verifiable in Stripe's test environment.
- **Stripe Elements / Stripe Checkout.** Card entry inline within the application UI (no popup/redirect), or a fully hosted Checkout page. Both provide better UX than the PayPal popup.
- **Superior API design and documentation.** Stripe's API reference is the industry benchmark for developer experience. Idempotency keys are a first-class concept in Stripe's API, making idempotent payment flows natural to implement (the core issue in i-001).
- **Webhook delivery guarantees and retry logic.** Stripe webhooks have explicit retry policies, event deduplication via `stripe-signature` verification, and a Stripe CLI for local webhook testing.
- **Richer product suite.** Subscriptions, invoicing, Connect (marketplace payments) are all available if the product evolves.

**Reason not chosen at project start:** The project was modeled after a tutorial that used PayPal. The team had prior exposure to the PayPal JS SDK. The switching cost (rewrite the payment flow, set up a Stripe account, update the order schema for `payment_intent_id`) at the start of the project felt higher than the benefit. The i-001 incident changed this assessment.

### Braintree (PayPal subsidiary)

Braintree is PayPal's developer-oriented payment SDK. It offers Stripe-like developer experience with PayPal's underlying processing network. Would have been a better choice than the standard PayPal SDK if the team wanted to stay in the PayPal ecosystem: better documentation, more predictable sandbox behavior, idempotency key support.

**Reason not chosen:** Not evaluated at decision time (the team was not familiar with Braintree as distinct from PayPal).

### No payment processing (mock only)

For a demo/educational application, the payment flow could remain mocked (flip `isPaid: true` immediately). This is the v0.3 approach.

**Reason not chosen for production:** The goal was a realistic e-commerce application with functional payment flow for portfolio and demonstration purposes. A mock payment is not meaningful as a reference implementation.

---

## Migration Path

If migrating to Stripe in the future, the changes required:
1. Install `stripe` (backend) and `@stripe/react-stripe-js` (frontend)
2. Create a Stripe Payment Intent on order creation (server-side)
3. Pass the `clientSecret` to the frontend
4. Replace `PayPalButtons` with `CardElement` or `PaymentElement`
5. Implement a webhook handler for `payment_intent.succeeded`
6. Update the `Order` schema: replace `paymentResult.paypal_id` with `paymentResult.stripe_payment_intent_id`

Estimated effort: 2–3 engineer-days.

---

## Current Assessment (April 2026)

The PayPal integration is stable in production (since v2.1). The i-001 idempotency fix has been in place since v1.1 (sandbox) and v2.3 (production) with no recurrence. However, if this application were being started today or rebuilt, **Stripe would be the unambiguous choice** for its superior sandbox fidelity, API design, and webhook reliability.
