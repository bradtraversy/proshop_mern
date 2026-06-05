import Product from '../models/productModel.js'
import Order from '../models/orderModel.js'
import User from '../models/userModel.js'

const MAX_LIMIT = 20

export const tools = {
  getProducts: {
    public: true,
    schema: {
      type: 'function',
      function: {
        name: 'getProducts',
        description:
          'Search the public product catalog. Use when the user asks about products, prices, availability, brands, or general catalog info. Returns at most 20 items.',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Optional case-insensitive substring to match product name.',
            },
            limit: {
              type: 'number',
              description: 'Max number of items to return. Capped at 20.',
            },
          },
          required: [],
        },
      },
    },
    handler: async ({ query, limit }) => {
      const cap = Math.min(Math.max(Number(limit) || 10, 1), MAX_LIMIT)
      const filter =
        typeof query === 'string' && query.trim()
          ? { name: { $regex: escapeRegex(query.trim()), $options: 'i' } }
          : {}
      const rows = await Product.find(filter)
        .select('name brand category price countInStock rating numReviews')
        .limit(cap)
        .lean()
      return { count: rows.length, items: rows }
    },
  },

  getMyOrders: {
    public: false,
    schema: {
      type: 'function',
      function: {
        name: 'getMyOrders',
        description:
          'Return the authenticated user\'s 10 most recent orders. Use when the user asks about THEIR OWN orders, deliveries, payment status, order history. The current user identity is taken from the session — never accept a user id parameter.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    handler: async (_args, ctx) => {
      assertUserId(ctx)
      const rows = await Order.find({ user: ctx.userId })
        .select(
          'createdAt totalPrice isPaid paidAt isDelivered deliveredAt orderItems.name orderItems.qty'
        )
        .sort({ createdAt: -1 })
        .limit(10)
        .lean()
      return { count: rows.length, orders: rows }
    },
  },

  getMyProfile: {
    public: false,
    schema: {
      type: 'function',
      function: {
        name: 'getMyProfile',
        description:
          'Return the authenticated user\'s public profile fields (name, email, member-since). Use when the user asks about THEIR OWN account info. Never accept a user id parameter.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    handler: async (_args, ctx) => {
      assertUserId(ctx)
      const u = await User.findById(ctx.userId)
        .select('name email isAdmin createdAt')
        .lean()
      if (!u) return { error: 'user_not_found' }
      return { profile: u }
    },
  },
}

function assertUserId(ctx) {
  if (!ctx || !ctx.userId) {
    throw new Error('ctx.userId is required for personal tools')
  }
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function getToolsForRoute(route) {
  const entries = Object.entries(tools)
  const filtered =
    route === 'personal' ? entries : entries.filter(([, t]) => t.public)
  return {
    schemas: filtered.map(([, t]) => t.schema),
    allowed: new Set(filtered.map(([name]) => name)),
    byName: Object.fromEntries(filtered),
  }
}
