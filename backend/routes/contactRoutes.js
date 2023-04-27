import express from 'express';
const router = express.Router();
import { sendMail } from '../controllers/contactController.js';
// import { protect } from '../middleware/authMiddleware.js';

console.log("In contactRoutes")
router.route('/').post(sendMail);


export default router;
