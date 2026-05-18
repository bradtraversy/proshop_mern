import express from 'express'
import {
    getFeatureFlags,
    getFeatureFlagByName,
    updateFeatureFlag,
} from '../controllers/featureFlagController.js'
import { protect, admin } from '../middleware/authMiddleware.js'

const router = express.Router()

router.route('/').get(getFeatureFlags)
router.route('/:name').get(getFeatureFlagByName).put(protect, admin, updateFeatureFlag)

export default router
