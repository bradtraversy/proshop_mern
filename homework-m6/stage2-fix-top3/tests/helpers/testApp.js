// Shared test harness for Stage 2 characterization tests.
//
// server.js calls connectDB() and app.listen() at import time, so we cannot
// import it directly. Instead we rebuild the SAME route wiring here (minus DB
// connect + listen) so supertest can drive the real controllers + middleware.
//
// This mirrors backend/server.js lines 19-31, 52-53.
import express from 'express'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import jwt from 'jsonwebtoken'

import userRoutes from '../../../../backend/routes/userRoutes.js'
import orderRoutes from '../../../../backend/routes/orderRoutes.js'
import uploadRoutes from '../../../../backend/routes/uploadRoutes.js'
import {
  notFound,
  errorHandler,
} from '../../../../backend/middleware/errorMiddleware.js'

export const JWT_SECRET = 'test-secret-do-not-use-in-prod'

// Build an Express app wired exactly like server.js for the routes under test.
export function buildApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/users', userRoutes)
  app.use('/api/orders', orderRoutes)
  app.use('/api/upload', uploadRoutes)
  app.use(notFound)
  app.use(errorHandler)
  return app
}

// Sign a token the same way backend/utils/generateToken.js does.
export function tokenFor(id) {
  return jwt.sign({ id: id.toString() }, JWT_SECRET, { expiresIn: '30d' })
}

let mongod

// Spin an in-memory MongoDB and connect mongoose (mongoose 5 options).
export async function startDb() {
  process.env.JWT_SECRET = JWT_SECRET
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri(), {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useCreateIndex: true,
    useFindAndModify: false,
  })
}

export async function stopDb() {
  await mongoose.connection.dropDatabase()
  await mongoose.disconnect()
  if (mongod) await mongod.stop()
}

export async function clearDb() {
  const { collections } = mongoose.connection
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({})
  }
}
