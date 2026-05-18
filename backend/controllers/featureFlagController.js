import { readFileSync, writeFileSync } from 'fs'
import path from 'path'
import asyncHandler from 'express-async-handler'

const __dirname = path.resolve()
const FEATURES_PATH = path.join(__dirname, 'backend', 'features.json')

function loadFeatures() {
    const raw = readFileSync(FEATURES_PATH, 'utf-8')
    return JSON.parse(raw)
}

// @desc    Get all feature flags
// @route   GET /api/feature-flags
// @access  Public
const getFeatureFlags = asyncHandler(async (req, res) => {
    const features = loadFeatures()
    res.json(features)
})

// @desc    Get a single feature flag by key
// @route   GET /api/feature-flags/:name
// @access  Public
const getFeatureFlagByName = asyncHandler(async (req, res) => {
    const features = loadFeatures()
    const feature = features[req.params.name]

    if (!feature) {
        res.status(404)
        throw new Error(`Feature '${req.params.name}' not found`)
    }

    res.json({ key: req.params.name, ...feature })
})

// @desc    Update a feature flag
// @route   PUT /api/feature-flags/:name
// @access  Private/Admin
const updateFeatureFlag = asyncHandler(async (req, res) => {
    const features = loadFeatures()
    const feature = features[req.params.name]

    if (!feature) {
        res.status(404)
        throw new Error(`Feature '${req.params.name}' not found`)
    }

    const { status, traffic_percentage } = req.body

    if (status !== undefined) {
        if (!['Enabled', 'Testing', 'Disabled'].includes(status)) {
            res.status(400)
            throw new Error('Status must be Enabled, Testing, or Disabled')
        }
        feature.status = status
    }

    if (traffic_percentage !== undefined) {
        const pct = Number(traffic_percentage)
        if (isNaN(pct) || pct < 0 || pct > 100) {
            res.status(400)
            throw new Error('Traffic percentage must be between 0 and 100')
        }
        feature.traffic_percentage = pct
    }

    feature.last_modified = new Date().toISOString().split('T')[0]
    features[req.params.name] = feature

    writeFileSync(FEATURES_PATH, JSON.stringify(features, null, 2), 'utf-8')

    res.json({ key: req.params.name, ...feature })
})

export { getFeatureFlags, getFeatureFlagByName, updateFeatureFlag }
