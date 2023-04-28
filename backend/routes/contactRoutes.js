import express from 'express';
const router = express.Router();
import { sendMail } from '../controllers/contactController.js';

router.route('/').post(sendMail);

export default router;
