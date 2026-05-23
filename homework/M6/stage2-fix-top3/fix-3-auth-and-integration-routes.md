# Fix #3 — Auth + integration routes hardening

## Original finding (from synthesis.md)

> **Cluster C — Unauthenticated write/integration endpoints**
> - `backend/routes/autopilotRoutes.js:6` — `POST /api/autopilot/feature-control` has no `protect`/`admin`; defeats the whole "hide N8N_API_KEY" goal. (SEC + ARCH-05.)
> - `backend/routes/uploadRoutes.js:37` — `POST /api/upload` no auth; anyone fills disk. (SEC MED, escalated.)
> - `backend/routes/productRoutes.js:23` — multer uses raw `file.originalname`, accepts any `image/*`, no size limit → path-traversal / double-ext / disk-fill. (SEC + ARCH-04.)
>
> **Top-3 row 3:**
> | `backend/routes/autopilotRoutes.js:6,17` + `uploadRoutes.js:37` + `productRoutes.js:23-29` + `authMiddleware.js:26` | `autopilot` + `upload` no auth; multer uses raw `file.originalname`, no size cap; `admin` guard returns 401 instead of 403 | Add `protect, admin` chain to autopilot+upload. Multer: `crypto.randomUUID()+mime.extension(...)`, `limits:{fileSize:2MB,files:3}`, MIME allowlist `[jpeg,png,webp]`. `admin` → 403. Axios timeout 5s, body cap `16kb` | **0.5 d** |
>
> **Approach (detail):**
> - `autopilotRoutes`: add `protect, admin` chain; `axios` timeout 5s; whitelist outbound URL to env-derived host; cap `req.body` size via `express.json({limit:'16kb'})` route-local.
> - `uploadRoutes`: add `protect, admin`.
> - `productRoutes` review-upload: replace `file.originalname` with `crypto.randomUUID()+ext` derived from `mime.extension(file.mimetype)`; multer `limits: { fileSize: 2*1024*1024, files: 3 }`; `fileFilter` allowlist `['image/jpeg','image/png','image/webp']`.
> - `authMiddleware.admin`: return 403 not 401; remove `console.error(error)` (replace with structured log without error object).
>
> **Closes:** SEC HIGH autopilot-no-auth + upload-no-auth + multer path-traversal; ARCH-04/05/07.

---

## What I changed (diff)

### `backend/routes/autopilotRoutes.js`
```diff
 import express from 'express'
 import asyncHandler from 'express-async-handler'
+import { protect, admin } from '../middleware/authMiddleware.js'

 const router = express.Router()

 router.post(
   '/feature-control',
+  protect,
+  admin,
+  express.json({ limit: '16kb' }),
   asyncHandler(async (req, res) => {
     ...
-        signal: AbortSignal.timeout(110000),
+        signal: AbortSignal.timeout(5000),
```

### `backend/routes/uploadRoutes.js`
```diff
 import multer from 'multer'
+import { protect, admin } from '../middleware/authMiddleware.js'
 ...
-router.post('/', upload.single('image'), (req, res) => {
+router.post('/', protect, admin, upload.single('image'), (req, res) => {
```

### `backend/routes/productRoutes.js`
```diff
 import multer from 'multer'
+import crypto from 'crypto'
+
+const MIME_EXT = {
+  'image/jpeg': 'jpg',
+  'image/png': 'png',
+  'image/webp': 'webp',
+}

 const storage = multer.diskStorage({
   destination(req, file, cb) { cb(null, 'uploads/') },
   filename(req, file, cb) {
-    cb(null, `review-${Date.now()}-${file.originalname}`)
+    const ext = MIME_EXT[file.mimetype]
+    cb(null, `review-${crypto.randomUUID()}.${ext}`)
   },
 })

 const fileFilter = (req, file, cb) => {
-  if (file.mimetype.startsWith('image/')) {
+  if (MIME_EXT[file.mimetype]) {
     cb(null, true)
   } else {
     cb(new Error('Images only'))
   }
 }

-const uploadReviewImages = multer({ storage, fileFilter }).array('images', 3)
+const uploadReviewImages = multer({
+  storage,
+  fileFilter,
+  limits: { fileSize: 2 * 1024 * 1024, files: 3 },
+}).array('images', 3)
```

### Skipped from synthesis recommendation
- `authMiddleware.admin` 401 → 403 — blocked by task constraint "Do NOT modify error handling logic".
- Removing `console.error(error)` in `protect` — blocked by constraint "Do NOT remove existing logging".
- Outbound URL host whitelist in autopilot — out of scope for this PR; `N8N_WEBHOOK_URL` is env-controlled (server-trusted), so SSRF surface is bounded to whatever ops sets. Leaving for a follow-up that introduces an env-derived allowlist util.

---

## Why this approach — trade-offs

**`protect, admin` chain on autopilot/upload.** Single-line mechanical fix, matches existing pattern used everywhere else in `productRoutes.js`. Zero new abstraction. Trade-off: couples two route files to `authMiddleware` import path — acceptable, since they already lived in a world where it was the convention.

**`express.json({limit:'16kb'})` route-local in autopilot.** Caps proxied body before it hits `fetch`. Global JSON parser (in `server.js`) may have a larger limit; route-local override is the smallest blast-radius way to cap upstream payload without touching global config. Trade-off: parser runs twice if global already parsed — Express short-circuits when `req.body` exists, so no double-parse cost; the limit still applies to incoming bytes if it's the first parser to see the stream.

**Timeout 110s → 5s.** Synthesis prescribes 5s. n8n WF1 happy-path is <1s; 110s was a debugging artifact that left an open file descriptor for almost two minutes per stuck request — DoS amplifier. 5s is generous for a single webhook hop. Trade-off: if n8n is under load and replies in 6s, user sees 504. Acceptable — n8n owns its own SLO; we should fail fast and let user retry.

**`crypto.randomUUID()` filename + MIME allowlist map.** Eliminates path-traversal (no user-controlled bytes in filename), double-extension confusion (`evil.php.jpg` → `review-<uuid>.jpg`), and `image/svg+xml` XSS upload (svg not in allowlist). Inline `MIME_EXT` map avoids the `mime-types` dep that the synthesis recommended via `mime.extension(...)` — constraint says no new deps, and `mime-types` is only a transitive dep here, not declared in `package.json`. Trade-off: hardcoded map needs an edit if we ever want `image/gif` support. Three lines vs. a dep — worth it.

**`limits: {fileSize: 2MB, files: 3}`.** Disk-fill bound. 2MB × 3 = 6MB per review request — plenty for a product review photo, tight enough that 10k anonymous requests can't fill a disk before rate-limiting kicks in. Trade-off: existing reviews with >2MB images keep working (limit is on upload, not retrieval).

---

## Test status

Baseline (before fix): **12/12 pass**.

After fix: **11/12 pass, 1 fail** — and the failure is the desired signal.

```
PASS homework/M6/stage2-fix-top3/tests/test-auth-and-integration-routes.js
  admin middleware — текущее поведение
    ✓ БАГ: возвращает 401 (а не 403), когда пользователь не админ
    ✓ возвращает 401, когда req.user отсутствует (protect не отработал)
    ✓ вызывает next() для пользователя с isAdmin=true
  protect middleware — текущее поведение
    ✓ возвращает 401, когда заголовок Authorization отсутствует
    ✓ возвращает 401 при синтаксически невалидном токене
    ✓ БАГ: throw "user not found" перехватывается catch-блоком...
    ✓ устанавливает req.user и вызывает next() для валидного токена
    ✓ БАГ: console.error печатает объект ошибки JWT
  optionalProtect — текущее поведение
    ✓ пропускает без req.user, если токена нет
    ✓ глотает невалидный токен и продолжает как анонимный
    ✓ устанавливает req.user для валидного токена
  POST /api/autopilot/feature-control — текущее поведение
    ✕ БАГ: эндпоинт доступен без токена (нет protect/admin)

  ● POST /api/autopilot/feature-control — текущее поведение › БАГ: эндпоинт доступен без токена (нет protect/admin)

    expect(received).toBe(expected) // Object.is equality

    Expected: 500
    Received: 401

      247 |       // Дошли до handler-а (нет 401/403) → упали на проверке N8N_WEBHOOK_URL.
      248 |       // Это и есть характеристика бага: handler выполняется без auth.
    > 249 |       expect(res.status).toBe(500)
          |                          ^

Test Suites: 1 failed, 1 total
Tests:       1 failed, 11 passed, 12 total
```

The failing test was named `БАГ: эндпоинт доступен без токена` — it characterized the bug. Expected 500 (handler reached → fell on `N8N_WEBHOOK_URL` check) is now 401 (`protect` blocks before handler). This is exactly the behavior change the fix is supposed to produce. Per task instruction "характеристик теста не меняем, пусть они падают" — left untouched.

The other 11 characterization tests (admin/protect/optionalProtect) remained green because `authMiddleware.js` was deliberately not touched (constraint).

---

## Lessons learned

Auth guards are cheap one-line edits, but the easy fix gets postponed because nobody owns the "is this route protected?" audit — a per-route checklist in PR review would catch this earlier than any reviewer mate. Multer's defaults (no size, no MIME allowlist, raw `originalname` in filename) are a quietly-unsafe API and should be wrapped in a single hardened factory the moment a project has more than one upload site.
