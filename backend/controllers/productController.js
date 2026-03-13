import asyncHandler from 'express-async-handler'
import mongoose from 'mongoose'
import Product from '../models/productModel.js'

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10
const TOP_PRODUCTS_LIMIT = 3

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Validates a MongoDB ObjectId and throws a 400 error if invalid.
 * Prevents unnecessary DB queries for malformed IDs.
 */
const validateObjectId = (id, res) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400)
    throw new Error('Invalid product ID format')
  }
}

/**
 * Finds a product by ID or throws a 404 error.
 * Centralizes the repeated find-or-throw pattern across handlers.
 */
const findProductOrFail = async (id, res) => {
  const product = await Product.findById(id)
  if (!product) {
    res.status(404)
    throw new Error('Product not found')
  }
  return product
}

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * @desc    Fetch all products with optional keyword search and pagination
 * @route   GET /api/products?keyword=<string>&pageNumber=<number>
 * @access  Public
 */
const getProducts = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.pageNumber) || 1) // Ensure page is at least 1

  // Build a case-insensitive regex filter if a keyword is provided
  const keyword = req.query.keyword?.trim()
  const filter = keyword
    ? { name: { $regex: keyword, $options: 'i' } }
    : {}

  // Run count and fetch in parallel for better performance
  const [count, products] = await Promise.all([
    Product.countDocuments(filter),
    Product.find(filter)
      .limit(PAGE_SIZE)
      .skip(PAGE_SIZE * (page - 1))
      .lean(), // .lean() returns plain JS objects — faster when you don't need Mongoose methods
  ])

  res.json({
    products,
    page,
    pages: Math.ceil(count / PAGE_SIZE),
    total: count, // Useful for frontend pagination UIs
  })
})

/**
 * @desc    Fetch a single product by ID
 * @route   GET /api/products/:id
 * @access  Public
 */
const getProductById = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, res)
  const product = await findProductOrFail(req.params.id, res)
  res.json(product)
})

/**
 * @desc    Delete a product by ID
 * @route   DELETE /api/products/:id
 * @access  Private/Admin
 */
const deleteProduct = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, res)

  // findByIdAndDelete is atomic and avoids the extra find + remove round-trip
  const product = await Product.findByIdAndDelete(req.params.id)

  if (!product) {
    res.status(404)
    throw new Error('Product not found')
  }

  res.json({ message: 'Product removed successfully' })
})

/**
 * @desc    Create a new product with placeholder/sample data
 * @route   POST /api/products
 * @access  Private/Admin
 */
const createProduct = asyncHandler(async (req, res) => {
  const product = new Product({
    name: 'Sample name',
    price: 0,
    user: req.user._id,
    image: '/images/sample.jpg',
    brand: 'Sample brand',
    category: 'Sample category',
    countInStock: 0,
    numReviews: 0,
    description: 'Sample description',
  })

  const createdProduct = await product.save()
  res.status(201).json(createdProduct)
})

/**
 * @desc    Update an existing product by ID
 * @route   PUT /api/products/:id
 * @access  Private/Admin
 */
const updateProduct = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, res)

  // Whitelist only the fields that are allowed to be updated
  const allowedFields = ['name', 'price', 'description', 'image', 'brand', 'category', 'countInStock']
  const updates = {}
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field]
    }
  }

  // findByIdAndUpdate with { new: true } returns the updated document directly
  const updatedProduct = await Product.findByIdAndUpdate(
    req.params.id,
    { $set: updates },
    { new: true, runValidators: true } // runValidators ensures schema rules are enforced
  )

  if (!updatedProduct) {
    res.status(404)
    throw new Error('Product not found')
  }

  res.json(updatedProduct)
})

/**
 * @desc    Submit a review for a product
 * @route   POST /api/products/:id/reviews
 * @access  Private
 */
const createProductReview = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, res)

  const { rating, comment } = req.body

  // Basic input validation before hitting the database
  if (!rating || !comment?.trim()) {
    res.status(400)
    throw new Error('Rating and comment are required')
  }

  const parsedRating = Number(rating)
  if (isNaN(parsedRating) || parsedRating < 1 || parsedRating > 5) {
    res.status(400)
    throw new Error('Rating must be a number between 1 and 5')
  }

  const product = await findProductOrFail(req.params.id, res)

  // Prevent the same user from reviewing the same product twice
  const alreadyReviewed = product.reviews.some(
    (r) => r.user.toString() === req.user._id.toString()
  )
  if (alreadyReviewed) {
    res.status(400)
    throw new Error('You have already reviewed this product')
  }

  product.reviews.push({
    name: req.user.name,
    rating: parsedRating,
    comment: comment.trim(),
    user: req.user._id,
  })

  // Recalculate aggregate review stats
  product.numReviews = product.reviews.length
  product.rating =
    product.reviews.reduce((acc, r) => acc + r.rating, 0) / product.reviews.length

  await product.save()
  res.status(201).json({ message: 'Review added successfully' })
})

/**
 * @desc    Get the top-rated products
 * @route   GET /api/products/top
 * @access  Public
 */
const getTopProducts = asyncHandler(async (req, res) => {
  const products = await Product.find({})
    .sort({ rating: -1 })
    .limit(TOP_PRODUCTS_LIMIT)
    .lean() // No need for Mongoose document methods here

  res.json(products)
})

// ─── Exports ──────────────────────────────────────────────────────────────────

export {
  getProducts,
  getProductById,
  deleteProduct,
  createProduct,
  updateProduct,
  createProductReview,
  getTopProducts,
}
