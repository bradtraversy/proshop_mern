> **TODO(audit-2026-05-29):** Routes / access rules / Redux slices / API calls remain accurate. The 'What Users See' / Components sections describe the old Bootstrap layout — verify against frontend/src/components/good-shop.
>
> _Marker added during M6 Stage 3 living-docs audit. Behavioural content below verified accurate; only the noted parts are stale._

# Admin Users List Screen

## Route
`/admin/userlist`

## Access
Admin users only. Non-admin users and unauthenticated users are redirected to login.

## What Users See
A table listing all users in the system with columns: ID, Name, Email (clickable mailto link), Admin status (checkmark or X icon), and action buttons (Edit, Delete). Each row represents one user. A heading "Users" appears above the table.

## State (Redux)
- `userList` slice: `loading`, `error`, `users` array
- `userLogin` slice: `userInfo` (used for admin access control)
- `userDelete` slice: `success` flag (triggers refetch on delete)

## API Calls
- **On mount**: `GET /api/users` via `listUsers()` action to fetch all users
- **On delete button click**: `DELETE /api/users/:id` via `deleteUser(id)` action

## Components
- **Table** (Bootstrap) – responsive striped table
- **Button** – edit and delete action buttons per row
- **Message** – error alert display
- **Loader** – loading spinner during fetch
- **LinkContainer** (from react-router-bootstrap) – wraps edit button for navigation

## User Actions
- **Click Edit button**: Navigates to `/admin/user/:id/edit`
- **Click Delete button**: Shows confirmation dialog; if confirmed, dispatches deleteUser action
- **Confirmation dialog**: Native `window.confirm()` prompt

## Edge Cases
- User not authenticated: Redirected to login on mount (guard in useEffect)
- User not admin: Redirected to login on mount
- Empty users list: Table renders with no body rows
- Delete error: Error message displayed
- Delete success: Table refreshes automatically (successDelete dependency triggers refetch)
- Loading state: Spinner replaces table
- API error on initial fetch: Error message displayed, table hidden
- User is himself: Can still delete own account (no safety guard in UI)
