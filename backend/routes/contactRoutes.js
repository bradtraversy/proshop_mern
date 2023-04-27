import express from 'express';
const router = express.Router();
import { sendMail } from '../controllers/contactController.js';
// import { protect } from '../middleware/authMiddleware.js';

router.route('/send-email').post(sendMail);

export default router;
