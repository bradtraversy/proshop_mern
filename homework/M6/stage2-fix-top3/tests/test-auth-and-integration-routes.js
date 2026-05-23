/**
 * Characterization-тесты для Finding #3 (Cluster C — Auth + integration routes).
 *
 * Цель: зафиксировать ТЕКУЩЕЕ поведение, даже если оно содержит баги/уязвимости:
 *   1. `admin`-middleware возвращает 401 вместо корректного 403, когда пользователь
 *      не админ или не аутентифицирован.
 *   2. `protect` глотает throw из `!req.user` через общий catch — сообщение
 *      становится "token failed", а не "user not found".
 *   3. `protect` пишет `console.error(error)` (утечка JWT-error в логи).
 *   4. `autopilotRoutes.POST /feature-control` доступен без `protect`/`admin` —
 *      любой может попасть в handler.
 *
 * После Stage 2 fix #3 часть из этих тестов должна сломаться — это и есть
 * сигнал, что поведение изменилось так, как планировалось.
 *
 * `User`-модель замокана через `jest.unstable_mockModule`, чтобы не поднимать
 * MongoDB. Токены подписываются реальным `jsonwebtoken` с тестовым секретом.
 */

import { jest } from '@jest/globals'
import jwt from 'jsonwebtoken'
import express from 'express'
import request from 'supertest'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '../../../..')

process.env.JWT_SECRET = 'test_secret_for_characterization_only'

// ---------- Мок User-модели ----------
const userStore = new Map()

const MockUser = {
  findById(id) {
    const doc = userStore.get(String(id)) || null
    return {
      select() {
        return Promise.resolve(doc)
      },
    }
  },
}

const USER_MODEL_PATH = path.join(REPO_ROOT, 'backend/models/userModel.js')

jest.unstable_mockModule(USER_MODEL_PATH, () => ({
  default: MockUser,
  __esModule: true,
}))

// ---------- Импорт middleware после установки мока ----------
let protect, admin, optionalProtect

beforeAll(async () => {
  const mod = await import(
    path.join(REPO_ROOT, 'backend/middleware/authMiddleware.js')
  )
  protect = mod.protect
  admin = mod.admin
  optionalProtect = mod.optionalProtect
})

beforeEach(() => {
  userStore.clear()
})

// ---------- Хелперы ----------
const makeRes = () => {
  const res = {}
  res.statusCode = 200
  res.status = jest.fn((s) => {
    res.statusCode = s
    return res
  })
  res.json = jest.fn((b) => {
    res.body = b
    return res
  })
  return res
}

// =========================================================================
// admin — текущее поведение
// =========================================================================
describe('admin middleware — текущее поведение', () => {
  it('БАГ: возвращает 401 (а не 403), когда пользователь не админ', () => {
    const req = { user: { isAdmin: false } }
    const res = makeRes()
    expect(() => admin(req, res, jest.fn())).toThrow(
      /Not authorized as an admin/
    )
    expect(res.statusCode).toBe(401)
  })

  it('возвращает 401, когда req.user отсутствует (protect не отработал)', () => {
    const req = {}
    const res = makeRes()
    expect(() => admin(req, res, jest.fn())).toThrow(
      /Not authorized as an admin/
    )
    expect(res.statusCode).toBe(401)
  })

  it('вызывает next() для пользователя с isAdmin=true', () => {
    const req = { user: { isAdmin: true } }
    const res = makeRes()
    const next = jest.fn()
    admin(req, res, next)
    expect(next).toHaveBeenCalledTimes(1)
    expect(next).toHaveBeenCalledWith()
  })
})

// =========================================================================
// protect — текущее поведение
// =========================================================================
describe('protect middleware — текущее поведение', () => {
  it('возвращает 401, когда заголовок Authorization отсутствует', async () => {
    const req = { headers: {} }
    const res = makeRes()
    const next = jest.fn()
    await protect(req, res, next)
    expect(res.statusCode).toBe(401)
    const err = next.mock.calls[0][0]
    expect(err).toBeInstanceOf(Error)
    expect(err.message).toMatch(/no token/)
  })

  it('возвращает 401 при синтаксически невалидном токене', async () => {
    const req = { headers: { authorization: 'Bearer not.a.real.jwt' } }
    const res = makeRes()
    const next = jest.fn()
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    await protect(req, res, next)
    errSpy.mockRestore()
    expect(res.statusCode).toBe(401)
    const err = next.mock.calls[0][0]
    expect(err.message).toMatch(/token failed/)
  })

  it('БАГ: throw "user not found" перехватывается catch-блоком и превращается в "token failed"', async () => {
    const token = jwt.sign({ id: 'missing_user' }, process.env.JWT_SECRET)
    const req = { headers: { authorization: `Bearer ${token}` } }
    const res = makeRes()
    const next = jest.fn()
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    await protect(req, res, next)
    errSpy.mockRestore()
    expect(res.statusCode).toBe(401)
    const err = next.mock.calls[0][0]
    // Не "user not found", а именно "token failed" — артефакт общего catch.
    expect(err.message).toMatch(/token failed/)
  })

  it('устанавливает req.user и вызывает next() для валидного токена', async () => {
    userStore.set('user_42', {
      _id: 'user_42',
      name: 'Alice',
      isAdmin: false,
    })
    const token = jwt.sign({ id: 'user_42' }, process.env.JWT_SECRET)
    const req = { headers: { authorization: `Bearer ${token}` } }
    const res = makeRes()
    const next = jest.fn()
    await protect(req, res, next)
    expect(req.user).toEqual({
      _id: 'user_42',
      name: 'Alice',
      isAdmin: false,
    })
    expect(next).toHaveBeenCalledWith()
    expect(res.statusCode).toBe(200)
  })

  it('БАГ: console.error печатает объект ошибки JWT (утечка диагностики)', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    const req = { headers: { authorization: 'Bearer broken-token' } }
    const res = makeRes()
    await protect(req, res, jest.fn())
    expect(spy).toHaveBeenCalled()
    const firstCallArg = spy.mock.calls[0][0]
    expect(firstCallArg).toBeInstanceOf(Error)
    spy.mockRestore()
  })
})

// =========================================================================
// optionalProtect — текущее поведение
// =========================================================================
describe('optionalProtect — текущее поведение', () => {
  it('пропускает без req.user, если токена нет', async () => {
    const req = { headers: {} }
    const res = makeRes()
    const next = jest.fn()
    await optionalProtect(req, res, next)
    expect(req.user).toBeUndefined()
    expect(next).toHaveBeenCalledWith()
  })

  it('глотает невалидный токен и продолжает как анонимный', async () => {
    const req = { headers: { authorization: 'Bearer garbage' } }
    const res = makeRes()
    const next = jest.fn()
    await optionalProtect(req, res, next)
    expect(req.user).toBeUndefined()
    expect(next).toHaveBeenCalledWith()
  })

  it('устанавливает req.user для валидного токена', async () => {
    userStore.set('u1', { _id: 'u1', name: 'Bob' })
    const token = jwt.sign({ id: 'u1' }, process.env.JWT_SECRET)
    const req = { headers: { authorization: `Bearer ${token}` } }
    const res = makeRes()
    const next = jest.fn()
    await optionalProtect(req, res, next)
    expect(req.user).toEqual({ _id: 'u1', name: 'Bob' })
    expect(next).toHaveBeenCalledWith()
  })
})

// =========================================================================
// autopilotRoutes — текущее поведение (НЕТ auth-guard)
// =========================================================================
describe('POST /api/autopilot/feature-control — текущее поведение', () => {
  it('БАГ: эндпоинт доступен без токена (нет protect/admin)', async () => {
    const saved = process.env.N8N_WEBHOOK_URL
    delete process.env.N8N_WEBHOOK_URL
    try {
      const router = (
        await import(path.join(REPO_ROOT, 'backend/routes/autopilotRoutes.js'))
      ).default
      const { errorHandler } = await import(
        path.join(REPO_ROOT, 'backend/middleware/errorMiddleware.js')
      )

      const app = express()
      app.use(express.json())
      app.use('/api/autopilot', router)
      app.use(errorHandler)

      const res = await request(app)
        .post('/api/autopilot/feature-control')
        .send({ feature_id: 'x', status: 'Enabled' })

      // Дошли до handler-а (нет 401/403) → упали на проверке N8N_WEBHOOK_URL.
      // Это и есть характеристика бага: handler выполняется без auth.
      expect(res.status).toBe(500)
      expect(res.body.message).toMatch(/N8N_WEBHOOK_URL/)
    } finally {
      if (saved !== undefined) process.env.N8N_WEBHOOK_URL = saved
    }
  })
})
