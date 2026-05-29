> **TODO(audit-2026-05-29):** Routes / access rules / Redux slices / API calls remain accurate. The 'What Users See' / Components sections describe the old Bootstrap layout — verify against frontend/src/components/good-shop.
>
> _Marker added during M6 Stage 3 living-docs audit. Behavioural content below verified accurate; only the noted parts are stale._

# Login Screen

## Route
`/login`, `/login?redirect=[page]` (optional redirect parameter)

## Access
Public. If already logged in, user is immediately redirected to the redirect URL or home.

## What Users See
A centered form container with heading "Sign In" containing email and password input fields and a submit button. Below the form is a link to the registration page. Error messages appear as an alert if login fails.

## State (Redux)
- `userLogin` slice: `loading`, `error`, `userInfo` object (contains user data and token if authenticated)

## API Calls
- **On form submit**: `POST /api/users/login` with `{ email, password }` via `login()` action
- Response includes `userInfo` object with token

## Components
- **FormContainer** – centered form wrapper component
- **Message** – error alert display
- **Loader** – loading spinner during authentication
- **Form** (Bootstrap) – email and password input fields with labels

## User Actions
- **Enter email and password**: Updates local state
- **Click "Sign In"**: Validates inputs and dispatches login action
- **Click "Register"**: Navigates to registration page (with redirect if applicable)

## Edge Cases
- Empty fields: Form submission still occurs; backend validates and returns error
- Wrong credentials: Error message displayed below loader
- Loading state: Submit button remains enabled (UX issue, but functional)
- Network error: Generic error message from API
- Redirect parameter missing: Defaults to home page (`/`)
- User already logged in: Redirects immediately before form renders
- Invalid email format: No client-side validation, backend handles
- Password field: Masked input for security
