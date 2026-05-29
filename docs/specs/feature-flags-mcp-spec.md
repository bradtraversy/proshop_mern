# Overview

`mcp-server-feature-flags/src/index.ts` is a Node/TypeScript **MCP (Model Context Protocol) server** that exposes the ProShop feature-flag registry to an LLM client over **stdio**. It is a file-backed CRUD layer over a single JSON document, `backend/features.json`, resolved relative to the module via `resolve(__dirname, "..", "..", "backend", "features.json")`. The same file is independently read and written by the Express backend (`backend/controllers/featureFlagController.js`), making this a **dual-writer store with no locking** (Stage-1 finding, proposed ADR-0005).

**Tools exposed (4):**

- **`list_features`** — no input. Loads the DB and returns a JSON array of `{key, name, status, traffic_percentage}` for every feature. A lightweight overview.
- **`get_feature_info`** — input `feature_name` (string). Returns full metadata for one feature plus a resolved `depends_on` array of `{key, name, status}`. Returns an `isError` text result listing available keys if the feature is missing.
- **`set_feature_state`** — input `feature_name`, `state` (Zod enum `Enabled|Disabled|Testing|Shadow`). Business rule: **cannot set `Enabled` if any dependency is missing or `Disabled`** (returns `isError`). Side effects: sets `status`, stamps `last_modified` to today's UTC date, and **forces `traffic_percentage` to 0 when the new state is `Disabled`**. Persists the whole DB.
- **`adjust_traffic_rollout`** — input `feature_name`, `percentage` (Zod int 0–100). Business rule: **cannot set `percentage > 0` while status is `Disabled`** (hard lock, returns `isError`). Side effects: sets `traffic_percentage`, stamps `last_modified`, persists.

**Resource exposed (1):** `server://status` — returns `{status:"ok", uptime}` JSON (health check).

**Data assumptions about `features.json`:** a flat object keyed by snake_case feature key; each value is a `Feature` with `name`, `description`, `status` (one of the 4-enum), `traffic_percentage` (number), `last_modified` (ISO date string `YYYY-MM-DD`), `targeted_segments` (string[]), `rollout_strategy` (string), and optional `dependencies` (string[] of feature keys).

**Invariants (intended, not all enforced):** a `Disabled` feature has `traffic_percentage` 0; an `Enabled` feature has all dependencies non-`Disabled`. **These invariants are NOT enforced on existing data** — they only hold for records this server mutates. The on-disk file already violates them (e.g. `recently_viewed` is `Disabled` with `traffic_percentage: 100`; `search_v2` is `Disabled` with `traffic_percentage: 53`).

---

## Decision Table

| # | Condition | Then-action | Else-action | Edge case |
|---|-----------|-------------|-------------|-----------|
| 1 | `loadFeatures()` reads file (any tool) | `JSON.parse` raw, cast to `FeaturesDB` | — (no else; throws on failure) | Missing/locked file or malformed JSON throws an uncaught error inside the async handler — surfaced to the MCP client as a tool failure, no graceful message |
| 2 | `get_feature_info`: `db[feature_name]` is falsy | Return `isError` text listing available keys | Build and return full feature result | Key collides with a JS prototype name (`__proto__`, `constructor`) may resolve a non-feature object |
| 3 | `get_feature_info`/`set`/`adjust`: feature has `dependencies` | `resolveDependencies` maps each dep to `{key,name,status}` | Return `[]` (no `dependencies` field) | A dependency key not present in DB → `{name: dep, status: "Unknown"}` |
| 4 | `set_feature_state`: `db[feature_name]` is falsy | Return `isError` "not found" + available keys | Proceed to dependency check | Same prototype-key collision risk as row 2 |
| 5 | `set_feature_state`: `state === "Enabled"` AND `feature.dependencies` exists | Compute `disabledDeps` (missing OR `status === "Disabled"`) | Skip dependency check entirely | Feature with no `dependencies` key can be Enabled with zero validation |
| 6 | `set_feature_state`: `disabledDeps.length > 0` | Return `isError` listing blocking deps; **no write** | Apply the state change | Only checks direct deps — **transitive deps not validated** (e.g. enabling X whose dep is Enabled but that dep's own dep is Disabled) |
| 7 | `set_feature_state`: passes guards | Set `feature.status = state`, stamp `last_modified` | — | — |
| 8 | `set_feature_state`: `state === "Disabled"` | Also force `feature.traffic_percentage = 0` | Leave `traffic_percentage` unchanged | Setting `Testing`/`Shadow` does NOT touch traffic, so a feature can sit in `Testing` at 100% |
| 9 | `set_feature_state`: enabling a feature whose dep was just changed by backend | Reads current on-disk dep status | — | TOCTOU: backend may flip a dep to `Disabled` between this read and write → lost-update / stale validation |
| 10 | `adjust_traffic_rollout`: `db[feature_name]` is falsy | Return `isError` "not found" | Proceed to lock check | — |
| 11 | `adjust_traffic_rollout`: `percentage > 0` AND `status === "Disabled"` | Return `isError` (hard lock); **no write** | Apply the percentage | `percentage === 0` is always allowed regardless of status (used to "pause") |
| 12 | `adjust_traffic_rollout`: passes lock | Set `traffic_percentage = percentage`, stamp `last_modified`, save | — | No guard that status `Enabled`/`Testing`/`Shadow` is sensible for the % value |
| 13 | Any mutating tool calls `saveFeatures` | `writeFileSync` full DB pretty-printed + trailing `\n` | — | Synchronous write blocks the event loop; non-atomic — crash mid-write truncates/corrupts file |
| 14 | Zod input validation (`set`: enum, `adjust`: int 0–100) | Reject out-of-enum / out-of-range before handler runs | Handler executes | Backend writer accepts only `Enabled|Testing|Disabled` (no `Shadow`) → divergent contracts; backend `Number()`-coerces % and allows non-integers |
| 15 | `nowDate()` / `last_modified` stamping | Uses `new Date().toISOString().split("T")[0]` (UTC date) | — | Near UTC midnight, `last_modified` can be "tomorrow" relative to local time; existing records keep their original (possibly older) stamps |

---

## Sequence Diagram

```mermaid
sequenceDiagram
    autonumber
    participant Client as LLM / MCP Client
    participant Server as MCP Server (index.ts)
    participant FS as features.json (disk)
    participant Backend as Express Backend (other writer)

    Note over Client,Backend: Main flow — set_feature_state to "Enabled"
    Client->>Server: call set_feature_state {feature_name, state:"Enabled"}
    Server->>Server: Zod validates state in enum
    Server->>FS: readFileSync + JSON.parse (loadFeatures)
    FS-->>Server: FeaturesDB
    Server->>Server: lookup db[feature_name]
    alt feature has dependencies
        Server->>Server: filter deps where missing or status=="Disabled"
        Note right of Server: only direct deps checked
    end
    Server->>Server: set status, stamp last_modified
    Server->>FS: writeFileSync(full DB) (saveFeatures)
    Server->>Server: resolveDependencies for response
    Server-->>Client: JSON {key,name,status,traffic_percentage,last_modified,depends_on}

    Note over Client,Backend: Error path — enable blocked by Disabled dependency
    Client->>Server: call set_feature_state {feature_name, state:"Enabled"}
    Server->>FS: readFileSync + JSON.parse
    FS-->>Server: FeaturesDB
    Server->>Server: disabledDeps.length > 0
    Server-->>Client: isError text "Cannot enable: dependencies [...] are Disabled"
    Note right of Server: NO write performed; file unchanged
```

---

## Edge Cases

1. **Concurrent write with backend (lost update):** backend's `updateFeatureFlag` and this server both do read-modify-write on the same file with no lock. Interleaving (`MCP read → backend read → MCP write → backend write`) silently discards the MCP write.
2. **Partial / torn write:** `writeFileSync` is non-atomic. A crash, disk-full, or signal mid-write leaves a truncated file; the next `loadFeatures()` from either writer throws on `JSON.parse`.
3. **Malformed `features.json`:** any syntactically invalid JSON makes `loadFeatures()` throw; the error is uncaught in the handler and surfaces as a generic tool failure with no actionable message and no available-keys list.
4. **Invalid status enum divergence:** MCP accepts `Shadow`; backend rejects it (`Enabled|Testing|Disabled` only). A feature set to `Shadow` via MCP cannot then be edited via the backend PUT without first leaving `Shadow`.
5. **Dependency on a non-existent key:** `resolveDependencies` returns `{status:"Unknown"}` for it; `set_feature_state` treats missing deps as blocking (good), but `get_feature_info` happily reports `Unknown` with no warning.
6. **Transitive dependency not validated:** enabling A (dep B Enabled) succeeds even if B's own dep C is Disabled — the invariant "Enabled feature's chain is fully enabled" is not guaranteed.
7. **Pre-existing invariant violations:** on-disk data already has `Disabled` features with non-zero traffic (`recently_viewed` 100, `search_v2` 53). The server never repairs these; they persist through unrelated edits.
8. **`traffic_percentage` left high on non-Disabled transition:** moving a feature to `Testing` or `Shadow` keeps whatever traffic value existed, so a "Testing" feature can serve 100% traffic.
9. **`adjust_traffic_rollout` allows 0% on Disabled:** `percentage === 0` bypasses the lock, but setting status remains a separate operation — no coupling enforced.
10. **Prototype-pollution / reserved-key lookup:** `db[feature_name]` with `feature_name = "__proto__"` or `"constructor"` may return a truthy non-Feature object, leading to undefined-field reads or surprising mutations on save.
11. **Malicious / reflected input:** `feature_name` is echoed verbatim in error text (`Feature '<input>' not found`). Combined with `Object.keys(db).join(", ")` it leaks the full feature-key inventory to the caller (Stage-1 LOW reflection finding).
12. **Float / NaN percentage:** Zod's `.int()` blocks non-integers at the MCP boundary, but the backend coerces with `Number()` and accepts floats — same field, two validation contracts.
13. **Negative or >100 percentage:** rejected by Zod here; backend independently re-checks. A value written by one path is trusted unvalidated by the other on read.
14. **UTC date skew:** `last_modified` uses UTC; near midnight in non-UTC zones the stamped date can disagree with the operator's local "today", and ordering by `last_modified` is date-granular only (no time).
15. **No `dependencies` field = no guard:** features lacking the optional `dependencies` key skip all dependency validation in `set_feature_state`, so they can always be Enabled.
16. **Full-DB rewrite amplifies risk:** every mutation rewrites the entire JSON. A single bad in-memory object (e.g. from a prototype-key write) corrupts the whole registry on save, not just one record.
17. **Sync I/O blocks the process:** `readFileSync`/`writeFileSync` on each call block the single-threaded event loop; large files or slow disks stall all concurrent tool calls.
18. **Self-dependency / cycle:** a feature listing itself (or a cycle A→B→A) in `dependencies` is not detected; `set_feature_state` checks status at read time and may permit or block based on transient on-disk state.
19. **Empty / `{}` features file:** valid JSON `{}` makes `list_features` return `[]` and every `get`/`set`/`adjust` return "not found" with an empty available-keys list.
20. **Case sensitivity:** keys are case-sensitive exact matches; `Search_V2` vs `search_v2` yields a not-found error even though the LLM may consider them equivalent.

---

## Open Questions

1. Should the four invariants (Disabled⇒0 traffic; Enabled⇒deps enabled) be enforced/repaired on **load**, or only on the records being mutated? Current behavior leaves stale violations on disk.
2. Is `Shadow` a real product state, and why does the backend not accept it? Which writer owns the canonical status enum?
3. Should dependency validation be **transitive** (full chain) rather than direct-only?
4. What is the intended ownership model for `features.json` — should both writers go through a single locked service / DAL (proposed ADR-0005) instead of two direct `fs` writers?
5. Should non-Disabled state transitions (to `Testing`/`Shadow`) clamp `traffic_percentage`, or is high-traffic "Testing" intentional?
6. Should `feature_name` be validated against a key allowlist / regex to prevent reserved-key (`__proto__`) lookups and inventory leakage in errors?
7. Should writes be **atomic** (temp file + rename) and **async** to avoid corruption and event-loop blocking?
8. What timezone should `last_modified` use, and should it carry a time component for ordering?

---

## Suggested Characterization Tests

These pin current observed behavior (golden master), to be run against the existing module before any refactor (Stage 4).

1. **`list_features` shape:** returns a JSON array where each element has exactly `{key, name, status, traffic_percentage}` and length equals the number of keys in `features.json`.
2. **`get_feature_info` happy path:** for `checkout_v2`/`semantic_search`, returns full metadata including `depends_on` resolved with each dep's current `{key,name,status}`.
3. **`get_feature_info` unknown key:** returns `isError: true` and text containing the literal `feature_name` and a comma-joined list of all available keys.
4. **`get_feature_info` dependency resolution of missing dep:** craft a feature whose `dependencies` includes a non-existent key; assert `depends_on` entry has `status: "Unknown"` and `name` equal to the key.
5. **`set_feature_state` blocked by Disabled dep:** enabling `semantic_search` while `search_v2` is `Disabled` returns `isError` listing `search_v2`, and **the file is unchanged** (assert byte-for-byte before/after).
6. **`set_feature_state` Disabled forces traffic to 0:** set a feature with non-zero traffic to `Disabled`; assert response and persisted file both show `traffic_percentage: 0`.
7. **`set_feature_state` Testing keeps traffic:** set a feature at 43% to `Testing`; assert `traffic_percentage` stays 43.
8. **`set_feature_state` stamps `last_modified`:** assert `last_modified` equals `new Date().toISOString().split("T")[0]` (mock the clock).
9. **`set_feature_state` no-dependencies feature can always Enable:** enabling `dark_mode` (no `dependencies`) succeeds regardless of other features' state.
10. **`set_feature_state` invalid enum rejected:** calling with `state: "On"` is rejected by Zod before the handler (no file read/write occurs).
11. **`adjust_traffic_rollout` hard lock:** set `percentage: 10` on a `Disabled` feature → `isError`, file unchanged.
12. **`adjust_traffic_rollout` 0% on Disabled allowed:** set `percentage: 0` on a `Disabled` feature → success, no error.
13. **`adjust_traffic_rollout` out-of-range rejected:** `percentage: 150` and `percentage: -5` are rejected by Zod; non-integer `percentage: 12.5` is rejected by `.int()`.
14. **`adjust_traffic_rollout` unknown key:** returns `isError` "not found" with available keys; file unchanged.
15. **Malformed file behavior:** point `DATA_PATH` at a file with invalid JSON; assert the tool call fails (loadFeatures throws) — documents current ungraceful failure.
16. **Reserved-key lookup:** call `get_feature_info` with `feature_name: "__proto__"`; capture and pin current behavior (truthy object vs not-found).
17. **Full-DB round-trip integrity:** after any successful mutation, assert all *other* features in the file are byte-identical to before (only the target key and its fields changed, plus formatting `2-space + trailing \n`).
18. **`server://status` resource:** reading it returns valid JSON with `status: "ok"` and a numeric `uptime`.
