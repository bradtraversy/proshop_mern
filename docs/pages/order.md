> **TODO(audit-2026-05-29):** Routes / access rules / Redux slices / API calls remain accurate. The 'What Users See' / Components sections describe the old Bootstrap layout — verify against frontend/src/components/good-shop.
>
> _Marker added during M6 Stage 3 living-docs audit. Behavioural content below verified accurate; only the noted parts are stale._

# Order Confirmation Screen

## Route
`/order/:id`

## Access
Authenticated users only (redirects to login if not logged in). Users can typically view only their own orders (backend enforces this).

## What Users See
Displays complete order details split across two columns. Left side shows shipping information (name, email, address), payment method, order status (paid/unpaid, delivered/undelivered with dates or red X icons), and itemized order items. Right side displays an order summary card with price breakdown (items, shipping, tax, total).

If the order is unpaid, a PayPal payment button is displayed. If user is an admin and the order is paid but not delivered, a "Mark As Delivered" button is shown.

## State (Redux)
- `orderDetails` slice: `loading`, `error`, `order` object
- `orderPay` slice: `loading`, `success` for payment processing
- `orderDeliver` slice: `loading`, `success` for delivery marking
- `userLogin` slice: `userInfo` (used for admin check)

## API Calls
- **On mount**: `GET /api/orders/:id` via `getOrderDetails()` action
- **On PayPal callback**: `PUT /api/orders/:id/pay` with paymentResult via `payOrder()` action
- **On "Mark As Delivered" click**: `PUT /api/orders/:id/deliver` via `deliverOrder()` action
- **PayPal SDK**: Dynamically loads PayPal script if not already loaded

## Components
- **Message** – status messages (delivery status, payment status, errors)
- **Loader** – loading spinner during data fetch or payment processing
- **Image** – product images in order items
- **Card** – order summary card
- **PayPalButton** – React PayPal Button v2 component for payment (conditionally rendered)
- **Button** – "Mark As Delivered" button (admin only, conditional)

## User Actions
- **Complete PayPal payment** (if unpaid): PayPal button triggers `successPaymentHandler()`
- **Mark As Delivered** (admin only): Dispatches `deliverOrder()` action
- **Click product link**: Navigates to product detail page
- **Navigate away**: Order data fetched fresh on return (safety measure)

## Edge Cases
- User not authenticated: Redirected to login on mount
- Order not found: Error message displayed
- Order already paid: PayPal button not shown
- Order already delivered: "Mark As Delivered" button not shown
- User is not admin: "Mark As Delivered" button never shown
- PayPal SDK loading: Loader shown while SDK initializes
- Payment error: Error message displayed below payment button
- Items price calculation: Recalculated on render (not stored in order object)
