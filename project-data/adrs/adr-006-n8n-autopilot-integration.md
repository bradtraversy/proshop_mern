# ADR-006: Server-Side Proxy for n8n AutoPilot Webhook Integration

**Status:** Proposed (drafted by architecture-mate during M6 stage-1 review, 2026-05-23)
**Date:** 2026-05-23
**Decision Makers:** TBD (PR author + tech lead)

---

## Context

The ProShop AutoPilot feature lets administrators trigger n8n workflows (e.g. feature-flag automation, scheduled monitors) from the React admin UI. The n8n instance is authenticated by an `X-API-Key` header — the same key that, if leaked, lets any caller drive any workflow on the n8n tenant. The original design considered three options:

1. **Call n8n directly from the browser** with the API key embedded in the React bundle. Rejected: trivially exfiltrated.
2. **Call n8n directly from the browser using a short-lived signed token issued by the backend.** Rejected as v1: requires both an issuer endpoint and changes on the n8n side to validate the signature.
3. **Server-side proxy** (`POST /api/autopilot/feature-control` → backend → n8n with `X-API-Key`). Chosen — the browser never sees the secret.

The proxy was added in M5 alongside the AutoPilot workflows but **the decision was never recorded**. As a result, several invariants the proxy depends on were not enforced in code at the time of the M6 review:

- The proxy route had no `protect` / `admin` middleware, defeating the entire reason for the proxy (security review HIGH item, SEC-7).
- The forwarded request body had no schema validation or size cap (SSRF / payload-amplification surface, SEC-17).
- A 110-second `AbortSignal.timeout` was chosen without an explicit rationale.

This ADR captures the decision and the invariants that follow from it.

---

## Decision

The backend exposes a single proxy route, `POST /api/autopilot/feature-control`, that forwards admin-issued AutoPilot commands to the n8n webhook. The proxy is the **only** path by which the browser can reach n8n. The following invariants are part of the decision:

1. **Authentication.** The route is gated by `protect` + `admin` middleware. Anonymous and non-admin authenticated callers receive 401/403 before any upstream call is made.
2. **Secret containment.** `N8N_WEBHOOK_URL` and `N8N_API_KEY` are read from `process.env` and never embedded in the frontend bundle. The frontend issues to the proxy using the user's JWT only.
3. **Schema validation.** The request body is validated by a Zod schema (see proposed ADR-007 / project-wide validation layer). The backend rejects unknown fields rather than forwarding them.
4. **Timeout policy.** The upstream call is bounded by a single configurable timeout (default 30s, currently 110s — to be revisited; see Open Issues). On timeout the proxy returns 504. On any other upstream error it returns 502.
5. **Response pass-through.** The proxy parses the upstream response as JSON if possible, otherwise wraps it as `{ success, message }`. The HTTP status returned to the browser is the upstream HTTP status.
6. **Single integration point.** Any future AutoPilot endpoint goes through the same proxy module (extracted as `backend/services/n8nClient.js` per ARCH-05) — not as ad-hoc fetches scattered across routes.

---

## Consequences

### Positive

- **`N8N_API_KEY` cannot leak through the browser.** The only way to obtain it is to compromise the backend host's environment.
- **Auth, rate-limit, and audit logging happen in one place.** Every n8n-bound action is an authenticated admin action with a user identity attached, which means we can log who pressed the button.
- **Allows n8n to be moved or rotated without frontend changes.** Endpoint URL and API key live in backend env.

### Negative / trade-offs

- **The backend now owns a long-running HTTP holder.** A 30s+ proxy call holds an Express worker and a TCP socket per request. Under load this is a worse pattern than a job queue.
- **Adds a hop.** Any n8n latency is added to the user's HTTP request latency.
- **The proxy becomes a target.** All the auth/validation/SSRF surface that would have been on n8n is now on our backend.

### Risks

- If `protect`/`admin` is ever removed (or forgotten on a new AutoPilot route), the API key becomes a worldwide-callable webhook trigger. This must be a CI-checked invariant, not a code-review check.
- If the upstream timeout is too long (today: 110s), a malicious or buggy n8n response can pin Express workers and DoS the backend.

---

## Alternatives Considered

### Browser → n8n direct with short-lived signed token

The backend issues a 60-second HMAC-signed token (user id, action, expiry) and the browser calls n8n with it. n8n validates the signature.

**Rejected for v1:** requires n8n-side validation logic and a shared signing key. Operational complexity is higher than a proxy for the volumes this app handles. Worth revisiting if AutoPilot endpoints multiply.

### Job queue (BullMQ / Cloudflare Queues) with backend enqueuing and n8n dequeuing

Backend enqueues a job; n8n polls or subscribes. Decouples request timing from upstream availability.

**Rejected for v1:** infrastructure addition (Redis), and the current AutoPilot UX expects a synchronous response within a few seconds. A queue is the right pattern if AutoPilot workflows become genuinely long-running.

### Cloudflare Worker / serverless function as the proxy

Same shape, runs outside the backend process so a slow n8n doesn't hold Express workers.

**Rejected for v1:** adds a deployment target. Marginal benefit until AutoPilot traffic is non-trivial.

---

## Open Issues

- **Timeout value.** 110s is suspicious; either the n8n workflow is genuinely that slow (in which case use a queue), or the timeout is a copy-paste accident. Decide 30s vs queue.
- **Validation schema.** Currently `req.body` is forwarded verbatim. Once project-wide validation lands (ARCH-10), wire a Zod schema for the AutoPilot payload shape.
- **Audit log.** Today there is no structured log of "admin X triggered AutoPilot Y at time Z". Add as part of the validation/middleware work.

---

## Current Assessment (May 2026)

The proxy pattern itself is the correct choice for v1. The implementation gaps (no auth on the route, unbounded body, long timeout, no validation) are all consequences of the decision never being written down. Recording this ADR makes the invariants reviewable in CI rather than re-derivable on each PR.
