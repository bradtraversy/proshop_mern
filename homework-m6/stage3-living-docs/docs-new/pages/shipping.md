> **TODO(audit-2026-05-29):** Routes / access rules / Redux slices / API calls remain accurate. The 'What Users See' / Components sections describe the old Bootstrap layout — verify against frontend/src/components/good-shop.
>
> _Marker added during M6 Stage 3 living-docs audit. Behavioural content below verified accurate; only the noted parts are stale._

# Shipping Screen

## Route
`/shipping`

## Access
Authenticated users only (redirects to login in checkout flow). Part of the checkout process.

## What Users See
A form container with checkout step indicators showing steps 1 (login) and 2 (shipping) as active/completed. The form contains four input fields: Address, City, Postal Code, and Country. Each field is required. A "Continue" button submits the form and proceeds to payment.

## State (Redux)
- `cart` slice: `shippingAddress` object with fields `{ address, city, postalCode, country }`

## API Calls
- No direct API call. Form data is saved to Redux store (cart state) via `saveShippingAddress()` action
- Data will be used when creating the order

## Components
- **FormContainer** – centered form wrapper
- **CheckoutSteps** – displays checkout progress (step1, step2 props)
- **Form** (Bootstrap) – four text input fields with labels
- **Button** – submit button

## User Actions
- **Enter address, city, postal code, country**: Updates local state
- **Click "Continue"**: Validates required fields (HTML5), saves to Redux, navigates to `/payment`

## Edge Cases
- Empty required fields: HTML5 form validation prevents submission (browser behavior)
- Form fields pre-populated: Initial state from Redux (if returning to this step)
- Navigation away: Data persists in Redux until user logs out or cart is reset
- Postal code format: No validation, accepts any text
- Required attribute: All fields marked as required in HTML
- Form submission: Dispatches action before navigation
