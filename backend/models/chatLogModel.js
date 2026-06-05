import mongoose from 'mongoose'

const chatLogSchema = mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
      index: true,
    },
    route: { type: String, enum: ['personal', 'public'], required: true },
    model: { type: String, required: true },
    toolsUsed: { type: [String], default: [] },
    messageLength: { type: Number, required: true },
    piiEntityTypes: { type: [String], default: [] },
    latencyMs: { type: Number, required: true },
    costUsd: { type: Number, default: 0 },
    iterations: { type: Number, default: 1 },
    status: { type: String, enum: ['ok', 'error', 'timeout'], default: 'ok' },
    errorCode: { type: String, default: null },
    // Content fields. Written only when CHAT_LOG_CONTENT !== '0'.
    // PII RISK: store user content + replies + full payload in DB.
    // Encrypt at rest / restrict DB access / consider redaction.
    message: { type: String, default: null },
    reply: { type: String, default: null },
    payloadMessages: {
      type: [
        new mongoose.Schema(
          {
            role: String,
            content: String,
          },
          { _id: false }
        ),
      ],
      default: [],
    },
  },
  { timestamps: true, versionKey: false }
)

chatLogSchema.index({ user: 1, createdAt: -1 })

const ChatLog = mongoose.model('ChatLog', chatLogSchema)

export default ChatLog
