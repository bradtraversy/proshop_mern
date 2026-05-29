// Characterization tests for synthesis.md Top-3 #3:
//   backend/routes/uploadRoutes.js:37 — POST /api/upload is fully public
//   (no protect/admin). Anyone can upload files served statically.
//
// Written BEFORE the fix.
//   - TARGET test: an UNAUTHENTICATED request currently reaches the multer
//     handler and successfully stores a file (200 + /uploads path). After the
//     fix this is updated to assert 401 (intentional behavior change — see
//     fix-3-*.md).
//   - CONTROL tests: the multer image-type filter behavior is independent of
//     auth and must stay green after the fix (verified with an admin token
//     once auth is required).
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'fs'
import path from 'path'
import request from 'supertest'
import User from '../../../backend/models/userModel.js'
import { buildApp, tokenFor, startDb, stopDb } from './helpers/testApp.js'

const app = buildApp()
const uploadsDir = path.resolve('uploads')

// 1x1 transparent PNG.
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
)

let admin
let preexisting = new Set()
const created = []

// Track files created during the test run so we can clean only those up.
function snapshotUploads() {
  try {
    return new Set(fs.readdirSync(uploadsDir))
  } catch {
    return new Set()
  }
}

beforeAll(async () => {
  await startDb()
  admin = await User.create({
    name: 'Admin User',
    email: 'admin@proshop.test',
    password: 'AdminPass123!',
    isAdmin: true,
  })
  preexisting = snapshotUploads()
})

afterAll(async () => {
  // Remove only files this test created; leave repo-tracked uploads intact.
  const after = snapshotUploads()
  for (const f of after) {
    if (!preexisting.has(f) && /^image-\d+\.(png|jpe?g)$/i.test(f)) {
      fs.rmSync(path.join(uploadsDir, f), { force: true })
    }
  }
  await stopDb()
})

describe('POST /api/upload (uploadRoutes)', () => {
  // ---- TARGET behavior — intentional behavior change, see
  //      fix-3-public-upload.md ----
  // Pre-fix an unauthenticated client could upload (200 + /uploads path).
  // After adding `protect, admin`, an unauthenticated request is rejected with
  // 401 before multer ever stores a file.
  it('rejects an unauthenticated upload with 401 (fixed)', async () => {
    const res = await request(app)
      .post('/api/upload')
      .attach('image', PNG_1X1, 'evil.png')

    expect(res.status).toBe(401)
  })

  it('rejects an authenticated NON-admin upload with 401 (fixed)', async () => {
    const nonAdmin = await User.create({
      name: 'Regular Joe',
      email: 'joe@proshop.test',
      password: 'JoePass123!',
    })
    const res = await request(app)
      .post('/api/upload')
      .set('Authorization', `Bearer ${tokenFor(nonAdmin._id)}`)
      .attach('image', PNG_1X1, 'joe.png')

    expect(res.status).toBe(401)
  })

  // ---- CONTROL behavior (must stay green after the fix) ----
  // The image-type filter is orthogonal to auth. Sent with an admin token so
  // the assertion holds both before the fix (token ignored) and after (token
  // required). A non-image is rejected by multer's fileFilter, which calls
  // cb('Images only!') with a STRING (not an Error) — so errorHandler surfaces
  // no message; the observable current behavior is just status 500.
  it('rejects a non-image file regardless of auth (multer fileFilter → 500)', async () => {
    const res = await request(app)
      .post('/api/upload')
      .set('Authorization', `Bearer ${tokenFor(admin._id)}`)
      .attach('image', Buffer.from('not an image'), 'malware.txt')

    expect(res.status).toBe(500)
  })

  it('accepts a valid PNG from an admin and returns its /uploads path', async () => {
    const res = await request(app)
      .post('/api/upload')
      .set('Authorization', `Bearer ${tokenFor(admin._id)}`)
      .attach('image', PNG_1X1, 'product.png')

    expect(res.status).toBe(200)
    expect(res.text).toMatch(/^\/uploads[\\/]image-\d+\.png$/)
    created.push(res.text)
  })
})
