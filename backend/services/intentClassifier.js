import { callLiteLLMChat } from './toolLoop.js'

const SYSTEM_PROMPT = `You are a strict binary intent classifier for an e-commerce chat assistant.
Output exactly one word, lowercase, no punctuation, no explanation:
  - "personal" — if the user asks about THEIR OWN data: own orders, own profile, own cart, own deliveries, own payment history, their email, their address, their account.
  - "public"   — if the user asks about the catalog, products, prices, store policy, general questions, greetings, anything not tied to a specific user identity.

Examples:
  "what is the price of phone 13" -> public
  "show me products under $50"    -> public
  "hello, how are you"            -> public
  "what is your return policy"    -> public
  "show my orders"                -> personal
  "мои заказы"                    -> personal
  "когда придёт моя посылка"      -> personal
  "поменяй мой email"             -> personal
  "what is on my account"         -> personal

If ambiguous, answer "personal" (fail-safe).`

const LOCAL_MODEL =
  process.env.LITELLM_CLASSIFIER_MODEL || 'qwen-local'

const TIMEOUT_MS = Number(process.env.CLASSIFIER_TIMEOUT_MS) || 15000
const SHORT_TEXT_FAST_PATH = Number(process.env.CLASSIFIER_SHORT_BYPASS) || 15

export async function classifyIntent(message) {
  const text = (message || '').trim()
  if (!text) {
    console.log('[classifier] empty text -> public')
    return 'public'
  }

  // Fast-path: very short messages (greetings, ack, typos) — skip qwen LLM call.
  // On CPU-only Ollama the classifier takes 5-10s; greeting payloads carry no
  // personal data anyway, so default to `public` is safe and fast.
  if (text.length < SHORT_TEXT_FAST_PATH) {
    console.log(`[classifier] short_text len=${text.length} -> public (fast-path)`)
    return 'public'
  }

  try {
    const t0 = Date.now()
    const raw = await callLiteLLMChat({
      model: LOCAL_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: text },
      ],
      timeoutMs: TIMEOUT_MS,
      temperature: 0,
    })
    const dt = Date.now() - t0
    const rawContent = raw?.choices?.[0]?.message?.content || ''
    const out = rawContent.toLowerCase().replace(/[^a-z]/g, '')
    let decision
    if (out.startsWith('personal')) decision = 'personal'
    else if (out.startsWith('public')) decision = 'public'
    else decision = 'personal'
    console.log(
      `[classifier] decided=${decision} raw=${JSON.stringify(rawContent.slice(0, 40))} latency=${dt}ms`
    )
    return decision
  } catch (e) {
    console.error(`[classifier] fallback to personal: ${e.name} ${e.message}`)
    return 'personal'
  }
}
