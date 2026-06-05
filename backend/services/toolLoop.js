import { getToolsForRoute } from './toolRegistry.js'

const MAX_ITER = 5

export async function callLiteLLMChat({
  model,
  messages,
  tools,
  timeoutMs = 60000,
  temperature,
}) {
  const base = process.env.LITELLM_URL
  const apiKey = process.env.LITELLM_MASTER_KEY
  if (!base) throw new Error('LITELLM_URL not configured')

  const body = { model, messages }
  if (tools && tools.length) {
    body.tools = tools
    body.tool_choice = 'auto'
  }
  if (typeof temperature === 'number') body.temperature = temperature

  const target = `${base.replace(/\/+$/, '')}/v1/chat/completions`

  const upstream = await fetch(target, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  })

  const routedHeader = upstream.headers.get('x-litellm-model-group') || null
  const costHeader = upstream.headers.get('x-litellm-response-cost')
  const text = await upstream.text()
  let payload
  try {
    payload = text ? JSON.parse(text) : {}
  } catch (_) {
    throw new Error(`upstream non-JSON: ${text.slice(0, 200)}`)
  }
  if (!upstream.ok) {
    const msg = payload?.error?.message || `HTTP ${upstream.status}`
    const err = new Error(msg)
    err.upstreamStatus = upstream.status
    throw err
  }
  payload._routed = routedHeader
  payload._cost = costHeader ? Number(costHeader) : 0
  return payload
}

export async function runToolLoop({ messages, route, ctx, model }) {
  const { schemas, allowed, byName } = getToolsForRoute(route)
  const toolsUsed = []
  const violations = []
  let lastRouted = null
  let costUsd = 0
  let iterations = 0

  for (iterations = 1; iterations <= MAX_ITER; iterations++) {
    const resp = await callLiteLLMChat({
      model,
      messages,
      tools: schemas,
      temperature: 0,
    })

    if (resp._routed) lastRouted = resp._routed
    costUsd += resp._cost || 0

    const choice = resp.choices?.[0]
    const assistantMsg = choice?.message
    if (!assistantMsg) {
      return {
        final: '(пустой ответ модели)',
        toolsUsed,
        violations,
        routed: lastRouted,
        costUsd,
        iterations,
      }
    }

    const calls = assistantMsg.tool_calls || []
    console.log(
      `[toolLoop] iter=${iterations} route=${route} model=${model} calls=${calls.length} content_len=${(assistantMsg.content || '').length}`
    )
    if (!calls.length) {
      return {
        final: assistantMsg.content || '',
        toolsUsed,
        violations,
        routed: lastRouted,
        costUsd,
        iterations,
      }
    }

    messages.push({
      role: 'assistant',
      content: assistantMsg.content || '',
      tool_calls: calls,
    })

    for (const call of calls) {
      const name = call.function?.name
      const rawArgs = call.function?.arguments || '{}'
      let parsedArgs
      try {
        parsedArgs = JSON.parse(rawArgs)
      } catch (_) {
        parsedArgs = {}
      }

      const sanitized = stripForbiddenArgs(parsedArgs)
      if (sanitized.violated.length) {
        violations.push({ tool: name, fields: sanitized.violated })
        console.warn(
          `[toolLoop] stripped forbidden args from ${name}: ${sanitized.violated.join(',')}`
        )
      }

      let result
      if (!allowed.has(name)) {
        result = { error: `tool_not_allowed`, name }
        violations.push({ tool: name, reason: 'not_in_route_whitelist' })
      } else {
        try {
          result = await byName[name].handler(sanitized.args, { userId: ctx.userId })
          toolsUsed.push(name)
          console.log(`[toolLoop] executed ${name} for user=${ctx.userId} args=${JSON.stringify(sanitized.args)}`)
        } catch (e) {
          result = { error: 'tool_execution_failed', message: e.message }
          console.error(`[toolLoop] tool ${name} threw:`, e.message)
        }
      }

      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        name,
        content: JSON.stringify(result),
      })
    }
  }

  return {
    final: '(достигнут лимит итераций инструментов)',
    toolsUsed,
    violations,
    routed: lastRouted,
    costUsd,
    iterations: MAX_ITER,
    truncated: true,
  }
}

const FORBIDDEN_KEYS = ['userId', 'user', 'user_id', '_id', 'userid', 'uid']

function stripForbiddenArgs(args) {
  if (!args || typeof args !== 'object') return { args: {}, violated: [] }
  const out = {}
  const violated = []
  for (const [k, v] of Object.entries(args)) {
    if (FORBIDDEN_KEYS.includes(k)) {
      violated.push(k)
      continue
    }
    out[k] = v
  }
  return { args: out, violated }
}
