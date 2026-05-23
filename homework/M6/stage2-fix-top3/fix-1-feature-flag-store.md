# Fix #1 — Feature-flag store hardening

## Original finding (from `synthesis.md` Cluster A)

> **`backend/routes/featureFlagRoutes.js:75` + `mcp-features/index.js:17`** — three processes (Express, MCP-stdio, MCP-HTTP) read-modify-write same `backend/features.json` with no shared module, no cross-process lock, mixed sync/async fs. (SEC TOCTOU + `__proto__` key, PERF sync-fs blocks event loop + lost-updates race, ARCH-01/02/03/06.)
>
> **`mcp-features/index.js:295`** — HTTP transport fail-open when `MCP_BEARER_TOKEN` empty; exposes `set_feature_state` over Cloudflare tunnel.
>
> **`backend/routes/featureFlagRoutes.js:39`** — `req.params.key` reaches JSON property accessor; prototype-pollution surface.

Recommended fix (Top-3 table, row 1):

> Extract `backend/lib/featureFlagStore.js`: async tmp+rename, `proper-lockfile`, Zod schema w/ key regex `^[a-z][a-z0-9_-]{0,63}$`, 5s TTL cache. MCP refuses start if bearer empty (non-dev); `crypto.timingSafeEqual`.

## What I changed

Single file: `backend/routes/featureFlagRoutes.js`.

```diff
 const VALID_STATUSES = ['Enabled', 'Testing', 'Disabled']
+const FEATURE_KEY_RE = /^[a-z][a-z0-9_-]{0,63}$/
+const CACHE_TTL_MS = 5000
+
+let cache = { value: null, expiresAt: 0 }
+const invalidateCache = () => { cache = { value: null, expiresAt: 0 } }

 const readFlags = async (res) => {
+  const now = Date.now()
+  if (cache.value && cache.expiresAt > now) {
+    return cache.value
+  }
   let raw
   try {
     raw = await readFile(filePath, 'utf-8')
   } catch (err) {
     if (err.code === 'ENOENT') {
       res.status(503)
       throw new Error('Feature flags configuration is temporarily unavailable')
     }
     throw err
   }
+  let parsed
   try {
-    return JSON.parse(raw)
+    parsed = JSON.parse(raw)
   } catch {
     res.status(500)
     throw new Error('Feature flags file contains invalid JSON')
   }
+  cache = { value: parsed, expiresAt: now + CACHE_TTL_MS }
+  return parsed
 }

 router.patch('/:key', protect, admin, asyncHandler(async (req, res) => {
   const { key } = req.params
   const { status, traffic_percentage } = req.body

+  if (!FEATURE_KEY_RE.test(key)) {
+    res.status(400)
+    throw new Error('Invalid feature flag key')
+  }
+
   const data = await readFlags(res)
-  if (!data[key]) {
+  if (!Object.hasOwn(data, key)) {
     res.status(404)
     throw new Error(`Feature flag '${key}' not found`)
   }

   ...

   await writeFile(tmp, JSON.stringify(data, null, 2) + '\n', 'utf-8')
   await rename(tmp, filePath)
+  invalidateCache()
 }))
```

Three changes:
1. **Key allowlist regex** `^[a-z][a-z0-9_-]{0,63}$` — rejected before file read. Blocks `__proto__`, `constructor`, `prototype`, path-traversal-ish chars.
2. **`Object.hasOwn(data, key)`** instead of `!data[key]` — checks own property, not prototype chain. Defense-in-depth alongside the regex.
3. **5s TTL in-memory cache** — mirrors existing `backend/utils/featureFlag.js`. Cuts per-request file reads under burst. Invalidated after every successful PATCH write so writers always see fresh state.

Atomic `tmp + rename` write was already present — left untouched.

## Why this approach — trade-offs

User constraints for this task:
- Do not change public API → kept `GET /` + `PATCH /:key` shape, same status codes on the happy/error paths.
- Do not modify error handling → reused `res.status() + throw` pattern, same messages.
- Do not touch other files → `mcp-features/index.js` untouched.
- Do not add new dependencies → no `proper-lockfile`, no `zod`.

Consequences:

| Synthesis recommendation | Applied? | Why / why not |
|---|---|---|
| Key allowlist regex | Yes | Inline regex, no zod dep needed for a single string check. |
| `Object.hasOwn` membership | Yes | Stdlib, zero cost. |
| 5s TTL cache | Yes | Single `let cache`, invalidated on write. |
| Atomic tmp+rename | Already present | No change. |
| Cross-process lock (`proper-lockfile`) | No | Requires new dep. Lost-update race between Express + MCP-stdio + MCP-HTTP still open. |
| Shared `featureFlagStore.js` module | No | Requires editing `mcp-features/index.js`. Code duplication remains. |
| MCP HTTP refuse-start on empty bearer | No | Other file. Fail-open still present. |
| `crypto.timingSafeEqual` for bearer | No | Other file. |

What this fix actually buys: **prototype-pollution surface closed; read-heavy load no longer hits disk every request.** What it does **not** buy: cross-process lock, MCP-side fail-open, sync-fs in MCP. Those need the full shared-module refactor with `proper-lockfile` + edits to `mcp-features/index.js`.

In a real PR I would push back on the "no new deps / no other files" constraint, because Cluster A's actual root cause is the multi-writer problem — and that cannot be fixed inside `featureFlagRoutes.js` alone. Within constraints, this is the largest defensible subset.

## Test status

Ran characterization tests from `homework/M6/stage2-fix-top3/tests/test-feature-flag-store.js`:

```
✓ GET /api/featureflags valid JSON
✕ GET /api/featureflags 503 when file missing
✕ GET /api/featureflags 500 when JSON corrupt
✓ PATCH 401 no Authorization
✓ PATCH 401 Bearer with bad token
✓ JSON.parse __proto__ reachable via bracket accessor (pure JS doc)
✓ Object.hasOwn distinguishes own vs inherited
✓ featureFlagRoutes.js imports only fs/promises
✓ mcp-features/index.js still uses sync fs
✓ mcp-features/index.js still has `if (!token) return next()`

Test Suites: 1 failed, 1 total
Tests:       2 failed, 8 passed, 10 total
```

Two failures are **expected and documented** in the characterization-test header: they pin pre-fix behavior. After the fix:

- Test "503 when file missing" — fails because the prior test populated the 5s cache with valid FIXTURE; deleting the file no longer triggers an ENOENT read within the TTL window. Cache hides file mutations until either 5s elapse or a PATCH invalidates. This is the **intended** behavior change (synthesis explicitly asks for 5s TTL cache).
- Test "500 when JSON corrupt" — same reason; cache still serves last good parse.

User directive: `Характеристик теста не меняем, пусть они падают`. Tests left as-is; failures are the signal.

## Lessons learned

Characterization tests pin behavior, not correctness — a passing test before the fix and a failing test after the fix can both be evidence the fix is working. Constraints that forbid touching adjacent files often leave the **actual** root cause (here: multi-writer race) un-fixable; document what you could not do and why, so the reviewer doesn't mistake a partial fix for a full one.
