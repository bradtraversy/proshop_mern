# Feature Flag Toggle Runbook

**Purpose:** Safely roll out new features to production via feature flags with zero-downtime, progressive canary deployment, and instant kill switch.  
**Audience:** Product managers, backend engineers, release managers.  
**Duration:** Varies by rollout strategy (5 min to 2 hours for full rollout).  
**Scope:** Feature flags are conditionals in code that enable/disable code paths without redeployment.

## Architecture Overview

Feature flags are stored in MongoDB and checked at runtime. Example:

```javascript
// backend/controllers/productController.js
const featureFlags = await FeatureFlag.findOne({ key: 'new-search-filter' })

if (featureFlags?.enabled) {
  // New filtered search logic
  products = await Product.find(filterQuery).populate('reviews')
} else {
  // Old search logic
  products = await Product.find(filterQuery)
}
```

### Feature Flag Schema (MongoDB)

```javascript
{
  key: "new-search-filter",           // Unique identifier
  enabled: false,                     // Global on/off
  rolloutPercentage: 0,               // 0-100%, overrides enabled if set
  targetUserIds: [],                  // Whitelist specific users
  excludeUserIds: [],                 // Blacklist specific users
  startDate: ISODate("2024-04-15"),   // When to enable
  endDate: ISODate("2024-05-15"),     // When to auto-disable
  metadata: {
    description: "New product search with advanced filtering",
    owner: "product-team",
    metrics: { exposure: 5000, conversions: 150 }
  }
}
```

## Pre-Rollout Preparation

### 1. Code Implementation

Ensure code has both old and new paths protected by the flag:

```javascript
export async function getProducts(req, res) {
  try {
    const flag = await FeatureFlag.findOne({ key: 'new-search-filter' })
    const shouldEnableNewSearch = evaluateFlag(flag, req.user._id)

    if (shouldEnableNewSearch) {
      // New implementation
      const results = await searchNewAlgorithm(req.query)
      res.json(results)
    } else {
      // Old implementation (stable fallback)
      const results = await searchOldAlgorithm(req.query)
      res.json(results)
    }
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

function evaluateFlag(flag, userId) {
  if (!flag) return false
  if (flag.excludeUserIds.includes(userId)) return false
  if (flag.targetUserIds.length > 0) return flag.targetUserIds.includes(userId)
  if (flag.rolloutPercentage > 0) {
    const hash = hashFunction(userId) % 100
    return hash < flag.rolloutPercentage
  }
  return flag.enabled
}
```

### 2. Local Testing

Test both code paths locally before deploying:

```bash
# Terminal 1: Start app with flag disabled
NODE_ENV=development npm run dev

# Terminal 2: Test old path
curl "http://localhost:5001/api/products?sort=price" | jq .

# Terminal 3: Manually enable flag in MongoDB (local)
# Use MongoDB compass or CLI:
# db.featureflags.updateOne(
#   { key: 'new-search-filter' },
#   { $set: { enabled: true } }
# )

# Test new path (should see different results)
curl "http://localhost:5001/api/products?sort=price" | jq .
```

### 3. Staging Verification

Deploy code to staging first (if you have a staging environment):

```bash
git push staging main
# Test on staging: https://proshop-staging.herokuapp.com
```

Verify:
- New code path works without errors.
- Old code path (with flag disabled) still works.
- No performance degradation (latency, CPU, memory).

### 4. Create Feature Flag Document in Production MongoDB

```javascript
// Connect to production MongoDB Atlas
// Use MongoDB Compass or mongo shell

db.featureflags.insertOne({
  key: "new-search-filter",
  enabled: false,
  rolloutPercentage: 0,
  targetUserIds: [],
  excludeUserIds: [],
  startDate: null,
  endDate: null,
  metadata: {
    description: "New product search with advanced filtering",
    owner: "product-team",
    createdAt: new Date(),
    metrics: { exposure: 0, conversions: 0 }
  }
})
```

## Rollout Phases

### Phase 1: Internal Testing (0% → 5%)

Enable flag for your team and key stakeholders only:

```javascript
db.featureflags.updateOne(
  { key: "new-search-filter" },
  {
    $set: {
      rolloutPercentage: 5,
      targetUserIds: ["user123", "user456"],  // Your test accounts
      excludeUserIds: []
    }
  }
)
```

**Duration:** 1–2 hours.  
**Monitoring:** Watch error logs, response times, and user behavior in analytics.

```bash
# Check logs
heroku logs --app proshop-prod --tail | grep "new-search-filter"

# Example: Look for errors
heroku logs --app proshop-prod --grep "Error"
```

**Success criteria:**
- Zero errors in logs.
- P95 latency unchanged.
- Test users report expected behavior.

### Phase 2: Canary – Beta Users (5% → 25%)

Gradually expose to a wider audience:

```javascript
db.featureflags.updateOne(
  { key: "new-search-filter" },
  { $set: { rolloutPercentage: 25 } }
)
```

**Duration:** 2–4 hours.  
**Metrics to track:**
- Error rate (aim for 0%).
- Average response time (should not increase >10%).
- Conversion rate (aim for no decrease).
- User complaints in support channels.

**Query conversion rate (example):**

```javascript
// Pseudo-query: count orders created after rollout
db.orders.aggregate([
  {
    $match: {
      createdAt: { $gte: ISODate("2024-04-15T10:00:00Z") }
    }
  },
  {
    $group: {
      _id: null,
      totalOrders: { $sum: 1 },
      totalRevenue: { $sum: "$totalPrice" }
    }
  }
])
```

### Phase 3: Production – Half Users (25% → 50%)

Roll out to 50% of user base:

```javascript
db.featureflags.updateOne(
  { key: "new-search-filter" },
  { $set: { rolloutPercentage: 50 } }
)
```

**Duration:** 4–8 hours.  
**Action:** If any critical issues arise, proceed to kill switch (see below).

### Phase 4: Full Rollout (50% → 100%)

Release to all users:

```javascript
db.featureflags.updateOne(
  { key: "new-search-filter" },
  {
    $set: {
      enabled: true,
      rolloutPercentage: 0  // Reset percentage, use enabled flag instead
    }
  }
)
```

**Duration:** 1 hour.  
**Post-rollout:** Monitor logs for 24 hours. If stable, you can remove the feature flag from code (clean-up tech debt).

## Kill Switch – Emergency Disable

If users report issues during any phase:

### Immediate Action (< 1 minute)

```javascript
db.featureflags.updateOne(
  { key: "new-search-filter" },
  { $set: { enabled: false, rolloutPercentage: 0 } }
)
```

All users immediately revert to old code path. **No redeployment required.**

### Verify Kill Switch Worked

```bash
# Wait 30 seconds for cache invalidation
sleep 30

# Test with curl
curl "http://localhost:5001/api/products" -H "X-Debug: new-search-filter"

# Logs should show: "Feature disabled, using fallback search"
heroku logs --app proshop-prod --tail
```

### Investigation & Root Cause Analysis

Post-incident (do not delay fix):

1. **Identify what broke:** Check logs, user reports, performance metrics.
2. **Root cause:** Was it the new search algorithm, database query, or edge case in old code?
3. **Fix:** Patch the code, re-test locally, stage it.
4. **Re-enable:** Restart rollout from Phase 1.

**Example incident log template:**

```markdown
## Incident: new-search-filter rollout

**Time:** 2024-04-15 11:30 UTC  
**Severity:** P1 (affecting 25% of users)  
**Kill switch:** Triggered at 11:35 UTC  
**Recovery time:** 5 minutes  

**Root cause:** New search algorithm had O(n²) complexity; timeout on large product catalogs.  
**Fix:** Optimized with database indexing + limit query results to 1000.  
**Status:** Resolved and re-tested in staging. Re-rolling out 2024-04-16 15:00 UTC.
```

## Monitoring Checklist

During all rollout phases, monitor these KPIs every 30 minutes:

| KPI | Healthy | Alert Threshold |
|-----|---------|-----------------|
| Error rate | 0% | > 1% |
| P95 latency | Baseline | +50ms |
| CPU usage | < 60% | > 80% |
| Memory usage | < 512MB | > 700MB |
| Order conversion rate | Baseline | -5% or more |
| Cart abandonment rate | Baseline | +10% or more |

**Command to extract latency metrics** (if instrumented):

```bash
heroku logs --app proshop-prod | grep "response_time" | tail -20
```

## Cleanup & Post-Rollout

Once fully rolled out and stable (24+ hours):

### Option 1: Keep Flag for Easy Rollback

Leave flag in database as a permanent emergency kill switch:

```javascript
db.featureflags.updateOne(
  { key: "new-search-filter" },
  { $set: { enabled: true } }
)
```

Update code to remove the conditional (feature is now default):

```javascript
// Remove conditional, always use new implementation
const results = await searchNewAlgorithm(req.query)
res.json(results)
```

Keep flag document for historical reference / future rollback if needed.

### Option 2: Remove Flag Entirely (Hard Delete)

Delete the flag and remove code conditional:

```javascript
db.featureflags.deleteOne({ key: "new-search-filter" })
```

This is cleaner but removes rollback option. Only do this after 1+ week of stable production.

### Update Metrics

```javascript
db.featureflags.updateOne(
  { key: "new-search-filter" },
  {
    $set: {
      "metadata.rolloutCompletedAt": new Date(),
      "metadata.totalExposure": 45000,  // Users who saw feature
      "metadata.totalConversions": 2100,
      "metadata.conversionLift": 0.087  // 8.7% improvement
    }
  }
)
```

Document results in a postmortem or wiki page for future reference.

## Reference Commands

| Command | Purpose |
|---------|---------|
| `db.featureflags.find()` | List all flags |
| `db.featureflags.updateOne({ key: "..." }, { $set: { ... } })` | Update flag (enable, adjust rollout %) |
| `db.featureflags.deleteOne({ key: "..." })` | Delete flag |
| `heroku logs --tail` | Live logs (watch for errors) |
| `curl -H "X-User-ID: user123" http://localhost/api/products` | Test specific user flag evaluation |

---

**Last updated:** M3 curriculum.  
**Questions?** Contact your DevOps or product team for flag management permissions.
