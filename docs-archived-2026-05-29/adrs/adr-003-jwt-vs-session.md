# ADR-003: Use JWT Tokens for Authentication (Stateless)

**Status:** Accepted
**Date:** 2023-03-10
**Decision Makers:** Engineering team

---

## Context

The ProShop API (Express) needed an authentication mechanism. The backend serves both the React frontend (browser-based) and was designed to potentially serve mobile clients in the future. The team was building on a single Express server with no shared in-memory store (no Redis at the time).

The choice was between stateless authentication (JWT stored on the client) and stateful authentication (server-side sessions stored in a database or cache). Both approaches are well-understood; the decision came down to operational trade-offs given the team's deployment constraints.

The application at the time was running on a single Heroku dyno (later Render.com instance). No session store infrastructure existed.

---

## Decision

Use **JSON Web Tokens (JWT)** for authentication. On successful login or registration, the server signs a JWT with the user's ID and `isAdmin` flag, using a secret from the `JWT_SECRET` environment variable. The token is returned to the client and stored in `localStorage`. All subsequent authenticated requests include the token in the `Authorization: Bearer <token>` header.

The backend validates the token in the `protect` middleware via `jsonwebtoken.verify()`. Admin-only routes additionally check the `isAdmin` field decoded from the token.

Token expiry: 30 days (configured as `'30d'` in `jwt.sign()`).

---

## Consequences

### Positive

- **Stateless — no session store required.** The backend does not need to maintain any session state. Each request is self-contained: the token carries the user identity and the server validates it cryptographically. This simplifies the server architecture and eliminates a dependency on a session store (Redis, database-backed sessions, etc.).
- **Horizontal scaling is straightforward.** Any instance that has the `JWT_SECRET` can validate any token. If the application were to run multiple instances (load balanced), no session affinity or shared session store is required.
- **Works naturally for API clients.** The `Authorization: Bearer` pattern is standard for REST APIs and works identically for browsers, mobile apps, and server-to-server calls. No cookie handling required.
- **Implementation is simple.** `jsonwebtoken.sign()` and `jsonwebtoken.verify()` cover the full lifecycle. The middleware is ~15 lines and easy to reason about.

### Negative

- **No server-side session revocation.** If a JWT is stolen, the server cannot invalidate it before its expiry. The only options are: (1) rotate the `JWT_SECRET` (invalidates ALL sessions for all users), or (2) wait for the token to expire. This was exercised forcibly during Incident i-003 — all user sessions were invalidated as a side effect of secret rotation.
- **Token stored in `localStorage` is XSS-vulnerable.** `localStorage` is accessible to JavaScript. A successful XSS attack can steal the token. `HttpOnly` cookies are immune to JavaScript access. This tradeoff was accepted given the application does not process highly sensitive data, but it is a real security weakness.
- **Token contains `isAdmin` flag.** The admin status is baked into the token at issue time. If a user's admin status changes (promoted or demoted), the change does not take effect until the user's token expires and they re-login. The current expiry is 30 days, meaning a demoted admin retains admin JWT claims for up to 30 days.
- **30-day expiry is long.** A longer-lived token increases the exposure window if stolen. The tradeoff was user convenience (not requiring frequent re-login) over security. A more robust implementation would use short-lived access tokens (15 minutes) + long-lived refresh tokens stored in HttpOnly cookies.

---

## Alternatives Considered

### Express-Session with MongoDB Session Store (`connect-mongo`)

Server-side sessions stored in MongoDB. On each request, the session ID (in a cookie) is used to look up the session document and retrieve the user identity.

**Advantages over JWT:**
- Immediate revocation: delete the session document and the user is logged out instantly
- No sensitive data travels with every request
- `HttpOnly` + `Secure` + `SameSite` cookies are XSS-resistant

**Disadvantages:**
- Adds a DB round-trip on every authenticated request (though this can be mitigated with Redis caching)
- Requires cookie handling (CSRF considerations)
- Session store is a stateful dependency that must be available for auth to work

**Reason not chosen:** The team prioritized simplicity and the absence of a session store dependency. Given the deployment (single instance, low traffic), the scaling argument for JWT was theoretical rather than practical. The session approach would have provided better security properties.

### Passport.js (with local strategy)

Passport is an authentication middleware that abstracts the strategy (local username/password, OAuth, JWT, etc.). It supports both session-based and token-based flows.

**Reason not chosen:** Passport adds abstraction over the auth flow that the team found unnecessary for the straightforward username/password + JWT use case. The `jsonwebtoken` + custom `protect` middleware approach is more explicit and easier to debug.

### OAuth / Social Login Only

Delegating authentication entirely to a third party (Google, GitHub). Eliminates the need to handle passwords, sessions, or tokens internally.

**Reason not chosen:** Requires users to have external accounts. Adds OAuth callback flow complexity. For a self-contained e-commerce demo, the standalone auth approach was appropriate.

---

## Open Issues

- **Refresh token pattern not implemented.** The 30-day single-token approach is a known limitation. A v3.0 candidate task is to implement short-lived access tokens (15 minutes, in memory) + long-lived refresh tokens (30 days, HttpOnly cookie). This would address both the revocation problem and the XSS vulnerability.
- **Admin flag staleness.** The `isAdmin` claim in the JWT is only updated on re-login. A database check on admin-required endpoints (`await User.findById(req.user._id).select('isAdmin')`) would ensure real-time admin status at the cost of a DB round-trip per admin request. Not currently implemented.

---

## Current Assessment (April 2026)

The JWT approach works correctly for the current use case. The known limitations (no revocation, localStorage storage, long expiry) are accepted technical debt. For a higher-security context (payment processing platform, healthcare data), the session + HttpOnly cookie approach would be required. The planned v3.0 refresh token implementation will address the most critical limitations.
