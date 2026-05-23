/**
 * Characterization-тесты для Finding #1 (Cluster A — Feature-flag storage).
 *
 * Цель: зафиксировать ТЕКУЩЕЕ поведение `backend/routes/featureFlagRoutes.js`
 * и связанной с ним read/write-логики `backend/features.json` — даже если оно
 * содержит баги (отсутствие cross-process lock, prototype-key reachable,
 * sync fs в `mcp-features/index.js`, fail-open bearer). Эти тесты должны
 * проходить НА ТЕКУЩЕМ коде. После рефакторинга часть из них ожидаемо
 * сломается — это сигнал, что поведение действительно изменилось.
 */

import express from 'express'
import request from 'supertest'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '../../../..')
const FEATURES_PATH = path.join(REPO_ROOT, 'backend', 'features.json')

const FIXTURE = {
  dark_mode: {
    name: 'Dark Mode',
    description: 'Toggle dark theme.',
    status: 'Enabled',
    implemented: 'yes',
    traffic_percentage: 100,
    last_modified: '2026-01-01',
  },
  search_v2: {
    name: 'Search v2',
    description: 'New search.',
    status: 'Testing',
    implemented: 'no',
    traffic_percentage: 25,
    last_modified: '2026-02-02',
  },
}

let originalFeaturesJson
let featureFlagRoutes
let errorHandler

async function buildApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/featureflags', featureFlagRoutes)
  app.use(errorHandler)
  return app
}

beforeAll(async () => {
  // Бэкап реального features.json — восстановим в afterAll.
  originalFeaturesJson = fs.readFileSync(FEATURES_PATH, 'utf-8')
  featureFlagRoutes = (await import(path.join(REPO_ROOT, 'backend/routes/featureFlagRoutes.js'))).default
  errorHandler = (await import(path.join(REPO_ROOT, 'backend/middleware/errorMiddleware.js'))).errorHandler
})

afterAll(() => {
  // Восстанавливаем оригинал, чтобы тесты не оставляли мусор в репо.
  fs.writeFileSync(FEATURES_PATH, originalFeaturesJson, 'utf-8')
})

describe('Characterization: GET /api/featureflags — текущее поведение чтения features.json', () => {
  test('возвращает 200 и полностью распарсенный объект флагов при валидном JSON', async () => {
    fs.writeFileSync(FEATURES_PATH, JSON.stringify(FIXTURE, null, 2) + '\n', 'utf-8')
    const app = await buildApp()

    const res = await request(app).get('/api/featureflags')

    expect(res.status).toBe(200)
    expect(res.body).toEqual(FIXTURE)
    // Заметка: GET сейчас не использует in-memory cache — каждый запрос
    // читает файл заново. Это часть характеризуемого поведения.
  })

  test('возвращает 503 и сообщение "temporarily unavailable" если features.json отсутствует', async () => {
    fs.rmSync(FEATURES_PATH)
    const app = await buildApp()

    const res = await request(app).get('/api/featureflags')

    expect(res.status).toBe(503)
    expect(res.body.message).toMatch(/temporarily unavailable/i)

    // восстанавливаем для следующих тестов
    fs.writeFileSync(FEATURES_PATH, JSON.stringify(FIXTURE, null, 2) + '\n', 'utf-8')
  })

  test('возвращает 500 и сообщение про invalid JSON если файл повреждён', async () => {
    fs.writeFileSync(FEATURES_PATH, '{ это не json', 'utf-8')
    const app = await buildApp()

    const res = await request(app).get('/api/featureflags')

    expect(res.status).toBe(500)
    expect(res.body.message).toMatch(/invalid JSON/i)

    fs.writeFileSync(FEATURES_PATH, JSON.stringify(FIXTURE, null, 2) + '\n', 'utf-8')
  })
})

describe('Characterization: PATCH /api/featureflags/:key — текущее поведение auth-цепочки', () => {
  test('без Authorization-заголовка возвращает 401 "Not authorized, no token"', async () => {
    fs.writeFileSync(FEATURES_PATH, JSON.stringify(FIXTURE, null, 2) + '\n', 'utf-8')
    const app = await buildApp()

    const res = await request(app)
      .patch('/api/featureflags/dark_mode')
      .send({ status: 'Disabled' })

    expect(res.status).toBe(401)
    expect(res.body.message).toMatch(/no token/i)
  })

  test('с Bearer-схемой, но битым токеном тоже возвращает 401 "token failed"', async () => {
    // protect использует jwt.verify(token, process.env.JWT_SECRET). Без валидного
    // JWT_SECRET и подписи вызов уйдёт в catch → 401 "Not authorized, token failed".
    // Это фиксируемое поведение: даже при отсутствующем JWT_SECRET ветка падает в 401,
    // а не 500.
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-only'
    const app = await buildApp()

    const res = await request(app)
      .patch('/api/featureflags/dark_mode')
      .set('Authorization', 'Bearer not-a-real-jwt')
      .send({ status: 'Disabled' })

    expect(res.status).toBe(401)
    expect(res.body.message).toMatch(/token failed/i)
  })
})

describe('Characterization: prototype-key reachable через JSON.parse', () => {
  test('JSON.parse plain-объекта оставляет __proto__ доступным через bracket-accessor', () => {
    // Это пинит почему PATCH /:key с key='__proto__' СЕЙЧАС не отсекается
    // проверкой `if (!data[key])` в featureFlagRoutes.js:44 — `data['__proto__']`
    // через цепочку прототипов возвращает Object.prototype (truthy).
    const data = JSON.parse('{"foo":1}')
    expect(data['__proto__']).toBe(Object.prototype)
    expect(Boolean(data['__proto__'])).toBe(true)
    // Следствие: текущая ветка 404 НЕ срабатывает для '__proto__'.
    // После рефакторинга (Zod-регэксп key allowlist) этот сценарий должен
    // отсекаться раньше, но сейчас — нет.
  })

  test('Object.hasOwn различает собственный и унаследованный ключ — то, чего нет в текущей проверке', () => {
    const data = JSON.parse('{"foo":1}')
    expect(Object.hasOwn(data, 'foo')).toBe(true)
    expect(Object.hasOwn(data, '__proto__')).toBe(false)
    expect(Object.hasOwn(data, 'constructor')).toBe(false)
    // Документируем GAP: featureFlagRoutes.js использует `!data[key]`, не `Object.hasOwn`.
  })
})

describe('Characterization: writeFile в роутере использует async tmp+rename (не sync)', () => {
  test('featureFlagRoutes.js импортирует только async fs/promises API', () => {
    const src = fs.readFileSync(
      path.join(REPO_ROOT, 'backend/routes/featureFlagRoutes.js'),
      'utf-8',
    )
    expect(src).toMatch(/from 'fs\/promises'/)
    expect(src).not.toMatch(/writeFileSync/)
    expect(src).not.toMatch(/readFileSync/)
    // Контраст с mcp-features/index.js — там sync fs (см. след. тест).
  })

  test('mcp-features/index.js СЕЙЧАС использует sync fs (readFileSync/writeFileSync)', () => {
    const src = fs.readFileSync(
      path.join(REPO_ROOT, 'mcp-features/index.js'),
      'utf-8',
    )
    expect(src).toMatch(/readFileSync/)
    expect(src).toMatch(/writeFileSync/)
    // Это часть Finding #1: разные writer'ы используют разные fs-API,
    // нет общего store-модуля и cross-process lock.
  })
})

describe('Characterization: mcp-features HTTP transport — fail-open при пустом MCP_BEARER_TOKEN', () => {
  test('исходник mcp-features/index.js содержит ветку `if (!token) return next()` — auth выключен при пустом токене', () => {
    const src = fs.readFileSync(
      path.join(REPO_ROOT, 'mcp-features/index.js'),
      'utf-8',
    )
    // Текущая реализация: `if (!token) return next()` — fail-open.
    expect(src).toMatch(/if \(!token\) return next\(\)/)
    // Сравнение Bearer-токена через `===` (не timing-safe).
    expect(src).toMatch(/req\.headers\.authorization === `Bearer \$\{token\}`/)
  })
})
