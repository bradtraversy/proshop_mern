/**
 * Characterization-тесты для Finding #2 (Cluster B — Order endpoints).
 *
 * Цель: зафиксировать ТЕКУЩЕЕ поведение `backend/controllers/orderController.js`
 * — даже если оно содержит уязвимости:
 *   1. `addOrderItems` доверяет клиентскому `totalPrice` (нет server-side recompute);
 *   2. `getOrderById` не проверяет ownership — любой авторизованный юзер
 *      читает чужой заказ;
 *   3. `updateOrderToPaid` не проверяет ownership и доверяет произвольному
 *      клиентскому `paymentResult`.
 *
 * После рефакторинга (Stage 2 fix #2) часть из этих тестов должна сломаться —
 * это и есть сигнал, что поведение изменилось так, как планировалось.
 *
 * Order-модель замокана через `jest.unstable_mockModule`, чтобы не поднимать
 * MongoDB. Middleware `protect` заменён на лёгкий stub, читающий
 * заголовки `x-user-id` и `x-user-admin`.
 */

import { jest } from '@jest/globals'
import express from 'express'
import request from 'supertest'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '../../../..')

// ---------- Мок модели Order ----------
const store = new Map()
let idSeq = 0

class MockOrder {
  constructor(data) {
    Object.assign(this, data)
    if (!this._id) this._id = `order_${++idSeq}`
  }

  async save() {
    store.set(String(this._id), this)
    return this
  }

  static findById(id) {
    const doc = store.get(String(id)) || null
    // Возвращаем thenable + .populate, чтобы покрыть оба способа вызова:
    //   await Order.findById(id)                 — updateOrderToPaid
    //   await Order.findById(id).populate(...)   — getOrderById
    return {
      populate() {
        return Promise.resolve(doc)
      },
      then(resolve, reject) {
        return Promise.resolve(doc).then(resolve, reject)
      },
    }
  }
}

const ORDER_MODEL_PATH = path.join(REPO_ROOT, 'backend/models/orderModel.js')

jest.unstable_mockModule(ORDER_MODEL_PATH, () => ({
  default: MockOrder,
  __esModule: true,
}))

// ---------- Подъём приложения ----------
let app

beforeAll(async () => {
  const controller = await import(
    path.join(REPO_ROOT, 'backend/controllers/orderController.js')
  )
  const { errorHandler } = await import(
    path.join(REPO_ROOT, 'backend/middleware/errorMiddleware.js')
  )

  // Лёгкий stub auth: req.user из заголовков.
  const protectStub = (req, res, next) => {
    const id = req.headers['x-user-id']
    if (!id) {
      res.status(401)
      return next(new Error('Not authorized (stub)'))
    }
    req.user = {
      _id: id,
      isAdmin: req.headers['x-user-admin'] === 'true',
    }
    next()
  }

  app = express()
  app.use(express.json())
  app.post('/api/orders', protectStub, controller.addOrderItems)
  app.get('/api/orders/:id', protectStub, controller.getOrderById)
  app.put('/api/orders/:id/pay', protectStub, controller.updateOrderToPaid)
  app.use(errorHandler)
})

beforeEach(() => {
  store.clear()
  idSeq = 0
})

// ---------- Хелперы ----------
const validShipping = {
  address: 'ул. Ленина 1',
  city: 'Минск',
  postalCode: '220000',
  country: 'BY',
}

const validItem = {
  name: 'iPhone',
  qty: 2,
  image: '/images/iphone.jpg',
  price: 500,
  product: 'prod_1',
}

// =========================================================================
// addOrderItems — текущее поведение
// =========================================================================
describe('POST /api/orders — addOrderItems (текущее поведение)', () => {
  it('сохраняет клиентский totalPrice как есть (нет server-side recompute)', async () => {
    // БАГ: сервер слепо доверяет клиентскому totalPrice.
    // 2 × 500 = 1000, но клиент шлёт 0 — сервер сохраняет 0.
    const res = await request(app)
      .post('/api/orders')
      .set('x-user-id', 'user_A')
      .send({
        orderItems: [validItem],
        shippingAddress: validShipping,
        paymentMethod: 'PayPal',
        itemsPrice: 0,
        taxPrice: 0,
        shippingPrice: 0,
        totalPrice: 0,
      })

    expect(res.status).toBe(201)
    expect(res.body.totalPrice).toBe(0)
    expect(res.body.itemsPrice).toBe(0)
    expect(res.body.user).toBe('user_A')
  })

  it('принимает абсурдно большой totalPrice без верификации', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('x-user-id', 'user_A')
      .send({
        orderItems: [validItem],
        shippingAddress: validShipping,
        paymentMethod: 'PayPal',
        itemsPrice: 1,
        taxPrice: 1,
        shippingPrice: 1,
        totalPrice: 999999999,
      })

    expect(res.status).toBe(201)
    expect(res.body.totalPrice).toBe(999999999)
  })

  it('возвращает 400 при пустом orderItems', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('x-user-id', 'user_A')
      .send({
        orderItems: [],
        shippingAddress: validShipping,
        paymentMethod: 'PayPal',
        totalPrice: 10,
      })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/No order items/)
  })

  it('возвращает 400 при giftMessage длиннее 200 символов', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('x-user-id', 'user_A')
      .send({
        orderItems: [validItem],
        shippingAddress: validShipping,
        paymentMethod: 'PayPal',
        totalPrice: 100,
        giftMessage: 'x'.repeat(201),
      })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/Gift message/)
  })

  it('сохраняет пустой giftMessage по умолчанию, если не передан', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('x-user-id', 'user_A')
      .send({
        orderItems: [validItem],
        shippingAddress: validShipping,
        paymentMethod: 'PayPal',
        totalPrice: 100,
      })

    expect(res.status).toBe(201)
    expect(res.body.giftMessage).toBe('')
  })
})

// =========================================================================
// getOrderById — текущее поведение (отсутствие ownership-проверки)
// =========================================================================
describe('GET /api/orders/:id — getOrderById (текущее поведение)', () => {
  async function seedOrder(ownerId) {
    const order = new MockOrder({
      _id: 'order_seed_1',
      user: ownerId,
      orderItems: [validItem],
      shippingAddress: validShipping,
      paymentMethod: 'PayPal',
      totalPrice: 1000,
    })
    await order.save()
    return order
  }

  it('БАГ: возвращает чужой заказ любому авторизованному пользователю', async () => {
    await seedOrder('user_A')

    const res = await request(app)
      .get('/api/orders/order_seed_1')
      .set('x-user-id', 'user_B') // НЕ владелец, НЕ админ

    expect(res.status).toBe(200)
    expect(res.body.user).toBe('user_A')
    expect(res.body.totalPrice).toBe(1000)
  })

  it('возвращает заказ владельцу', async () => {
    await seedOrder('user_A')

    const res = await request(app)
      .get('/api/orders/order_seed_1')
      .set('x-user-id', 'user_A')

    expect(res.status).toBe(200)
    expect(res.body._id).toBe('order_seed_1')
  })

  it('возвращает 404 для несуществующего заказа', async () => {
    const res = await request(app)
      .get('/api/orders/does_not_exist')
      .set('x-user-id', 'user_A')

    expect(res.status).toBe(404)
    expect(res.body.message).toMatch(/Order not found/)
  })
})

// =========================================================================
// updateOrderToPaid — текущее поведение (no ownership + trusted paymentResult)
// =========================================================================
describe('PUT /api/orders/:id/pay — updateOrderToPaid (текущее поведение)', () => {
  async function seedOrder(ownerId) {
    const order = new MockOrder({
      _id: 'order_pay_1',
      user: ownerId,
      orderItems: [validItem],
      shippingAddress: validShipping,
      paymentMethod: 'PayPal',
      totalPrice: 1000,
      isPaid: false,
    })
    await order.save()
    return order
  }

  it('БАГ: разрешает не-владельцу пометить заказ как оплаченный', async () => {
    await seedOrder('user_A')

    const res = await request(app)
      .put('/api/orders/order_pay_1/pay')
      .set('x-user-id', 'user_B') // НЕ владелец
      .send({
        id: 'PAYPAL_TX_X',
        status: 'COMPLETED',
        update_time: '2026-05-23T10:00:00Z',
        payer: { email_address: 'attacker@example.com' },
      })

    expect(res.status).toBe(200)
    expect(res.body.isPaid).toBe(true)
    expect(res.body.paidAt).toBeDefined()
  })

  it('БАГ: сохраняет произвольный клиентский paymentResult без верификации', async () => {
    await seedOrder('user_A')

    const res = await request(app)
      .put('/api/orders/order_pay_1/pay')
      .set('x-user-id', 'user_A')
      .send({
        id: 'fake-tx-id',
        status: 'FAKE_STATUS',
        update_time: 'whenever',
        payer: { email_address: 'spoofed@example.com' },
      })

    expect(res.status).toBe(200)
    expect(res.body.paymentResult).toEqual({
      id: 'fake-tx-id',
      status: 'FAKE_STATUS',
      update_time: 'whenever',
      email_address: 'spoofed@example.com',
    })
  })

  it('возвращает 404 для несуществующего заказа', async () => {
    const res = await request(app)
      .put('/api/orders/missing_order/pay')
      .set('x-user-id', 'user_A')
      .send({ id: 'x', status: 'y', update_time: 'z', payer: {} })

    expect(res.status).toBe(404)
    expect(res.body.message).toMatch(/Order not found/)
  })

  it('корректно обрабатывает отсутствие payer в теле (payer?.email_address → undefined)', async () => {
    await seedOrder('user_A')

    const res = await request(app)
      .put('/api/orders/order_pay_1/pay')
      .set('x-user-id', 'user_A')
      .send({ id: 't', status: 's', update_time: 'u' }) // без payer

    expect(res.status).toBe(200)
    expect(res.body.paymentResult.email_address).toBeUndefined()
  })
})
