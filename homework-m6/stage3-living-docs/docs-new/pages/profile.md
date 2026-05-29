> **TODO(audit-2026-05-29):** Routes / access rules / Redux slices / API calls remain accurate. The 'What Users See' / Components sections describe the old Bootstrap layout — verify against frontend/src/components/good-shop.
>
> _Marker added during M6 Stage 3 living-docs audit. Behavioural content below verified accurate; only the noted parts are stale._

# User Profile Screen

## Route
`/profile`

## Access
Authenticated users only. Redirects to login if not authenticated.

## What Users See
A two-column layout: left side contains a profile edit form (name, email, password fields) with an "Update" button and status messages; right side displays a "My Orders" table listing all orders placed by the user with columns for ID, date, total price, payment status, delivery status, and a "Details" button.

## State (Redux)
- `userDetails` slice: `loading`, `error`, `user` object (name, email, _id)
- `userLogin` slice: `userInfo` (used for access control)
- `userUpdateProfile` slice: `success` flag and loading/error states
- `orderListMy` slice: `loading`, `error`, `orders` array

## API Calls
- **On mount**: `GET /api/users/profile` via `getUserDetails('profile')` to fetch user data
- **On mount**: `GET /api/orders/myorders` via `listMyOrders()` to fetch user's orders
- **On form submit**: `PUT /api/users/profile` with `{ id, name, email, password }` via `updateUserProfile()` action

## Components
- **Form** (Bootstrap) – editable profile fields
- **Table** (Bootstrap) – responsive orders table
- **Message** – status messages (validation error, success, API error)
- **Loader** – loading spinner for initial data fetch and form submission
- **Button** (LinkContainer) – "Details" button linking to individual order

## User Actions
- **Edit name or email**: Updates local state
- **Enter new password**: Validates confirmation match before submitting
- **Click "Update"**: Submits updated profile to backend (only if passwords match)
- **Click "Details"**: Navigates to `/order/:id` to view order details

## Edge Cases
- Passwords don't match: Local validation message, form not submitted
- User not authenticated: Redirected to login (check in useEffect)
- Empty password field: Treated as no password change (backend logic)
- Profile update success: Message displayed, form remains editable
- Orders table empty: Shows empty table with no rows
- Order status: isPaid and isDelivered shown as date or red X icon
- Loading initial data: Both sections show spinners
- API error on orders fetch: Error message shown, orders table hidden
