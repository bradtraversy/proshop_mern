> **TODO(audit-2026-05-29):** Routes / access rules / Redux slices / API calls remain accurate. The 'What Users See' / Components sections describe the old Bootstrap layout — verify against frontend/src/components/good-shop.
>
> _Marker added during M6 Stage 3 living-docs audit. Behavioural content below verified accurate; only the noted parts are stale._

# Register Screen

## Route
`/register`, `/register?redirect=[page]` (optional redirect parameter)

## Access
Public. If already logged in, user is immediately redirected to the redirect URL or home.

## What Users See
A centered form container with heading "Sign Up" containing name, email, password, and confirm password input fields. A submit button labeled "Register" is below the form. Validation error (password mismatch) appears as a red alert. Below the form is a link to the login page.

## State (Redux)
- `userRegister` slice: `loading`, `error`, `userInfo` object (contains user data and token if registration succeeds)

## API Calls
- **On form submit**: `POST /api/users/register` with `{ name, email, password }` via `register()` action
- Response includes `userInfo` object with token, user is immediately logged in after successful registration

## Components
- **FormContainer** – centered form wrapper component
- **Message** – error alert display (password mismatch or API error)
- **Loader** – loading spinner during registration
- **Form** (Bootstrap) – text and password input fields with labels

## User Actions
- **Enter name, email, passwords**: Updates local state
- **Click "Register"**: Client validates password match; if OK, dispatches register action
- **Click "Login"**: Navigates to login page (with redirect if applicable)

## Edge Cases
- Passwords don't match: Local validation message shown, API call not made
- Missing fields: Form submission occurs, backend returns validation error
- Email already registered: API error displayed
- Loading state: Form fields remain enabled but should be disabled (UX issue)
- Redirect parameter missing: Defaults to home page (`/`)
- User already logged in: Redirects immediately before form renders
- Name field: Accepts any text (no email format validation)
- Auto-login after registration: User is logged in after successful signup
