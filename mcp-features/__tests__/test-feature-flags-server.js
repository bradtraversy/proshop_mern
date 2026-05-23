/**
 * Characterization + edge-case tests for `mcp-features/index.js`.
 *
 * Strategy: production `index.js` hardcodes FEATURES_PATH to
 * `backend/features.json` and does not export `createServer()`. To exercise
 * the real binary without mocking the FS we:
 *
 *   1. Back up the real `backend/features.json` in beforeAll, replace it with
 *      a controlled fixture in beforeEach, restore the original in afterAll
 *      (same pattern as `homework/M6/stage2-fix-top3/tests/test-feature-flag-store.js`).
 *   2. Spawn `node mcp-features/index.js` as a child process per test group
 *      and drive it through the official MCP SDK `Client` over stdio.
 *   3. For HTTP-transport tests (bearer auth, session handshake) spawn with
 *      `MCP_TRANSPORT=http` and hit it with `fetch` against a free port.
 *
 * If spec and implementation disagree, we test the implementation (this is
 * characterization). Divergences are flagged inline with `// NOTE:`.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import fs from 'fs'
import net from 'net'
import path from 'path'
import { fileURLToPath } from 'url'
import { spawn } from 'child_process'
import { setTimeout as delay } from 'timers/promises'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '../..')
const FEATURES_PATH = path.join(REPO_ROOT, 'backend', 'features.json')
const SERVER_ENTRY = path.join(REPO_ROOT, 'mcp-features', 'index.js')

const TODAY = new Date().toISOString().split('T')[0]

const FIXTURE = () => ({
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
    targeted_segments: ['beta_users'],
    rollout_strategy: 'canary',
  },
  semantic_search: {
    name: 'Semantic Search',
    description: 'Depends on search_v2.',
    status: 'Disabled',
    implemented: 'no',
    traffic_percentage: 0,
    last_modified: '2026-02-14',
    dependencies: ['search_v2'],
  },
  orphan_dep: {
    name: 'Orphan Dependency Feature',
    description: 'Has a dependency that does not exist.',
    status: 'Disabled',
    implemented: 'no',
    traffic_percentage: 0,
    last_modified: '2026-03-01',
    dependencies: ['does_not_exist'],
  },
  zero_traffic_testing: {
    name: 'Zero TP Testing',
    description: 'Testing flag whose tp starts at 0 (out of [1,99]).',
    status: 'Disabled',
    implemented: 'no',
    traffic_percentage: 0,
    last_modified: '2026-03-01',
  },
})

let originalFeaturesJson

beforeAll(() => {
  originalFeaturesJson = fs.readFileSync(FEATURES_PATH, 'utf-8')
})

afterAll(() => {
  fs.writeFileSync(FEATURES_PATH, originalFeaturesJson, 'utf-8')
})

beforeEach(() => {
  fs.writeFileSync(FEATURES_PATH, JSON.stringify(FIXTURE(), null, 2) + '\n', 'utf-8')
})

function readFile() {
  return JSON.parse(fs.readFileSync(FEATURES_PATH, 'utf-8'))
}

// ─── Helpers: MCP Client over stdio ─────────────────────────────────────────

async function connectStdioClient() {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [SERVER_ENTRY],
    env: { ...process.env, MCP_TRANSPORT: 'stdio' },
  })
  const client = new Client({ name: 'test-client', version: '0.0.1' }, { capabilities: {} })
  await client.connect(transport)
  return { client, transport }
}

async function callTool(client, name, args) {
  const res = await client.callTool({ name, arguments: args })
  // SDK returns { content: [...], isError? }
  const text = res.content?.[0]?.text
  let parsed
  try { parsed = JSON.parse(text) } catch { parsed = text }
  return { isError: !!res.isError, payload: parsed, raw: res }
}

// ─── Helpers: HTTP transport ────────────────────────────────────────────────

function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer()
    srv.unref()
    srv.on('error', reject)
    srv.listen(0, () => {
      const { port } = srv.address()
      srv.close(() => resolve(port))
    })
  })
}

async function waitForHttp(port, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      // Any TCP connect proves listener is up.
      await new Promise((resolve, reject) => {
        const s = net.connect(port, '127.0.0.1', () => { s.end(); resolve() })
        s.on('error', reject)
      })
      return
    } catch {
      await delay(100)
    }
  }
  throw new Error(`HTTP server did not come up on port ${port}`)
}

async function spawnHttpServer({ port, token }) {
  const child = spawn(process.execPath, [SERVER_ENTRY], {
    env: {
      ...process.env,
      MCP_TRANSPORT: 'http',
      MCP_HTTP_PORT: String(port),
      MCP_BEARER_TOKEN: token ?? '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  child.stdout.on('data', () => {})
  child.stderr.on('data', () => {})
  await waitForHttp(port)
  return child
}

function killChild(child) {
  return new Promise((resolve) => {
    if (!child || child.killed) return resolve()
    child.once('exit', () => resolve())
    child.kill('SIGKILL')
  })
}

function buildInitBody() {
  return {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test', version: '0.0.1' },
    },
  }
}

const ACCEPT_HEADERS = 'application/json, text/event-stream'

// ──────────────────────────────────────────────────────────────────────────
// STDIO TOOL TESTS
// ──────────────────────────────────────────────────────────────────────────

describe('stdio: list_features', () => {
  let client, transport
  beforeAll(async () => { ({ client, transport } = await connectStdioClient()) })
  afterAll(async () => { await transport.close() })

  test('returns every feature_id from features.json with full canonical shape', async () => {
    const { isError, payload } = await callTool(client, 'list_features', {})
    expect(isError).toBe(false)
    expect(Array.isArray(payload)).toBe(true)
    const ids = payload.map((f) => f.feature_id).sort()
    expect(ids).toEqual([
      'dark_mode',
      'orphan_dep',
      'search_v2',
      'semantic_search',
      'zero_traffic_testing',
    ])
    const dm = payload.find((f) => f.feature_id === 'dark_mode')
    expect(dm.status).toBe('Enabled')
    expect(dm.traffic_percentage).toBe(100)
    expect(dm.name).toBe('Dark Mode')
    expect(dm.implemented).toBe('yes')
    // search_v2 carries targeted_segments + rollout_strategy
    const sv2 = payload.find((f) => f.feature_id === 'search_v2')
    expect(sv2.targeted_segments).toEqual(['beta_users'])
    expect(sv2.rollout_strategy).toBe('canary')
  })
})

describe('stdio: get_feature_info', () => {
  let client, transport
  beforeAll(async () => { ({ client, transport } = await connectStdioClient()) })
  afterAll(async () => { await transport.close() })

  test('happy path: returns full feature object + dependencies_status map', async () => {
    const { isError, payload } = await callTool(client, 'get_feature_info', { feature_id: 'semantic_search' })
    expect(isError).toBe(false)
    expect(payload.feature_id).toBe('semantic_search')
    expect(payload.status).toBe('Disabled')
    expect(payload.traffic_percentage).toBe(0)
    expect(payload.dependencies).toEqual(['search_v2'])
    expect(payload.dependencies_status).toEqual({ search_v2: 'Testing' })
  })

  test('feature with missing dependency reports MISSING in dependencies_status', async () => {
    const { isError, payload } = await callTool(client, 'get_feature_info', { feature_id: 'orphan_dep' })
    expect(isError).toBe(false)
    expect(payload.dependencies_status).toEqual({ does_not_exist: 'MISSING' })
  })

  test('unknown feature_id returns isError + FEATURE_NOT_FOUND + lists available IDs', async () => {
    const { isError, payload } = await callTool(client, 'get_feature_info', { feature_id: 'nope_not_real' })
    expect(isError).toBe(true)
    expect(payload.error).toBe('FEATURE_NOT_FOUND')
    expect(payload.feature_id).toBe('nope_not_real')
    expect(payload.message).toMatch(/dark_mode/)
    expect(payload.message).toMatch(/search_v2/)
  })

  test('prototype-key edge case: feature_id="__proto__" — characterizes current impl', async () => {
    // NOTE (spec divergence): spec MF3 says impl should return FEATURE_NOT_FOUND.
    // Actual impl: `features[feature_id]` for "__proto__" returns Object.prototype
    // (truthy), so the not-found branch does NOT fire. The code then tries to
    // read `.dependencies` (undefined) and returns a response with mostly
    // undefined fields, which JSON.stringify drops. We characterize whichever
    // branch the current binary takes.
    const { isError, payload } = await callTool(client, 'get_feature_info', { feature_id: '__proto__' })
    if (isError) {
      // Future-proof: if hardening lands, this branch wins.
      expect(payload.error).toBe('FEATURE_NOT_FOUND')
    } else {
      // Current behavior: returns a "feature" object with feature_id set and
      // most descriptive fields undefined → omitted from JSON.
      expect(payload.feature_id).toBe('__proto__')
      expect(payload.status).toBeUndefined()
      expect(payload.dependencies_status).toEqual({})
    }
  })
})

describe('stdio: set_feature_state — traffic_percentage auto-adjust matrix', () => {
  let client, transport
  beforeAll(async () => { ({ client, transport } = await connectStdioClient()) })
  afterAll(async () => { await transport.close() })

  test('Enabled forces traffic_percentage=100 and updates last_modified to today', async () => {
    const { isError, payload } = await callTool(client, 'set_feature_state', { feature_id: 'semantic_search', state: 'Enabled' })
    expect(isError).toBe(false)
    expect(payload.status).toBe('Enabled')
    expect(payload.traffic_percentage).toBe(100)
    expect(payload.last_modified).toBe(TODAY)
    const disk = readFile()
    expect(disk.semantic_search.status).toBe('Enabled')
    expect(disk.semantic_search.traffic_percentage).toBe(100)
    expect(disk.semantic_search.last_modified).toBe(TODAY)
  })

  test('Disabled forces traffic_percentage=0 even if it was 100', async () => {
    const { isError, payload } = await callTool(client, 'set_feature_state', { feature_id: 'dark_mode', state: 'Disabled' })
    expect(isError).toBe(false)
    expect(payload.status).toBe('Disabled')
    expect(payload.traffic_percentage).toBe(0)
    expect(readFile().dark_mode.traffic_percentage).toBe(0)
  })

  test('Testing keeps current tp when in [1,99] (search_v2 starts at 25)', async () => {
    const { payload } = await callTool(client, 'set_feature_state', { feature_id: 'search_v2', state: 'Testing' })
    expect(payload.status).toBe('Testing')
    expect(payload.traffic_percentage).toBe(25)
    expect(readFile().search_v2.traffic_percentage).toBe(25)
  })

  test('Testing falls back to 10 when current tp is 0 (out of [1,99])', async () => {
    const { payload } = await callTool(client, 'set_feature_state', { feature_id: 'zero_traffic_testing', state: 'Testing' })
    expect(payload.status).toBe('Testing')
    expect(payload.traffic_percentage).toBe(10)
    expect(readFile().zero_traffic_testing.traffic_percentage).toBe(10)
  })

  test('Testing boundary: tp=100 is OUT of [1,99] → falls back to 10', async () => {
    // dark_mode starts as Enabled with tp=100
    const { payload } = await callTool(client, 'set_feature_state', { feature_id: 'dark_mode', state: 'Testing' })
    expect(payload.traffic_percentage).toBe(10)
  })

  test('dependency warnings: enabling semantic_search whose dep search_v2 is Testing returns warnings, but writes the new state anyway', async () => {
    const { isError, payload } = await callTool(client, 'set_feature_state', { feature_id: 'semantic_search', state: 'Enabled' })
    expect(isError).toBe(false)
    expect(payload.status).toBe('Enabled')
    expect(Array.isArray(payload.warnings)).toBe(true)
    expect(payload.warnings.length).toBe(1)
    expect(payload.warnings[0]).toMatch(/search_v2/)
    expect(payload.warnings[0]).toMatch(/Testing/)
    // State is still persisted despite warning (non-blocking by design, ADR-007)
    expect(readFile().semantic_search.status).toBe('Enabled')
  })

  test('missing-dependency warning lists the missing dep by id', async () => {
    const { payload } = await callTool(client, 'set_feature_state', { feature_id: 'orphan_dep', state: 'Enabled' })
    expect(payload.warnings).toBeDefined()
    expect(payload.warnings.length).toBe(1)
    expect(payload.warnings[0]).toMatch(/does_not_exist/)
    expect(payload.warnings[0]).toMatch(/does not exist/)
  })

  test('unknown feature_id returns FEATURE_NOT_FOUND and does not mutate the file', async () => {
    const before = fs.readFileSync(FEATURES_PATH, 'utf-8')
    const { isError, payload } = await callTool(client, 'set_feature_state', { feature_id: 'ghost', state: 'Enabled' })
    expect(isError).toBe(true)
    expect(payload.error).toBe('FEATURE_NOT_FOUND')
    expect(payload.feature_id).toBe('ghost')
    expect(fs.readFileSync(FEATURES_PATH, 'utf-8')).toBe(before)
  })

  test('invalid state value (lowercase) rejected by Zod enum — case-sensitive', async () => {
    const res = await client.callTool({ name: 'set_feature_state', arguments: { feature_id: 'dark_mode', state: 'enabled' } })
    expect(res.isError).toBe(true)
    expect(res.content[0].text).toMatch(/Input validation error|invalid_enum_value/)
    // File untouched
    expect(readFile().dark_mode.status).toBe('Enabled')
  })
})

describe('stdio: adjust_traffic_rollout', () => {
  let client, transport
  beforeAll(async () => { ({ client, transport } = await connectStdioClient()) })
  afterAll(async () => { await transport.close() })

  test('happy path: sets percentage on a Testing feature, status unchanged, last_modified=today', async () => {
    const { isError, payload } = await callTool(client, 'adjust_traffic_rollout', { feature_id: 'search_v2', percentage: 50 })
    expect(isError).toBe(false)
    expect(payload.status).toBe('Testing')
    expect(payload.traffic_percentage).toBe(50)
    expect(payload.last_modified).toBe(TODAY)
    expect(payload.hint).toBeNull()
    const disk = readFile()
    expect(disk.search_v2.status).toBe('Testing')
    expect(disk.search_v2.traffic_percentage).toBe(50)
  })

  test('rejects when status !== Testing (Enabled) → WRONG_STATUS_FOR_ROLLOUT, no write', async () => {
    const before = fs.readFileSync(FEATURES_PATH, 'utf-8')
    const { isError, payload } = await callTool(client, 'adjust_traffic_rollout', { feature_id: 'dark_mode', percentage: 30 })
    expect(isError).toBe(true)
    expect(payload.error).toBe('WRONG_STATUS_FOR_ROLLOUT')
    expect(payload.message).toMatch(/Enabled/)
    expect(payload.feature_id).toBe('dark_mode')
    expect(fs.readFileSync(FEATURES_PATH, 'utf-8')).toBe(before)
  })

  test('rejects when status !== Testing (Disabled) → WRONG_STATUS_FOR_ROLLOUT', async () => {
    const { isError, payload } = await callTool(client, 'adjust_traffic_rollout', { feature_id: 'semantic_search', percentage: 30 })
    expect(isError).toBe(true)
    expect(payload.error).toBe('WRONG_STATUS_FOR_ROLLOUT')
    expect(payload.message).toMatch(/Disabled/)
  })

  test('percentage=0 emits hint suggesting Disabled', async () => {
    const { payload } = await callTool(client, 'adjust_traffic_rollout', { feature_id: 'search_v2', percentage: 0 })
    expect(payload.traffic_percentage).toBe(0)
    expect(payload.hint).toMatch(/Disabled/)
    expect(payload.hint).toMatch(/search_v2/)
  })

  test('percentage=100 emits hint suggesting Enabled', async () => {
    const { payload } = await callTool(client, 'adjust_traffic_rollout', { feature_id: 'search_v2', percentage: 100 })
    expect(payload.traffic_percentage).toBe(100)
    expect(payload.hint).toMatch(/Enabled/)
  })

  test('Zod rejects non-integer percentage (50.5)', async () => {
    const res = await client.callTool({ name: 'adjust_traffic_rollout', arguments: { feature_id: 'search_v2', percentage: 50.5 } })
    expect(res.isError).toBe(true)
    expect(res.content[0].text).toMatch(/Input validation error|invalid_type/)
    expect(readFile().search_v2.traffic_percentage).toBe(25)
  })

  test('Zod rejects out-of-range percentage (-1, 101)', async () => {
    const r1 = await client.callTool({ name: 'adjust_traffic_rollout', arguments: { feature_id: 'search_v2', percentage: -1 } })
    expect(r1.isError).toBe(true)
    expect(r1.content[0].text).toMatch(/Input validation error|too_small/)
    const r2 = await client.callTool({ name: 'adjust_traffic_rollout', arguments: { feature_id: 'search_v2', percentage: 101 } })
    expect(r2.isError).toBe(true)
    expect(r2.content[0].text).toMatch(/Input validation error|too_big/)
    expect(readFile().search_v2.traffic_percentage).toBe(25)
  })

  test('unknown feature_id → FEATURE_NOT_FOUND, no write', async () => {
    const before = fs.readFileSync(FEATURES_PATH, 'utf-8')
    const { isError, payload } = await callTool(client, 'adjust_traffic_rollout', { feature_id: 'ghost', percentage: 50 })
    expect(isError).toBe(true)
    expect(payload.error).toBe('FEATURE_NOT_FOUND')
    expect(fs.readFileSync(FEATURES_PATH, 'utf-8')).toBe(before)
  })
})

describe('stdio: I/O failure modes', () => {
  test('features.json missing → tool returns isError FILE_READ_ERROR', async () => {
    fs.rmSync(FEATURES_PATH)
    const { client, transport } = await connectStdioClient()
    try {
      const { isError, payload } = await callTool(client, 'list_features', {})
      expect(isError).toBe(true)
      expect(payload.error).toBe('FILE_READ_ERROR')
      expect(payload.message).toMatch(/features\.json/)
    } finally {
      await transport.close()
      // beforeEach (next test) will recreate it, but we restore now too for safety
      fs.writeFileSync(FEATURES_PATH, JSON.stringify(FIXTURE(), null, 2) + '\n', 'utf-8')
    }
  })

  test('features.json contains invalid JSON → JSON_PARSE_ERROR', async () => {
    fs.writeFileSync(FEATURES_PATH, '{not-json', 'utf-8')
    const { client, transport } = await connectStdioClient()
    try {
      const { isError, payload } = await callTool(client, 'get_feature_info', { feature_id: 'dark_mode' })
      expect(isError).toBe(true)
      expect(payload.error).toBe('JSON_PARSE_ERROR')
      expect(payload.message).toMatch(/invalid JSON/i)
    } finally {
      await transport.close()
    }
  })
})

// ──────────────────────────────────────────────────────────────────────────
// HTTP TRANSPORT TESTS (bearer auth, init handshake, session handling)
// ──────────────────────────────────────────────────────────────────────────

describe('http transport: bearer auth + session handshake', () => {
  test('SECURITY characterization: empty MCP_BEARER_TOKEN is fail-open (initialize succeeds without Authorization)', async () => {
    const port = await getFreePort()
    const child = await spawnHttpServer({ port, token: '' })
    try {
      const res = await fetch(`http://127.0.0.1:${port}/mcp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: ACCEPT_HEADERS },
        body: JSON.stringify(buildInitBody()),
      })
      // NOTE: documented Stage1 SEC HIGH — fail-open. We characterize the bug:
      // request without Authorization is NOT 401 when token env is empty.
      expect(res.status).not.toBe(401)
      expect([200, 202]).toContain(res.status)
      expect(res.headers.get('mcp-session-id')).toBeTruthy()
    } finally {
      await killChild(child)
    }
  })

  test('with MCP_BEARER_TOKEN set, request WITHOUT Authorization → 401 Unauthorized', async () => {
    const port = await getFreePort()
    const child = await spawnHttpServer({ port, token: 'super-secret-123' })
    try {
      const res = await fetch(`http://127.0.0.1:${port}/mcp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: ACCEPT_HEADERS },
        body: JSON.stringify(buildInitBody()),
      })
      expect(res.status).toBe(401)
      const body = await res.text()
      expect(body).toMatch(/Unauthorized/i)
    } finally {
      await killChild(child)
    }
  })

  test('with MCP_BEARER_TOKEN set, wrong token → 401', async () => {
    const port = await getFreePort()
    const child = await spawnHttpServer({ port, token: 'super-secret-123' })
    try {
      const res = await fetch(`http://127.0.0.1:${port}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: ACCEPT_HEADERS,
          Authorization: 'Bearer wrong-token',
        },
        body: JSON.stringify(buildInitBody()),
      })
      expect(res.status).toBe(401)
    } finally {
      await killChild(child)
    }
  })

  test('with MCP_BEARER_TOKEN set, correct Bearer → initialize succeeds and Mcp-Session-Id header is issued', async () => {
    const port = await getFreePort()
    const child = await spawnHttpServer({ port, token: 'super-secret-123' })
    try {
      const res = await fetch(`http://127.0.0.1:${port}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: ACCEPT_HEADERS,
          Authorization: 'Bearer super-secret-123',
        },
        body: JSON.stringify(buildInitBody()),
      })
      expect(res.status).not.toBe(401)
      expect([200, 202]).toContain(res.status)
      const sid = res.headers.get('mcp-session-id')
      expect(sid).toBeTruthy()
      expect(sid.length).toBeGreaterThan(8)
    } finally {
      await killChild(child)
    }
  })

  test('non-initialize POST without a session id → 400 "No valid session ID provided"', async () => {
    const port = await getFreePort()
    const child = await spawnHttpServer({ port, token: '' })
    try {
      const res = await fetch(`http://127.0.0.1:${port}/mcp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: ACCEPT_HEADERS },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/list',
          params: {},
        }),
      })
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.code).toBe(-32000)
      expect(body.error.message).toMatch(/No valid session ID provided/i)
    } finally {
      await killChild(child)
    }
  })

  test('GET /mcp with a stale/unknown session id → 400 "Invalid or missing session ID"', async () => {
    const port = await getFreePort()
    const child = await spawnHttpServer({ port, token: '' })
    try {
      const res = await fetch(`http://127.0.0.1:${port}/mcp`, {
        method: 'GET',
        headers: {
          Accept: ACCEPT_HEADERS,
          'mcp-session-id': 'definitely-not-a-real-session',
        },
      })
      expect(res.status).toBe(400)
      const body = await res.text()
      expect(body).toMatch(/Invalid or missing session ID/i)
    } finally {
      await killChild(child)
    }
  })
})

// ──────────────────────────────────────────────────────────────────────────
// FILE-WRITE CHARACTERIZATION (atomicity drift vs Express)
// ──────────────────────────────────────────────────────────────────────────

describe('characterization: write strategy drift between mcp-features and backend route', () => {
  test('mcp-features/index.js uses sync writeFileSync (NOT atomic) — documents ADR-007 divergence', () => {
    const src = fs.readFileSync(SERVER_ENTRY, 'utf-8')
    expect(src).toMatch(/writeFileSync\(/)
    // No tmp+rename in mcp-features (Express side has it; MCP side does not).
    expect(src).not.toMatch(/renameSync/)
    expect(src).not.toMatch(/\.tmp/)
  })
})
