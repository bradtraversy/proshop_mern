# ADR-008: `mcp-features` Server Runs Two Transports From One Codebase (stdio + StreamableHTTP)

**Status:** Proposed (drafted by architecture-mate during M6 stage-3 review, 2026-05-23)
**Date:** 2026-05-23
**Decision Makers:** TBD (PR author + tech lead)

---

## Context

The feature-flag MCP server (`mcp-features/index.js`) has two consumers with mutually incompatible transport requirements:

1. **Local developer agents (Claude Code, Cursor).** Spawn the server as a child process and talk JSON-RPC over stdin/stdout. No network, no auth, single in-memory session, dies when the agent dies.
2. **n8n workflows (M5 AutoPilot).** Run remotely. Need to reach the MCP server over the public internet via a Cloudflare Tunnel. Need bearer-token auth, session management across HTTP requests, and an Express HTTP surface.

The implementation chose to put both transports in **one file** with mode selection at boot:

```js
const mode = process.env.MCP_TRANSPORT
  || (process.argv.includes('--http') || process.argv.includes('--sse') ? 'http' : 'stdio')
;((mode === 'http' || mode === 'sse') ? runHttp() : runStdio()).catch(console.error)
```

The shared `createServer()` factory registers tools and resources once; each transport mode wires it into a different SDK transport. The HTTP mode additionally runs an Express app with:
- a Bearer-token middleware (`MCP_BEARER_TOKEN`),
- a per-session `StreamableHTTPServerTransport` pool keyed by the `mcp-session-id` header,
- `POST /mcp` for new sessions and JSON-RPC calls,
- `GET /mcp` and `DELETE /mcp` for SSE streaming and session teardown.

This decision was never written down. The trade-offs (one binary vs two, where auth lives, what "session" means in each mode) are scattered between code and `CLAUDE.md` operational notes.

---

## Decision

`mcp-features` ships as **one Node entry point that selects a transport from `MCP_TRANSPORT`**. The following invariants apply:

1. **Shared tool/resource registration.** `createServer()` is the single source of truth for MCP tools (`get_feature_info`, `set_feature_state`, `adjust_traffic_rollout`, `list_features`) and resources. Both transports call it. Adding a tool happens in one place.
2. **Transport-specific concerns stay in their own functions.** `runStdio()` does nothing but instantiate `StdioServerTransport` and connect. `runHttp()` owns Express, Bearer middleware, and session-pool bookkeeping. No tool logic in either.
3. **Auth surface differs by transport, intentionally.**
   - **stdio:** no auth. The OS owns the trust boundary (the agent that spawned the process). `MCP_BEARER_TOKEN` is ignored.
   - **http:** Bearer auth via `MCP_BEARER_TOKEN` is required for any public exposure (tunnel, prod). Empty token in HTTP mode means "auth disabled" — explicitly allowed for local testing without a tunnel, and a comment in code says so.
4. **Session lifecycle differs by transport, intentionally.**
   - **stdio:** one process = one session.
   - **http:** one process = many sessions, keyed by `mcp-session-id`, created by an `initialize` request, torn down by `DELETE /mcp` or transport `onclose`.
5. **Single write target.** Both transports write `backend/features.json` through the same `writeFeatures()` function. (Note: ADR-007 supersedes — both transports should call `PATCH /api/featureflags/:key` instead. This ADR records the transport decision; ADR-007 governs the storage decision.)

---

## Consequences

### Positive

- **One tool definition, two deployments.** No drift between what the local dev agent and the remote n8n agent can do.
- **Single dependency surface.** One `package.json`, one Dockerfile, one bug-fix release.
- **Operationally simple.** Local devs don't need to know about HTTP/auth; HTTP deployment doesn't need to bundle stdio paths separately.

### Negative / trade-offs

- **One file, many concerns.** `index.js` is 365 lines: tool registration + stdio + Express + Bearer middleware + session pool. The god-file shape is a maintenance smell (see ARCH-DELTA-06).
- **HTTP transport pulls Express into the stdio dependency tree.** Local agent spawns get a heavier process than they need.
- **Bearer-only auth is fragile.** No rate limit, no IP allowlist, no audit log. If the token leaks (or `MCP_BEARER_TOKEN=""` is shipped to prod), the entire flag store is world-writable.
- **The "empty token disables auth" rule is easy to ship by accident.** A missing env var in a prod compose file is indistinguishable from a deliberate dev override.

### Risks

- **HTTP mode in production without a Cloudflare Tunnel or `MCP_BEARER_TOKEN` set is a flag-store takeover.** This must be a CI/deploy invariant, not a code-review check. (See ADR-006 for the parallel concern on AutoPilot.)
- **The session-pool dict (`transports[sessionId]`) leaks if `onclose` doesn't fire.** Long-running HTTP mode in n8n must have a periodic session-pool size assertion in observability, or replace the in-memory dict with a TTL cache.
- **Mode-selection precedence is brittle.** `MCP_TRANSPORT` wins over CLI flags. An ops mistake that sets both to disagreeing values silently picks env. Document.

---

## Alternatives Considered

### Two separate binaries (mcp-features-stdio, mcp-features-http)

- **Pro:** stricter separation; stdio binary doesn't ship Express; cleaner dependency surface per binary.
- **Con:** duplicate tool registration (drift between local and remote agents); two CI pipelines; two Docker images; harder to keep schema parity.

**Rejected.** The drift cost outweighs the per-binary cleanliness for a 4-tool server.

### One binary, two `package.json` build targets (CommonJS for stdio, bundled for HTTP)

- **Pro:** shared source, separate artifacts.
- **Con:** build complexity not justified at this size.

**Rejected.**

### Drop stdio entirely, run HTTP only with localhost-only listener for dev

- **Pro:** one transport. Simpler reasoning.
- **Con:** Claude Code's `.mcp.json` spawn model is stdio-native; HTTP mode would require a sidecar process the agent doesn't manage. Worse DX.

**Rejected.**

### Drop HTTP, expose stdio MCP via a tunnel wrapper (e.g. `mcp-proxy`)

- **Pro:** one transport in our code.
- **Con:** stdio-over-HTTP wrappers exist (`@modelcontextprotocol/server-proxy`) but add a hop and a process per session. Same auth/session concerns, now in a third-party layer.

**Rejected** for v1; reconsider if/when the MCP SDK consolidates transport handling.

---

## Open Issues

- **Token hygiene.** A startup assertion `if (mode === 'http' && !process.env.MCP_BEARER_TOKEN) throw` should be added unless an explicit `MCP_ALLOW_UNAUTH=1` is set. Today the empty-token path is silent.
- **Layering.** ARCH-DELTA-06 (this review) recommends splitting `index.js` into `server.js` + `transports/stdio.js` + `transports/http.js`. This ADR keeps the decision (one binary, mode-selected) — the file layout is an implementation concern.
- **Audit log for HTTP mutations.** Currently no record of which n8n workflow flipped which flag. Wire into the structured-log work proposed in ADR-006.

---

## Current Assessment (May 2026)

Dual transport is the correct shape for a server with one local-agent consumer and one remote-orchestrator consumer. The implementation works; the gaps are: (a) the decision is undocumented (this ADR fixes), (b) the file is monolithic (ARCH-DELTA-06 follow-up), (c) auth disabled-on-empty-token is a foot-gun in prod (Open Issues). None of these are blockers; all should be tracked.
