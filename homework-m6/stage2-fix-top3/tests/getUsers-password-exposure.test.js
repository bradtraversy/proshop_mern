// Characterization tests for synthesis.md Top-3 #1:
//   backend/controllers/userController.js:110-111 — getUsers leaks bcrypt
//   password hashes (no .select('-password')).
//
// Written BEFORE the fix. They pin CURRENT behavior:
//   - TARGET test: the admin user list currently INCLUDES password hashes.
//     After the fix this test is updated to assert the hash is absent
//     (intentional behavior change — see fix-1-getusers-password-exposure.md).
//   - CONTROL tests: status, count, fields, and authz gates must stay green
//     after the fix (proves the fix did not touch adjacent behavior).
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import request from 'supertest'
import User from '../../../backend/models/userModel.js'
import { buildApp, tokenFor, startDb, stopDb, clearDb } from './helpers/testApp.js'

const app = buildApp()

let admin
let alice
let bob

beforeAll(async () => {
  await startDb()
})

afterAll(async () => {
  await stopDb()
})

beforeEach(async () => {
  await clearDb()
  admin = await User.create({
    name: 'Admin User',
    email: 'admin@proshop.test',
    password: 'AdminPass123!',
    isAdmin: true,
  })
  alice = await User.create({
    name: 'Alice Customer',
    email: 'alice@proshop.test',
    password: 'AlicePass123!',
  })
  bob = await User.create({
    name: 'Bob Customer',
    email: 'bob@proshop.test',
    password: 'BobPass123!',
  })
})

describe('GET /api/users (getUsers)', () => {
  // ---- TARGET behavior — intentional behavior change, see
  //      fix-1-getusers-password-exposure.md ----
  // Pre-fix this asserted the password hash WAS present (the leak). After the
  // .select('-password') fix, no user object may expose a password field.
  it('does NOT leak the password hash for any user (fixed)', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${tokenFor(admin._id)}`)

    expect(res.status).toBe(200)
    for (const u of res.body) {
      expect(u.password).toBeUndefined()
    }
  })

  // ---- CONTROL behavior (must stay green after the fix) ----
  it('returns 200 and all three users to an admin', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${tokenFor(admin._id)}`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body).toHaveLength(3)
  })

  it('still returns the safe identity fields for each user', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${tokenFor(admin._id)}`)

    const emails = res.body.map((u) => u.email).sort()
    expect(emails).toEqual(
      ['admin@proshop.test', 'alice@proshop.test', 'bob@proshop.test'].sort()
    )
    for (const u of res.body) {
      expect(u).toHaveProperty('_id')
      expect(u).toHaveProperty('name')
      expect(u).toHaveProperty('email')
      expect(u).toHaveProperty('isAdmin')
    }
  })

  it('rejects a non-admin authenticated user with 401 (authz gate intact)', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${tokenFor(alice._id)}`)

    expect(res.status).toBe(401)
  })

  it('rejects an unauthenticated request with 401 (auth gate intact)', async () => {
    const res = await request(app).get('/api/users')
    expect(res.status).toBe(401)
  })
})
