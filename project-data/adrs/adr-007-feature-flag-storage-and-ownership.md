# ADR-007: Feature-Flag Storage — `backend/features.json` is Backend-Owned

**Status:** Proposed (drafted by architecture-mate during M6 stage-1 review, 2026-05-23)
**Date:** 2026-05-23
**Decision Makers:** TBD (PR author + tech lead)

---

## Context

ProShop introduced feature flags in M3–M4. A single JSON file, `backend/features.json`, holds the canonical flag state (`status`, `traffic_percentage`, `dependencies`, `last_modified`, `targeted_segments`, `rollout_strategy`). The file is currently mutated by **three independent processes**:

1. **Backend Express** — `backend/routes/featureFlagRoutes.js` exposes `GET /api/featureflags` (anonymous) and `PATCH /api/featureflags/:key` (admin). Writes via `fs/promises` tmp+rename.
2. **`mcp-features` (stdio)** — local MCP server spawned by Claude Code / Cursor. Mutates via `writeFileSync`.
3. **`mcp-features` (HTTP)** — same code as #2, running in Docker, reachable via Cloudflare Tunnel for n8n. Also `writeFileSync`.

The backend additionally **reads** the file via `backend/utils/featureFlag.js` with a 5-second TTL in-memory cache, and the frontend reads it via Redux (`loadFeatureFlags`).

This is the state today. It was never written down as a decision. The consequences observed in the M6 review:

- **No cross-process lock.** Concurrent writers can clobber each other. The atomic tmp+rename in the REST route is atomic at the filesystem level but is not a mutex against the MCP writers. Security review SEC-16 and performance review MED-4 both surface this.
- **Three independent implementations of the validation rules.** `VALID_STATUSES`, the "Testing fallback 10" default, and the `last_modified` date format are reified in three places with subtle differences (ARCH-16).
- **Three independent I/O styles.** Sync vs async; with/without atomic rename; with/without `__proto__` allow-list on the key (ARCH-15).
- **No schema.** The file is plain JSON; the implicit shape exists only in code. Adding a new field is a multi-file change.

The team needs to decide: is `features.json` a database that happens to be a file, or is it a shared spreadsheet that anyone can edit?

---

## Decision

`backend/features.json` is treated as **backend-owned application state**, not a shared file. The following invariants are part of the decision:

1. **Single source of truth.** `backend/features.json` is the canonical flag state. The frontend and the MCP servers are clients.
2. **Single write path in process.** Inside the backend Node process, all reads and writes go through `backend/utils/featureFlag.js` (extended to expose `getAllFlags`, `updateFlag(key, patch)`, with cache invalidation on write). The route file becomes a thin controller.
3. **Single write path across processes.** The MCP servers do **not** write the file directly. They call the backend REST API (`PATCH /api/featureflags/:key`) authenticated with a service token. This collapses three writers to one and removes the cross-process race.
4. **Schema.** A Zod schema (in `backend/utils/featureFlag.js`) defines the shape of a flag. Both the REST PATCH validator and the MCP tool input validator import the schema. No more drift between MCP `set_feature_state` and REST `PATCH`.
5. **Atomic write.** All writes use the tmp+rename idiom currently in the REST layer.
6. **Cache invalidation.** Backend cache (5s TTL) is invalidated on every write. Frontend reloads via the existing `loadFeatureFlags` dispatch — already triggered on app mount and admin actions.
7. **Key allow-list.** Flag keys must match `^[a-z][a-z0-9_]{0,63}$`. `__proto__`, `constructor`, `prototype` are rejected at the validator (security SEC-MED prototype-pollution note).

If, in the future, traffic or operational requirements outgrow a JSON file (e.g. need for per-user targeting, audit trail, A/B analytics), the storage backend changes to a real datastore. The module API (`getAllFlags`, `updateFlag`) stays stable; callers do not change.

---

## Consequences

### Positive

- **No cross-process race.** MCP→REST means there is exactly one writer.
- **One schema.** Adding `description_html` or `rollout_segments` is a single-line schema change instead of three.
- **CI-checkable invariants.** "No code outside `backend/utils/featureFlag.js` reads or writes `features.json`" is a one-line grep in CI.
- **Storage backend can evolve.** Swapping JSON for Mongo, Redis, or a SaaS feature-flag provider (LaunchDarkly, Unleash) is a module-internal change.
- **Removes the architectural inconsistency** between sync fs in MCP and async tmp+rename in REST (ARCH-03, perf HIGH-5).

### Negative / trade-offs

- **MCP servers now depend on the backend being up to write.** Today they can mutate the file with backend offline. After this ADR, an MCP write requires backend on `localhost:5001`. For the stdio MCP (developer machine) this is fine; for the HTTP MCP in Docker the compose file already starts backend first.
- **Adds an HTTP hop for MCP writes.** Marginal — milliseconds — and the file-based path was sync I/O anyway.
- **Requires a service-token auth scheme for the MCP→backend call.** Either reuse the `MCP_BEARER_TOKEN` pattern with a backend-side validator, or issue an admin JWT to the MCP process via env.

### Risks

- **Backwards compatibility during rollout.** If an MCP server upgrades to ADR-007 behaviour and the backend doesn't, MCP writes fail. Roll the backend first.
- **Future temptation to read-direct.** A contributor who does not know about this ADR will write `JSON.parse(readFileSync('features.json'))` to "just check a flag in a script". The CI grep mitigates.

---

## Alternatives Considered

### Status quo — three writers, no shared module

Reject. Already produces lost-update bugs (race) and three-way validator drift (ARCH-16). Documented only for completeness.

### Shared in-process module, three writers still

(`@proshop/feature-flags` npm-style package consumed by both backend and MCP, both writing the file with `proper-lockfile`.)

Better than status quo, worse than ADR-007:
- Still has three writers, just with a lock. Lock files on Docker bind-mounts have known correctness issues.
- Validator drift solved; cross-process correctness only solved if `proper-lockfile` works correctly on every host filesystem (it does not on some FUSE / network FS setups).
- Two writers of a database is still architecturally weird.

Rejected as worse than centralising the writer in the backend.

### Promote `features.json` to a Mongo collection

Eliminates the file entirely. Reads become Mongo queries; writes become updates. Compatible with the rest of the stack (ADR-001).

**Deferred, not rejected.** Worth doing if/when:
- Flags need per-user targeting at scale (the JSON file approach is already strained at ~10 flags × `targeted_segments`).
- An audit log of who changed what when becomes a requirement.
- Multi-region or multi-instance deployment happens (a JSON file on disk does not survive horizontal scaling).

For now the JSON file is small enough that a Mongo migration is not yet justified — but ADR-007's module boundary makes the migration mechanical when the time comes.

### SaaS feature-flag provider (LaunchDarkly, Unleash, ConfigCat)

The "real" answer for a production app. Provides targeting, audit, A/B, kill-switch propagation, SDKs. Cost: USD per seat or per MAU.

**Deferred.** Project is educational; cost is not justified. ADR-007's module boundary keeps the door open.

---

## Open Issues

- **MCP→backend auth scheme.** Choose between (a) reusing `MCP_BEARER_TOKEN` with a backend-side validator endpoint, or (b) issuing a long-lived admin JWT to the MCP process. (a) is cleaner and aligned with ADR-006's secret-containment principle.
- **Frontend cache strategy.** Currently the frontend re-fetches flags on app mount. With single-writer semantics we could add a server-sent-event channel for instant propagation — out of scope for v1 of this ADR.

---

## Current Assessment (May 2026)

The current implementation accidentally works because traffic is low and no two admins click "save" within the same 50ms window. Under any concurrency — a scheduled n8n monitor changing flags while an admin patches via REST while a developer's local MCP rewrites the file — silent lost updates are inevitable. Recording this ADR and lifting the writer to a single module is the lowest-effort fix that also makes future evolution (Mongo, SaaS) a mechanical refactor.
