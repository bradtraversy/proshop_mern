import express from 'express'
const router = express.Router()
import { sendMail } from '../controllers/contactController.js'
import { protect } from '../middleware/authMiddleware.js'

router.route('/api/send-email').post(protect, sendMail)

export default router
