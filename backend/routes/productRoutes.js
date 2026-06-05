import express from 'express'
const router = express.Router()
import {
  getProducts,
  getProductById,
  deleteProduct,
  createProduct,
  updateProduct,
  createProductReview,
  getTopProducts,
  suggestProducts,
  getProductRecommendations,
  getPendingReviews,
  moderateReview,
} from '../controllers/productController.js'
import { protect, admin, optionalProtect } from '../middleware/authMiddleware.js'
import multer from 'multer'
import crypto from 'crypto'

const MIME_EXT = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, 'uploads/')
  },
  filename(req, file, cb) {
    const ext = MIME_EXT[file.mimetype]
    cb(null, `review-${crypto.randomUUID()}.${ext}`)
  },
})

const fileFilter = (req, file, cb) => {
  if (MIME_EXT[file.mimetype]) {
    cb(null, true)
  } else {
    cb(new Error('Images only'))
  }
}

const uploadReviewImages = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024, files: 3 },
}).array('images', 3)

router.route('/').get(getProducts).post(protect, admin, createProduct)
router.get('/reviews', protect, admin, getPendingReviews)
router.get('/top', getTopProducts)
router.get('/suggest', optionalProtect, suggestProducts)
router.get('/recommend/:id', optionalProtect, getProductRecommendations)
router
  .route('/:id/reviews')
  .post(protect, uploadReviewImages, createProductReview)
router.route('/:id/reviews/:reviewId').put(protect, admin, moderateReview)
router
  .route('/:id')
  .get(getProductById)
  .delete(protect, admin, deleteProduct)
  .put(protect, admin, updateProduct)

export default router
