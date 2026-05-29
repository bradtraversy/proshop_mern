# Fix #1 — `getUsers` leaks bcrypt password hashes

## 1. Original finding (from synthesis.md)

> **`backend/controllers/userController.js:110-111`** — `getUsers` (admin list) returns full User docs **including the bcrypt password hash**, and is unbounded (no pagination). `getUserById:134` already uses `.select('-password')` — same resource, two contracts, one leaks a credential.
> - Source: **security-mate (HIGH, data exposure) + performance-mate (PERF-007) + architecture-mate (C1 contract)** — flagged by all three
> - Fix approach: `.select('-password')` on the query (credential leak); pagination is a separate, larger change.
> - Effort: 15 min

OWASP: A02 Cryptographic Failures / A01 (over-exposed data). Triple-flagged across all three reviewers.

## 2. What I changed (diff)

```diff
 const getUsers = asyncHandler(async (req, res) => {
-  const users = await User.find({})
+  const users = await User.find({}).select('-password')
   res.json(users)
 })
```

Single file, single line. No public-API change to the response *shape* — the
admin list still returns the same array of user objects, only without the
`password` field (which no legitimate client used). Mirrors the projection
already used by `getUserById` (`userController.js:134`).

## 3. Why this approach (trade-offs)

`.select('-password')` is the minimal, idiomatic Mongoose fix and matches the
existing convention in the same controller, so the contract becomes consistent
between `getUsers` and `getUserById`. I deliberately did **not** bundle the
pagination fix (PERF-007) here — that changes the response envelope (breaking
for clients) and belongs in its own change with its own tests. Keeping this
diff to one line keeps the security fix reviewable and low-risk.

## 4. Test status

Run: `npx vitest run homework-m6/stage2-fix-top3/tests/getUsers-password-exposure.test.js`

```
 ✓ getUsers-password-exposure.test.js (5 tests) 965ms
   ✓ does NOT leak the password hash for any user (fixed)        [TARGET]
   ✓ returns 200 and all three users to an admin                 [control]
   ✓ still returns the safe identity fields for each user        [control]
   ✓ rejects a non-admin authenticated user with 401             [control]
   ✓ rejects an unauthenticated request with 401                 [control]
 Test Files  1 passed (1)   Tests  5 passed (5)
```

All 4 control tests stayed green → the fix did not touch adjacent behavior
(status, count, identity fields, authz/auth gates).

## 5. Behavior change

**Yes — intentional.** The target test originally pinned the *leak* (asserting
every user object carried a `$2…` bcrypt hash). It was rewritten to assert
`u.password === undefined`, with a comment pointing back to this file. This is a
deliberate security correction (the credential must not be in the response), not
a refactor — so updating the test to the new correct contract is expected.
Control tests were **not** changed.

## 6. Lessons learned

The leak existed only because the safe projection was applied inconsistently —
`getUserById` had it, the list endpoint didn't. The real lesson is that a
shared User serializer (architecture-mate's C1 recommendation) would have
prevented one endpoint from drifting. A one-line patch closes the credential
leak today; the structural fix (single serializer) is the durable follow-up.
