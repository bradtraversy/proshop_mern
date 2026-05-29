> **TODO(audit-2026-05-29):** Routes / access rules / Redux slices / API calls remain accurate. The 'What Users See' / Components sections describe the old Bootstrap layout — verify against frontend/src/components/good-shop.
>
> _Marker added during M6 Stage 3 living-docs audit. Behavioural content below verified accurate; only the noted parts are stale._

# Admin User Edit Screen

## Route
`/admin/user/:id/edit`

## Access
Admin users only. Non-admin users and unauthenticated users are redirected to login.

## What Users See
A form to edit user details with a "Go Back" button at the top returning to the users list. The form contains three fields: Name (text input), Email Address (email input), and Is Admin (checkbox). An "Update" button submits changes.

On successful update, user is redirected back to the users list and a success message is briefly shown.

## State (Redux)
- `userDetails` slice: `loading`, `error`, `user` object (fetched data)
- `userUpdate` slice: `loading`, `success`, `error` for update action

## API Calls
- **On mount**: `GET /api/users/:id` via `getUserDetails(userId)` action to fetch user data
- **On form submit**: `PUT /api/users/:id` with `{ _id, name, email, isAdmin }` via `updateUser()` action

## Components
- **FormContainer** – centered form wrapper
- **Form** (Bootstrap) – text inputs for name/email, checkbox for admin status
- **Message** – error or loading messages
- **Loader** – loading spinner during fetch or update
- **Button** – submit button and "Go Back" navigation button

## User Actions
- **Edit name, email**: Updates local state on input change
- **Toggle Is Admin checkbox**: Sets isAdmin boolean state
- **Click "Update"**: Dispatches updateUser action with changed values
- **Click "Go Back"**: Navigates back to `/admin/userlist`

## Edge Cases
- User not authenticated: Redirected to login on mount
- User not admin: Redirected to login on mount
- User ID not found: Error message displayed, form hidden
- Loading initial user data: Spinner shown, form hidden
- Update error: Error message displayed, form remains editable
- Successful update: User redirected to users list, state reset
- Form pre-population: Initial state loaded from fetched user data
- Email field: No format validation, accepts any text
- Name field: Required (no validation), accepts any text
