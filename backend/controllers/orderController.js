import asyncHandler from 'express-async-handler'
import Order from '../models/orderModel.js'
import Product from '../models/productModel.js'

const TAX_RATE = 0.15
const FREE_SHIPPING_THRESHOLD = 100
const SHIPPING_FEE = 100

const isOwnerOrAdmin = (order, user) => {
  if (!user) return false
  if (user.isAdmin) return true
  const ownerId =
    order.user && order.user._id ? order.user._id : order.user
  return String(ownerId) === String(user._id)
}

// @desc    Create new order
// @route   POST /api/orders
// @access  Private
const addOrderItems = asyncHandler(async (req, res) => {
  const {
    orderItems,
    shippingAddress,
    paymentMethod,
    giftMessage,
  } = req.body

  if (orderItems && orderItems.length === 0) {
    res.status(400)
    throw new Error('No order items')
    return
  }

  if (giftMessage && giftMessage.length > 200) {
    res.status(400)
    throw new Error('Gift message must be 200 characters or fewer')
  }

  const productIds = orderItems.map((i) => i.product)
  const dbProducts = await Product.find({ _id: { $in: productIds } })
    .select('price name image')
    .lean()
  const priceById = new Map(
    dbProducts.map((p) => [String(p._id), p])
  )

  const verifiedItems = orderItems.map((item) => {
    const dbp = priceById.get(String(item.product))
    if (!dbp) {
      res.status(400)
      throw new Error(`Product not found: ${item.product}`)
    }
    const qty = Number(item.qty)
    if (!Number.isInteger(qty) || qty < 1 || qty > 99) {
      res.status(400)
      throw new Error('Invalid qty')
    }
    return {
      name: dbp.name,
      qty,
      image: dbp.image,
      price: dbp.price,
      product: item.product,
    }
  })

  const itemsPrice = Number(
    verifiedItems
      .reduce((sum, i) => sum + i.price * i.qty, 0)
      .toFixed(2)
  )
  const shippingPrice = itemsPrice > FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE
  const taxPrice = Number((itemsPrice * TAX_RATE).toFixed(2))
  const totalPrice = Number(
    (itemsPrice + shippingPrice + taxPrice).toFixed(2)
  )

  const order = new Order({
    orderItems: verifiedItems,
    user: req.user._id,
    shippingAddress,
    paymentMethod,
    itemsPrice,
    taxPrice,
    shippingPrice,
    totalPrice,
    giftMessage: giftMessage || '',
  })

  const createdOrder = await order.save()

  res.status(201).json(createdOrder)
})

// @desc    Get order by ID
// @route   GET /api/orders/:id
// @access  Private
const getOrderById = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id).populate(
    'user',
    'name email'
  )

  if (!order) {
    res.status(404)
    throw new Error('Order not found')
  }

  if (!isOwnerOrAdmin(order, req.user)) {
    res.status(403)
    throw new Error('Not authorized to view this order')
  }

  res.json(order)
})

// @desc    Update order to paid
// @route   GET /api/orders/:id/pay
// @access  Private
const updateOrderToPaid = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id)

  if (!order) {
    res.status(404)
    throw new Error('Order not found')
  }

  if (!isOwnerOrAdmin(order, req.user)) {
    res.status(403)
    throw new Error('Not authorized to pay this order')
  }

  order.isPaid = true
  order.paidAt = Date.now()
  order.paymentResult = {
    id: req.body.id,
    status: req.body.status,
    update_time: req.body.update_time,
    email_address: req.body.payer?.email_address,
  }

  const updatedOrder = await order.save()

  res.json(updatedOrder)
})

// @desc    Update order to delivered
// @route   GET /api/orders/:id/deliver
// @access  Private/Admin
const updateOrderToDelivered = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id)

  if (order) {
    order.isDelivered = true
    order.deliveredAt = Date.now()

    const updatedOrder = await order.save()

    res.json(updatedOrder)
  } else {
    res.status(404)
    throw new Error('Order not found')
  }
})

// @desc    Get logged in user orders
// @route   GET /api/orders/myorders
// @access  Private
const getMyOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ user: req.user._id })
  res.json(orders)
})

// @desc    Get all orders
// @route   GET /api/orders
// @access  Private/Admin
const getOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({}).populate('user', 'id name')
  res.json(orders)
})

export {
  addOrderItems,
  getOrderById,
  updateOrderToPaid,
  updateOrderToDelivered,
  getMyOrders,
  getOrders,
}
