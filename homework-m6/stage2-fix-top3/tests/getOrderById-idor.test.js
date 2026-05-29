// Characterization tests for synthesis.md Top-3 #2:
//   backend/controllers/orderController.js:43 — IDOR in getOrderById
//   (GET /api/orders/:id). Any authenticated user can read ANY order.
//
// Written BEFORE the fix.
//   - TARGET test: a non-owner, non-admin user can currently read another
//     user's order (200 + full PII). After the fix this is updated to assert
//     access is denied (intentional behavior change — see fix-2-*.md).
//   - CONTROL tests: owner access, admin access, 404, and auth gate must stay
//     green after the fix.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import mongoose from 'mongoose'
import request from 'supertest'
import User from '../../../backend/models/userModel.js'
import Order from '../../../backend/models/orderModel.js'
import { buildApp, tokenFor, startDb, stopDb, clearDb } from './helpers/testApp.js'

const app = buildApp()

let owner
let attacker
let admin
let order

function makeOrderDoc(userId) {
  return {
    user: userId,
    orderItems: [
      {
        name: 'Airpods Wireless Bluetooth Headphones',
        qty: 1,
        image: '/images/airpods.jpg',
        price: 89.99,
        product: new mongoose.Types.ObjectId(),
      },
    ],
    shippingAddress: {
      address: '123 Market St',
      city: 'San Francisco',
      postalCode: '94103',
      country: 'USA',
    },
    paymentMethod: 'PayPal',
    itemsPrice: 89.99,
    taxPrice: 13.5,
    shippingPrice: 0,
    totalPrice: 103.49,
  }
}

beforeAll(async () => {
  await startDb()
})

afterAll(async () => {
  await stopDb()
})

beforeEach(async () => {
  await clearDb()
  owner = await User.create({
    name: 'Order Owner',
    email: 'owner@proshop.test',
    password: 'OwnerPass123!',
  })
  attacker = await User.create({
    name: 'Mallory Attacker',
    email: 'mallory@proshop.test',
    password: 'MalloryPass123!',
  })
  admin = await User.create({
    name: 'Admin User',
    email: 'admin@proshop.test',
    password: 'AdminPass123!',
    isAdmin: true,
  })
  order = await Order.create(makeOrderDoc(owner._id))
})

describe('GET /api/orders/:id (getOrderById)', () => {
  // ---- TARGET behavior — intentional behavior change, see
  //      fix-2-getorderbyid-idor.md ----
  // Pre-fix this asserted the attacker got 200 + the owner's PII (the IDOR).
  // After the fix a non-owner non-admin must be denied. We return 404 (not
  // 403) so the endpoint does not disclose that the id exists.
  it("denies a non-owner non-admin reading another user's order (fixed)", async () => {
    const res = await request(app)
      .get(`/api/orders/${order._id}`)
      .set('Authorization', `Bearer ${tokenFor(attacker._id)}`)

    expect(res.status).toBe(404)
    // No PII leaked in the body.
    expect(res.body.shippingAddress).toBeUndefined()
    expect(res.body.user).toBeUndefined()
  })

  // ---- CONTROL behavior (must stay green after the fix) ----
  it('lets the owner read their own order', async () => {
    const res = await request(app)
      .get(`/api/orders/${order._id}`)
      .set('Authorization', `Bearer ${tokenFor(owner._id)}`)

    expect(res.status).toBe(200)
    expect(res.body._id).toBe(order._id.toString())
    expect(res.body.totalPrice).toBe(103.49)
  })

  it('lets an admin read any order', async () => {
    const res = await request(app)
      .get(`/api/orders/${order._id}`)
      .set('Authorization', `Bearer ${tokenFor(admin._id)}`)

    expect(res.status).toBe(200)
    expect(res.body._id).toBe(order._id.toString())
  })

  it('returns 404 for a non-existent order id', async () => {
    const ghostId = new mongoose.Types.ObjectId()
    const res = await request(app)
      .get(`/api/orders/${ghostId}`)
      .set('Authorization', `Bearer ${tokenFor(owner._id)}`)

    expect(res.status).toBe(404)
  })

  it('rejects an unauthenticated request with 401 (auth gate intact)', async () => {
    const res = await request(app).get(`/api/orders/${order._id}`)
    expect(res.status).toBe(401)
  })
})
