> **TODO(audit-2026-05-29):** Routes / access rules / Redux slices / API calls remain accurate. The 'What Users See' / Components sections describe the old Bootstrap layout — verify against frontend/src/components/good-shop.
>
> _Marker added during M6 Stage 3 living-docs audit. Behavioural content below verified accurate; only the noted parts are stale._

# Admin Orders List Screen

## Route
`/admin/orderlist`

## Access
Admin users only. Non-admin users and unauthenticated users are redirected to login.

## What Users See
A heading "Orders" with a table listing all orders in the system. Table columns: ID, User (customer name), Date (order creation date), Total (total price), Paid (payment date or X icon if unpaid), Delivered (delivery date or X icon if undelivered), and Details button.

Each row represents one order. The Details button navigates to the full order view.

## State (Redux)
- `orderList` slice: `loading`, `error`, `orders` array
- `userLogin` slice: `userInfo` (used for admin access control)

## API Calls
- **On mount**: `GET /api/orders` via `listOrders()` action to fetch all orders

## Components
- **Table** (Bootstrap) – responsive striped table
- **Button** – Details action button per row
- **Message** – error alert display
- **Loader** – loading spinner during fetch
- **LinkContainer** – wraps Details button for navigation

## User Actions
- **Click Details button**: Navigates to `/order/:id` to view full order details and manage payment/delivery status

## Edge Cases
- User not authenticated: Redirected to login on mount (guard in useEffect)
- User not admin: Redirected to login on mount
- Empty orders list: Table renders with no body rows
- Loading state: Spinner replaces table
- API error on initial fetch: Error message displayed, table hidden
- User name missing: Shows null or empty string (fallback: `order.user && order.user.name`)
- Unpaid order: Paid column shows red X icon
- Undelivered order: Delivered column shows red X icon
- Paid order: Paid column shows date (substring 0-10)
- Delivered order: Delivered column shows date (substring 0-10)
