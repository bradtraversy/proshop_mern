import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import { readFile, writeFile, rename } from 'fs/promises'
import asyncHandler from 'express-async-handler'
import { protect, admin } from '../middleware/authMiddleware.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const filePath = path.join(__dirname, '..', 'features.json')

const router = express.Router()

const VALID_STATUSES = ['Enabled', 'Testing', 'Disabled']

const readFlags = async (res) => {
  let raw
  try {
    raw = await readFile(filePath, 'utf-8')
  } catch (err) {
    if (err.code === 'ENOENT') {
      res.status(503)
      throw new Error('Feature flags configuration is temporarily unavailable')
    }
    throw err
  }
  try {
    return JSON.parse(raw)
  } catch {
    res.status(500)
    throw new Error('Feature flags file contains invalid JSON')
  }
}

router.get('/', asyncHandler(async (req, res) => {
  const data = await readFlags(res)
  res.json(data)
}))

router.patch('/:key', protect, admin, asyncHandler(async (req, res) => {
  const { key } = req.params
  const { status, traffic_percentage } = req.body

  const data = await readFlags(res)
  if (!data[key]) {
    res.status(404)
    throw new Error(`Feature flag '${key}' not found`)
  }

  if (status !== undefined) {
    if (!VALID_STATUSES.includes(status)) {
      res.status(400)
      throw new Error(`Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`)
    }
    data[key].status = status

    if (traffic_percentage === undefined) {
      if (status === 'Enabled') data[key].traffic_percentage = 100
      else if (status === 'Disabled') data[key].traffic_percentage = 0
      else {
        const tp = data[key].traffic_percentage
        data[key].traffic_percentage = (Number.isInteger(tp) && tp >= 1 && tp <= 99) ? tp : 10
      }
    }
  }

  if (traffic_percentage !== undefined) {
    const tp = Number(traffic_percentage)
    if (!Number.isInteger(tp) || tp < 0 || tp > 100) {
      res.status(400)
      throw new Error('traffic_percentage must be an integer between 0 and 100')
    }
    data[key].traffic_percentage = tp
  }

  data[key].last_modified = new Date().toISOString().slice(0, 10)

  const tmp = filePath + '.tmp'
  await writeFile(tmp, JSON.stringify(data, null, 2) + '\n', 'utf-8')
  await rename(tmp, filePath)

  res.json({ key, ...data[key] })
}))

export default router
