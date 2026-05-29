# Stateless JWT Authentication with Client-Side Token Storage

## Status

Accepted

## Context and Problem Statement

The application needs to authenticate users for protected operations (placing orders, writing reviews, admin management). The backend is a stateless Express API consumed by a React SPA — the auth mechanism must work across page reloads without server-side session affinity, and must carry user identity in every API request.

## Considered Options

1. **Stateless JWT in `Authorization: Bearer` header, persisted in `localStorage`** — issue a long-lived token at login, store it on the client, attach it to every request.
2. **Server-side sessions with `express-session` + MongoDB session store (`connect-mongo`)** — store session ID in an HTTP-only cookie, keep session data server-side.
3. **OAuth 2.0 / Passport.js** — delegate identity to an external provider or use Passport's local strategy with session or token support.
4. **Short-lived access token + refresh token pair** — issue a short-lived JWT (15 min) alongside a long-lived refresh token stored in an HTTP-only cookie; auto-refresh on expiry.

## Decision Outcome

Option 1 — stateless JWT with `localStorage`.

Tokens are signed with a single secret (`JWT_SECRET`) and have a 30-day expiry. The backend has no session store, no refresh endpoint, and no token blacklist. On the frontend, `userInfo` (including the token) is persisted to `localStorage` and rehydrated into the Redux store on page load. Logout simply removes the `localStorage` entry — the token remains valid until it expires.

This was likely chosen for simplicity: no session infrastructure, no cookie management, and straightforward header-based auth that works identically in development (CRA proxy) and production (same-origin Express).

## Consequences

**Positive:**
- Zero server-side state — the backend is fully stateless and horizontally scalable without sticky sessions.
- Simple implementation — three files cover the entire auth flow.
- Works naturally with the CRA proxy in development and same-origin serving in production.

**Negative:**
- 30-day tokens cannot be revoked. If a token is leaked, it remains valid until expiry. A logout on one device does not invalidate sessions on other devices.
- `localStorage` is accessible to any JavaScript on the page — an XSS vulnerability would expose the token. HTTP-only cookies would mitigate this.
- No refresh mechanism — users are silently logged out after 30 days with no graceful re-authentication.
- Frontend detects token failure by matching the error string `'Not authorized, token failed'` — a brittle coupling between backend error messages and frontend logout logic.

## Confidence

**HIGH** — The pattern is explicit: `jsonwebtoken` is the only auth dependency, `localStorage` persistence is visible in `store.js` and all action files, and there is no session middleware or refresh endpoint anywhere in the codebase.

## Evidence

- `backend/utils/generateToken.js` — `jwt.sign({ id }, JWT_SECRET, { expiresIn: '30d' })`
- `backend/middleware/authMiddleware.js` — extracts `Bearer` token from header, verifies with `jwt.verify`, loads user from DB
- `backend/controllers/userController.js` — `generateToken(user._id)` called in `authUser`, `registerUser`, `updateUserProfile`
- `frontend/src/store.js` — `localStorage.getItem('userInfo')` parsed into `initialState.userLogin`
- `frontend/src/actions/userActions.js` — `localStorage.setItem('userInfo', ...)` on login; `localStorage.removeItem` on logout; `Authorization: Bearer ${userInfo.token}` header in requests
- `package.json` — no `express-session`, `connect-mongo`, `passport`, or `@paypal/checkout-server-sdk`
