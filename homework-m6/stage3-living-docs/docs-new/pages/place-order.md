> **TODO(audit-2026-05-29):** Routes / access rules / Redux slices / API calls remain accurate. The 'What Users See' / Components sections describe the old Bootstrap layout — verify against frontend/src/components/good-shop.
>
> _Marker added during M6 Stage 3 living-docs audit. Behavioural content below verified accurate; only the noted parts are stale._

# Place Order Screen

## Route
`/placeorder`

## Access
Authenticated users only (final step in checkout). Redirects to shipping or payment if required data is missing.

## What Users See
A review page with checkout step indicators (all 4 steps shown). Left side displays three sections: shipping address, payment method, and order items list (each item shows image, name, quantity, and line total). Right side shows an order summary card with itemsPrice, shippingPrice, taxPrice, and totalPrice calculations, followed by a "Place Order" button.

The page auto-calculates prices: shipping is free for orders over $100 (otherwise $100), tax is 15% of items price. All prices are formatted to 2 decimal places.

## State (Redux)
- `cart` slice: `cartItems`, `shippingAddress`, `paymentMethod`
- `orderCreate` slice: `order`, `success`, `error` flags

## API Calls
- **On "Place Order" button click**: `POST /api/orders` with complete order data (items, address, payment method, prices) via `createOrder()` action
- On success, order details are returned and user is redirected to order confirmation page

## Components
- **CheckoutSteps** – shows all 4 steps completed
- **ListGroup** (Bootstrap) – sections for shipping, payment, items
- **Card** – order summary with price breakdown
- **Message** – error alert if order creation fails
- **Button** – "Place Order" submit button

## User Actions
- **Click "Place Order"**: Dispatches createOrder action with all cart and address data
- **Click product link**: Navigates to product detail (within order items)

## Edge Cases
- Missing shipping address: Redirects to `/shipping` on mount
- Missing payment method: Redirects to `/payment` on mount
- Empty cart: "Place Order" button is disabled (disabled={cart.cartItems === 0})
- Order creation error: Error message displayed, order not created
- Successful order: User redirected to `/order/:id` confirmation page
- Price calculation: All decimals handled with Math.round and toFixed(2)
- Redux state reset: After successful order, USER_DETAILS_RESET and ORDER_CREATE_RESET dispatched
