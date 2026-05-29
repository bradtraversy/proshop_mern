> **TODO(audit-2026-05-29):** Routes / access rules / Redux slices / API calls remain accurate. The 'What Users See' / Components sections describe the old Bootstrap layout — verify against frontend/src/components/good-shop.
>
> _Marker added during M6 Stage 3 living-docs audit. Behavioural content below verified accurate; only the noted parts are stale._

# Shopping Cart Screen

## Route
`/cart/:id?` (optional product ID for immediate add)

## Access
Public (no authentication required for viewing, redirects to login for checkout)

## What Users See
A two-column layout: left side displays a list of cart items with images, names, prices, and quantity selector dropdowns; right side shows a summary card with subtotal calculation, item count, and a "Proceed To Checkout" button.

Each cart item displays thumbnail image, product link, unit price, and a dropdown to adjust quantity. A delete button (trash icon) removes items from cart.

## State (Redux)
- `cart` slice: `cartItems` array containing `{ product, name, image, price, qty, countInStock }`

## API Calls
- **On mount**: If `productId` in URL, immediately dispatches `addToCart(productId, qty)` to add/update item
- No backend call for cart operations; cart is stored in localStorage via reducer

## Components
- **Message** – displays "Your cart is empty" with link to home
- **Form.Control** (select) – quantity selector
- **Button** – delete item button (trash icon variant)
- **Card** – subtotal summary card with checkout button

## User Actions
- **Change quantity**: Dropdown updates item quantity (re-adds item with new quantity)
- **Delete item**: Trash button removes item from cart
- **Proceed To Checkout**: Redirects to `/login?redirect=shipping` (requires authentication)
- **Click product link**: Navigates to product detail page
- **Go Back**: Click on home link in empty message

## Edge Cases
- Empty cart: Shows message with "Go Back" link, checkout button is disabled
- Cart with 0 quantity: Invalid state (should not occur in normal flow)
- Quantity exceeds stock: Dropdown only shows available quantities
- Item count in subtotal: Shows total number of items (sum of quantities)
- Invalid product ID in URL: addToCart action handles gracefully
- Browser refresh: Cart persists via localStorage integration in reducer
