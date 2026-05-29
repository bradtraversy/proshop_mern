# Fix #3 — `POST /api/upload` is fully public

## 1. Original finding (from synthesis.md)

> **`backend/routes/uploadRoutes.js:37`** — `POST /api/upload` is fully public (no `protect`/`admin`). Anyone can upload files served statically from `/uploads`.
> - Source: security-mate (HIGH, A01)
> - Fix approach: add `protect, admin` middleware to the route (matches how product mutations are already protected).
> - Effort: 20 min

OWASP: A01 Broken Access Control (unauthenticated write surface). Anonymous
upload + static serving is also a stored-content / disk-exhaustion vector.

## 2. What I changed (diff)

```diff
 import path from 'path'
 import express from 'express'
 import multer from 'multer'
+import { protect, admin } from '../middleware/authMiddleware.js'
 const router = express.Router()
 ...
-router.post('/', upload.single('image'), (req, res) => {
+router.post('/', protect, admin, upload.single('image'), (req, res) => {
   res.send(`/${req.file.path}`)
 })
```

Two lines (one import, one middleware insertion), one file. The `protect, admin`
pair runs **before** multer, so an unauthorized request is rejected before any
file is parsed or written to disk. This matches the existing convention for
admin-only mutations (e.g. product create/update routes already use
`protect, admin`). The handler and response shape are unchanged for admins.

## 3. Why this approach (trade-offs)

Uploads in this app are an admin action (adding product images from the admin
dashboard), so gating on `admin` — not merely `protect` — matches the real use
case and is the tightest correct scope. Ordering the auth middleware before
`upload.single('image')` means multer never touches an unauthenticated request,
which also neutralizes the disk-exhaustion angle from anonymous callers. I left
the separate hardening items the reviewers raised (no `limits.fileSize`, weak
MIME check) out of scope — they are real but independent of the access-control
defect this fix targets, and bundling them would widen the diff and the blast
radius.

## 4. Test status

Run: `npx vitest run homework-m6/stage2-fix-top3/tests/upload-public-access.test.js`

```
 ✓ upload-public-access.test.js (4 tests) 227ms
   ✓ rejects an unauthenticated upload with 401 (fixed)              [TARGET]
   ✓ rejects an authenticated NON-admin upload with 401 (fixed)     [TARGET]
   ✓ rejects a non-image file regardless of auth (multer → 500)     [control]
   ✓ accepts a valid PNG from an admin and returns its /uploads path [control]
 Test Files  1 passed (1)   Tests  4 passed (4)
```

Both control tests (admin happy path + multer image-type filter) stayed green →
the multer pipeline behavior is untouched; only the auth gate was added.

## 5. Behavior change

**Yes — intentional.** The original target test pinned the public behavior
(unauthenticated `POST` returned `200` + a `/uploads/...` path). It was replaced
by two assertions of the new contract: unauthenticated → `401`, and
authenticated-but-non-admin → `401`. The admin happy-path control proves
legitimate uploads still work. Deliberate access-control correction, so the test
update is expected.

## 6. Lessons learned

This route slipped through because, unlike the product/user/order routers, it
was wired with a bare handler and no auth — easy to miss in review precisely
because it is short. The takeaway: a default-deny posture (a single
authenticated router that sub-routes opt out of) is safer than per-route opt-in,
where forgetting one line silently exposes a write endpoint.
