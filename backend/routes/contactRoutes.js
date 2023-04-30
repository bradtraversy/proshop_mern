import express from 'express';
const router = express.Router();
import { sendMail } from '../controllers/contactController.js';

// Add a route for the new endpoint using the Express router.
router.route('/').post(sendMail);

export default router;
