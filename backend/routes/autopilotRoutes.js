import express from 'express'
import asyncHandler from 'express-async-handler'

const router = express.Router()

router.post(
  '/feature-control',
  asyncHandler(async (req, res) => {
    const base = process.env.N8N_WEBHOOK_URL
    const apiKey = process.env.N8N_API_KEY

    if (!base) {
      res.status(500)
      throw new Error('N8N_WEBHOOK_URL is not configured on the server')
    }

    const target = `${base.replace(/\/+$/, '')}/feature-control`

    let upstream
    try {
      upstream = await fetch(target, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { 'X-API-Key': apiKey } : {}),
        },
        body: JSON.stringify(req.body || {}),
        signal: AbortSignal.timeout(110000),
      })
    } catch (e) {
      const status = e.name === 'TimeoutError' ? 504 : 502
      res.status(status).json({ success: false, message: `Upstream error: ${e.message}` })
      return
    }

    const text = await upstream.text()
    let payload
    try {
      payload = text ? JSON.parse(text) : {}
    } catch (_) {
      payload = { success: upstream.ok, message: text || `HTTP ${upstream.status}` }
    }

    res.status(upstream.status).json(payload)
  })
)

export default router
