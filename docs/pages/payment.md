> **TODO(audit-2026-05-29):** Routes / access rules / Redux slices / API calls remain accurate. The 'What Users See' / Components sections describe the old Bootstrap layout — verify against frontend/src/components/good-shop.
>
> _Marker added during M6 Stage 3 living-docs audit. Behavioural content below verified accurate; only the noted parts are stale._

# Payment Screen

## Route
`/payment`

## Access
Authenticated users only (accessed after shipping step). Redirects to shipping if shipping address is not set.

## What Users See
A form container with checkout step indicators showing steps 1-3 (login, shipping, payment) as active. A radio button group labeled "Select Method" displays payment method options. Currently only "PayPal or Credit Card" is visible (Stripe option is commented out in code). A "Continue" button submits the selection and proceeds to order review.

## State (Redux)
- `cart` slice: `shippingAddress` (verified for presence), `paymentMethod` (set by this page)

## API Calls
- No API call. Form data is saved to Redux store via `savePaymentMethod()` action
- Data will be used when creating the order

## Components
- **FormContainer** – centered form wrapper
- **CheckoutSteps** – displays checkout progress (step1, step2, step3 props)
- **Form** (Bootstrap) – radio button group for payment method selection
- **Button** – submit button

## User Actions
- **Select payment method**: Radio button changes paymentMethod state (defaults to "PayPal")
- **Click "Continue"**: Saves selection to Redux, navigates to `/placeorder`

## Edge Cases
- No shipping address set: Page redirects to `/shipping` on mount (guard check)
- Default selection: "PayPal or Credit Card" is checked by default
- Multiple options: Only one payment method currently active (Stripe is commented out)
- Form submission: Dispatch action before navigation
- Radio button behavior: Only one option can be selected at a time (HTML standard)
- No validation needed: Single pre-selected option is valid default
