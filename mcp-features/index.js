import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js'
import express from 'express'
import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FEATURES_PATH = join(__dirname, '..', 'backend', 'features.json')

function readFeatures() {
  try {
    return JSON.parse(readFileSync(FEATURES_PATH, 'utf-8'))
  } catch (err) {
    if (err.code === 'ENOENT') throw { error: 'FILE_READ_ERROR', message: `features.json not found at ${FEATURES_PATH}` }
    if (err instanceof SyntaxError) throw { error: 'JSON_PARSE_ERROR', message: `features.json contains invalid JSON: ${err.message}` }
    throw { error: 'FILE_READ_ERROR', message: `Cannot read features.json: ${err.message}` }
  }
}

function writeFeatures(data) {
  try {
    writeFileSync(FEATURES_PATH, JSON.stringify(data, null, 2) + '\n', 'utf-8')
  } catch (err) {
    throw { error: 'FILE_WRITE_ERROR', message: `Cannot write features.json: ${err.message}` }
  }
}

function today() {
  return new Date().toISOString().split('T')[0]
}

function checkDependencies(feature, features) {
  return (feature.dependencies || [])
    .map(depId => {
      const dep = features[depId]
      if (!dep) return `Dependency '${depId}' does not exist in features.json.`
      if (dep.status !== 'Enabled') return `Dependency '${depId}' is in status '${dep.status}', not 'Enabled'. This feature may not function correctly.`
      return null
    })
    .filter(Boolean)
}

function makeResponse(id, f, extra = {}) {
  return {
    feature_id: id,
    name: f.name,
    description: f.description,
    status: f.status,
    traffic_percentage: f.traffic_percentage,
    last_modified: f.last_modified,
    ...(f.targeted_segments && { targeted_segments: f.targeted_segments }),
    ...(f.rollout_strategy && { rollout_strategy: f.rollout_strategy }),
    ...(f.dependencies?.length && { dependencies: f.dependencies }),
    ...extra,
  }
}

function errObj(error, message, feature_id) {
  return { error, message, feature_id }
}

function createServer() {
  const server = new McpServer({ name: 'proshop-feature-flags', version: '1.0.0' })

// ─── Tool 1: get_feature_info ────────────────────────────────────────────────

server.tool(
  'get_feature_info',
  `Retrieve the complete current state of a single feature flag including status, traffic_percentage, last_modified, dependencies, and rollout strategy.

Use this when you need to inspect a feature before modifying it, or when the user asks about the current configuration of a specific flag.

Do NOT use this to list all features — use the feature_flags resource for that.

Input: the snake_case feature ID exactly as it appears as a key in features.json (e.g. "dark_mode", "search_v2").

Returns: full feature object with all fields, plus a "dependencies_status" map showing the current status of each dependency.

Examples:
  { "feature_id": "dark_mode" }
  { "feature_id": "semantic_search" }
  { "feature_id": "multi_step_checkout_v2" }`,
  {
    feature_id: z.string().describe('The snake_case key of the feature in features.json, e.g. "dark_mode".'),
  },
  async ({ feature_id }) => {
    let features
    try { features = readFeatures() } catch (err) {
      return { content: [{ type: 'text', text: JSON.stringify(err) }], isError: true }
    }

    const feature = features[feature_id]
    if (!feature) {
      return {
        content: [{ type: 'text', text: JSON.stringify(errObj('FEATURE_NOT_FOUND', `No feature with ID '${feature_id}' exists in features.json. Available IDs: ${Object.keys(features).join(', ')}.`, feature_id)) }],
        isError: true,
      }
    }

    const depsStatus = {}
    for (const depId of (feature.dependencies || [])) {
      depsStatus[depId] = features[depId] ? features[depId].status : 'MISSING'
    }

    return { content: [{ type: 'text', text: JSON.stringify(makeResponse(feature_id, feature, { dependencies_status: depsStatus }), null, 2) }] }
  },
)

// ─── Tool 2: set_feature_state ──────────────────────────────────────────────

server.tool(
  'set_feature_state',
  `Change the status of a feature flag. Automatically adjusts traffic_percentage and updates last_modified.

YOU MUST check dependencies before enabling a feature: if any dependency is not in "Enabled" status, the feature may not function correctly. The tool will return warnings but will NOT block the state change.

When transitioning to "Disabled": sets traffic_percentage to 0.
When transitioning to "Enabled": sets traffic_percentage to 100.
When transitioning to "Testing": keeps current traffic_percentage if in 1-99 range, otherwise defaults to 10.

Use adjust_traffic_rollout to fine-tune traffic_percentage without changing status.

Input: feature_id (snake_case key), state (one of "Disabled", "Testing", "Enabled", case-sensitive).

Examples:
  { "feature_id": "stripe_alternative", "state": "Disabled" }
  { "feature_id": "dark_mode", "state": "Testing" }
  { "feature_id": "paypal_express_buttons", "state": "Enabled" }`,
  {
    feature_id: z.string().describe('The snake_case key of the feature in features.json.'),
    state: z.enum(['Disabled', 'Testing', 'Enabled']).describe('Target status. Case-sensitive. Must be exactly one of: Disabled, Testing, Enabled.'),
  },
  async ({ feature_id, state }) => {
    let features
    try { features = readFeatures() } catch (err) {
      return { content: [{ type: 'text', text: JSON.stringify(err) }], isError: true }
    }

    const feature = features[feature_id]
    if (!feature) {
      return {
        content: [{ type: 'text', text: JSON.stringify(errObj('FEATURE_NOT_FOUND', `No feature with ID '${feature_id}' exists in features.json.`, feature_id)) }],
        isError: true,
      }
    }

    if (state === 'Disabled') feature.traffic_percentage = 0
    else if (state === 'Enabled') feature.traffic_percentage = 100
    else {
      const tp = feature.traffic_percentage
      feature.traffic_percentage = (tp >= 1 && tp <= 99) ? tp : 10
    }

    feature.status = state
    feature.last_modified = today()

    const warnings = checkDependencies(feature, features)

    try { writeFeatures(features) } catch (err) {
      return { content: [{ type: 'text', text: JSON.stringify(err) }], isError: true }
    }

    const result = makeResponse(feature_id, feature)
    if (warnings.length) result.warnings = warnings
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
  },
)

// ─── Tool 3: adjust_traffic_rollout ─────────────────────────────────────────

server.tool(
  'adjust_traffic_rollout',
  `Change the traffic_percentage of a feature in "Testing" state without changing its status. Updates last_modified.

YOU MUST NOT call this on features with status "Disabled" or "Enabled" — use set_feature_state to change status first. This tool is ONLY valid for "Testing" features.

YOU MUST pass an integer 0-100. Decimals will be rejected by schema validation.

When percentage is 0: a hint suggests using set_feature_state("Disabled") instead.
When percentage is 100: a hint suggests promoting via set_feature_state("Enabled").

Examples:
  { "feature_id": "dark_mode", "percentage": 50 }
  { "feature_id": "search_v2", "percentage": 25 }
  { "feature_id": "multi_step_checkout_v2", "percentage": 100 }`,
  {
    feature_id: z.string().describe('The snake_case key of the feature in features.json.'),
    percentage: z.number().int().min(0).max(100).describe('Integer from 0 to 100. Decimals are rejected.'),
  },
  async ({ feature_id, percentage }) => {
    let features
    try { features = readFeatures() } catch (err) {
      return { content: [{ type: 'text', text: JSON.stringify(err) }], isError: true }
    }

    const feature = features[feature_id]
    if (!feature) {
      return {
        content: [{ type: 'text', text: JSON.stringify(errObj('FEATURE_NOT_FOUND', `No feature with ID '${feature_id}' exists in features.json.`, feature_id)) }],
        isError: true,
      }
    }

    if (feature.status !== 'Testing') {
      return {
        content: [{ type: 'text', text: JSON.stringify(errObj('WRONG_STATUS_FOR_ROLLOUT', `adjust_traffic_rollout can only be called on features with status 'Testing'. '${feature_id}' is currently '${feature.status}'. Use set_feature_state to change its status first.`, feature_id)) }],
        isError: true,
      }
    }

    feature.traffic_percentage = percentage
    feature.last_modified = today()

    let hint = null
    if (percentage === 0) hint = `traffic_percentage is 0. Consider using set_feature_state("${feature_id}", "Disabled") instead.`
    else if (percentage === 100) hint = `traffic_percentage is 100. Consider promoting to Enabled via set_feature_state("${feature_id}", "Enabled").`

    try { writeFeatures(features) } catch (err) {
      return { content: [{ type: 'text', text: JSON.stringify(err) }], isError: true }
    }

    const result = makeResponse(feature_id, feature, { hint })
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
  },
)

// ─── Tool 4: list_features ──────────────────────────────────────────────────

server.tool(
  'list_features',
  `Return the full catalogue of feature flags with their descriptions and current state. Read-only.

Use this as the first step when the user asks "what feature flags exist", "show me all features", or when you need to discover the snake_case feature_id of a flag mentioned by its human name (e.g. "dark mode" → "dark_mode").

Prefer this tool over reading or grepping backend/features.json directly — it keeps the tool-call log consistent and applies the canonical response shape.

For inspecting a single flag in depth (including dependencies_status), use get_feature_info instead.

No input parameters.

Returns: an array of feature objects, each with feature_id, name, description, status, traffic_percentage, last_modified, implemented, and (when present) targeted_segments / rollout_strategy / dependencies.`,
  {},
  async () => {
    let features
    try { features = readFeatures() } catch (err) {
      return { content: [{ type: 'text', text: JSON.stringify(err) }], isError: true }
    }

    const list = Object.entries(features).map(([id, f]) => ({
      ...makeResponse(id, f),
      implemented: f.implemented,
    }))

    return { content: [{ type: 'text', text: JSON.stringify(list, null, 2) }] }
  },
)

// ─── Resource: all feature flags ────────────────────────────────────────────

server.resource(
  'feature-flags',
  'file:///features.json',
  'All feature flags with their current status, traffic_percentage, dependencies, and rollout info. Read-only. Use tools to modify.',
  async () => {
    const features = readFeatures()
    const summary = Object.entries(features).map(([id, f]) => ({
      feature_id: id,
      name: f.name,
      status: f.status,
      traffic_percentage: f.traffic_percentage,
      implemented: f.implemented,
      dependencies: f.dependencies || [],
    }))
    return {
      contents: [{ uri: 'file:///features.json', mimeType: 'application/json', text: JSON.stringify(summary, null, 2) }],
    }
  },
)

  return server
}

async function runStdio() {
  const transport = new StdioServerTransport()
  await createServer().connect(transport)
}

async function runHttp() {
  const port = Number(process.env.MCP_HTTP_PORT || process.env.MCP_SSE_PORT || 7777)
  const token = process.env.MCP_BEARER_TOKEN || ''
  const app = express()
  app.use(express.json())

  const transports = {}

  app.use('/mcp', (req, res, next) => {
    if (!token) return next()
    if (req.headers.authorization === `Bearer ${token}`) return next()
    res.status(401).send('Unauthorized')
  })

  app.post('/mcp', async (req, res) => {
    try {
      const sessionId = req.headers['mcp-session-id']
      let transport

      if (sessionId && transports[sessionId]) {
        transport = transports[sessionId]
      } else if (!sessionId && isInitializeRequest(req.body)) {
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (sid) => { transports[sid] = transport },
        })
        transport.onclose = () => {
          if (transport.sessionId) delete transports[transport.sessionId]
        }
        await createServer().connect(transport)
        await transport.handleRequest(req, res, req.body)
        return
      } else {
        res.status(400).json({
          jsonrpc: '2.0',
          error: { code: -32000, message: 'Bad Request: No valid session ID provided' },
          id: null,
        })
        return
      }

      await transport.handleRequest(req, res, req.body)
    } catch (err) {
      console.error('MCP POST error:', err)
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error' },
          id: null,
        })
      }
    }
  })

  const handleSessionRequest = async (req, res) => {
    const sessionId = req.headers['mcp-session-id']
    const transport = sessionId && transports[sessionId]
    if (!transport) {
      res.status(400).send('Invalid or missing session ID')
      return
    }
    await transport.handleRequest(req, res)
  }

  app.get('/mcp', handleSessionRequest)
  app.delete('/mcp', handleSessionRequest)

  app.listen(port, () => console.error(`MCP Streamable HTTP listening on http://0.0.0.0:${port}/mcp`))
}

const mode = process.env.MCP_TRANSPORT
  || (process.argv.includes('--http') || process.argv.includes('--sse') ? 'http' : 'stdio')
;((mode === 'http' || mode === 'sse') ? runHttp() : runStdio()).catch(console.error)
