# A/B Testing Setup Runbook

**Purpose:** Design and execute A/B tests for product features in proshop-mern with statistical rigor.  
**Audience:** Product managers, data analysts, engineers.  
**Duration:** 1–2 weeks per test (setup + execution + analysis).  
**Goal:** Measure feature impact using valid statistics, not gut feel.

## A/B Testing Fundamentals

An A/B test compares two versions of a feature:
- **Control (A):** Current implementation (e.g., old checkout flow).
- **Variant (B):** New implementation (e.g., new checkout flow with 2 steps instead of 3).

Users are randomly split (typically 50/50), and you measure which converts better.

**Key metrics:**
- **Conversion rate:** Orders placed / users exposed.
- **Average order value (AOV):** Total revenue / orders.
- **Cart abandonment rate:** Carts created / abandoned.

## Pre-Test Checklist

Before launching a test:

- [ ] **Clear hypothesis:** "We believe reducing checkout steps from 3 to 2 will increase conversion rate by 5%."
- [ ] **Metrics defined:** Primary (conversion) + secondary (AOV, abandonment).
- [ ] **Sample size calculated:** See calculator below.
- [ ] **Test duration decided:** e.g., 7 days minimum.
- [ ] **Success criteria set:** e.g., "Variant wins if p-value < 0.05 and lift > 3%."
- [ ] **Tracking instrumented:** Analytics events logged for both A and B.
- [ ] **Rollout strategy:** What happens if B wins? How fast do we roll out?

## Sample Size Calculator

To detect a 5% lift in conversion rate with 95% confidence:

**Formula:**

```
n = 2 * (Z_α/2 + Z_β)² * p(1-p) / d²

where:
  Z_α/2 = 1.96 (95% confidence)
  Z_β = 0.84 (80% statistical power)
  p = baseline conversion rate (e.g., 0.03 = 3%)
  d = minimum detectable effect (e.g., 0.05 = 5% relative lift)
```

**Example calculation:**

```
Baseline conversion rate: 3%
Minimum detectable lift: 5% (so 3% * 1.05 = 3.15%)
Confidence: 95%
Power: 80%

n = 2 * (1.96 + 0.84)² * 0.03(0.97) / (0.0015)²
  = 2 * 7.84 * 0.0291 / 0.00000225
  ≈ 20,000 users per variant
  = 40,000 total users needed
```

**At 5,000 daily active users:** Test duration = 40,000 / 5,000 = 8 days.

## Test Setup in Code

### 1. Create A/B Test Document in MongoDB

```javascript
db.abtests.insertOne({
  testId: "checkout-v2-2024-04",      // Unique test identifier
  name: "Simplified Checkout Flow",
  hypothesis: "Reducing from 3 steps to 2 will increase conversion rate by 5%",
  variants: {
    control: {
      name: "Old checkout (3 steps)",
      rolloutPercentage: 50,
      description: "Shipping → Payment → Review → Confirm"
    },
    variant: {
      name: "New checkout (2 steps)",
      rolloutPercentage: 50,
      description: "Shipping+Payment → Review+Confirm"
    }
  },
  primaryMetric: "conversionRate",
  secondaryMetrics: ["aov", "cartAbandonmentRate"],
  startDate: ISODate("2024-04-15T00:00:00Z"),
  endDate: ISODate("2024-04-22T00:00:00Z"),
  successCriteria: {
    confidenceLevel: 0.95,           // 95% confidence
    minimalDetectableEffect: 0.05,  // 5% relative lift
    statisticalPower: 0.80           // 80% power
  },
  status: "running",
  results: null  // Populated after test ends
})
```

### 2. Assign Users to Variants

Implement deterministic assignment using user ID hash:

```javascript
// backend/controllers/checkoutController.js
import crypto from 'crypto'

export async function getCheckoutVariant(req, res) {
  try {
    const userId = req.user._id.toString()
    const testId = "checkout-v2-2024-04"
    
    // Get test config
    const test = await ABTest.findOne({ testId })
    if (!test || test.status !== 'running') {
      return res.json({ variant: 'control' })  // Default to control if test not active
    }

    // Deterministic assignment using hash (same user always gets same variant)
    const hash = crypto.createHash('md5')
      .update(`${testId}${userId}`)
      .digest('hex')
    const hashValue = parseInt(hash.substring(0, 8), 16) % 100

    let assignedVariant = 'control'
    if (hashValue < 50) {
      assignedVariant = 'control'
    } else {
      assignedVariant = 'variant'
    }

    // Log exposure event for analytics
    await logAnalyticsEvent({
      userId,
      testId,
      variant: assignedVariant,
      eventType: 'exposed',
      timestamp: new Date()
    })

    res.json({ variant: assignedVariant })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}
```

### 3. Render Different UI Based on Variant

In frontend component:

```javascript
// frontend/src/screens/CheckoutScreen.jsx
import { useEffect, useState } from 'react'

export default function CheckoutScreen() {
  const [variant, setVariant] = useState('control')

  useEffect(() => {
    // Fetch assigned variant from backend
    fetch('/api/tests/checkout-variant')
      .then(res => res.json())
      .then(data => setVariant(data.variant))
  }, [])

  if (variant === 'control') {
    return (
      <div className="checkout-control">
        <h2>Shipping Address</h2>
        {/* Old 3-step flow */}
      </div>
    )
  } else {
    return (
      <div className="checkout-variant">
        <h2>Shipping & Payment</h2>
        {/* New 2-step flow */}
      </div>
    )
  }
}
```

## Tracking Analytics Events

Log key events for both control and variant users:

```javascript
// backend/utils/analytics.js
export async function logAnalyticsEvent(event) {
  const { userId, testId, variant, eventType, metadata } = event

  await AnalyticsEvent.insertOne({
    userId,
    testId,
    variant,
    eventType,        // 'exposed', 'checkout_started', 'checkout_completed', 'order_placed'
    metadata: {
      orderValue: metadata?.orderValue || null,
      cartItemCount: metadata?.cartItemCount || null,
      timestamp: metadata?.timestamp || new Date()
    }
  })
}

// Usage in order controller
export async function createOrder(req, res) {
  try {
    const testId = "checkout-v2-2024-04"
    const test = await ABTest.findOne({ testId, status: 'running' })
    
    if (test) {
      const variant = await assignVariant(req.user._id, testId)
      
      // Log conversion event
      await logAnalyticsEvent({
        userId: req.user._id,
        testId,
        variant,
        eventType: 'order_placed',
        metadata: {
          orderValue: req.body.totalPrice,
          cartItemCount: req.body.orderItems.length,
          timestamp: new Date()
        }
      })
    }

    // ... rest of order creation logic
    res.status(201).json(order)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}
```

## Running the Test

### Phase 1: Validation (Days 1–2)

Check that:
- Users are split 50/50 between variants.
- Variant B renders correctly.
- No errors in logs.

**Query to verify split:**

```javascript
db.analyticsEvents.aggregate([
  {
    $match: {
      testId: "checkout-v2-2024-04",
      eventType: "exposed"
    }
  },
  {
    $group: {
      _id: "$variant",
      count: { $sum: 1 }
    }
  }
])

// Expected output:
// { _id: "control", count: 2500 }
// { _id: "variant", count: 2487 }
```

### Phase 2: Data Collection (Days 3–7)

Let test run to collect sufficient data. Aim for >20,000 users per variant.

Monitor daily:

```javascript
// Daily conversion rate query
db.analyticsEvents.aggregate([
  {
    $match: {
      testId: "checkout-v2-2024-04",
      eventType: "order_placed",
      "metadata.timestamp": {
        $gte: ISODate("2024-04-15T00:00:00Z"),
        $lt: ISODate("2024-04-16T00:00:00Z")
      }
    }
  },
  {
    $group: {
      _id: "$variant",
      conversions: { $sum: 1 }
    }
  }
])

// Add exposures for conversion rate = conversions / exposures
```

### Phase 3: Statistical Analysis (After test ends)

Calculate results using a statistical test (chi-squared or t-test).

**Manual calculation** (for 2 proportions):

```
Control: 1,200 conversions / 40,000 exposures = 3.0%
Variant: 1,320 conversions / 40,000 exposures = 3.3%
Relative lift: (3.3% - 3.0%) / 3.0% = 10%

Chi-squared test:
χ² = ((1200 - 1260)² / 1260) + ((1320 - 1260)² / 1260)
   + ((38800 - 38740)² / 38740) + ((38680 - 38740)² / 38740)
   ≈ 3.81

p-value ≈ 0.05 (borderline significant at 95% confidence)
```

**Interpretation:**
- **p-value < 0.05:** Reject null hypothesis. Variant B is statistically significantly better.
- **p-value ≥ 0.05:** Fail to reject null hypothesis. No significant difference detected.

## Decision Framework

After analysis:

| Result | Decision | Action |
|--------|----------|--------|
| **Win (p < 0.05, lift > 3%)** | Variant B is better | Roll out to 100% (see deploy.md) |
| **Inconclusive (p ≥ 0.05)** | Not enough evidence | Extend test 1 more week OR declare draw |
| **Lose (p < 0.05, lift < -3%)** | Variant B is worse | Discard variant, keep control |
| **Draw (p < 0.05, lift 0% to 3%)** | Variant B is equal | Keep control OR roll out B if other benefits (cost, UX) |

## Example: Test Results Summary

```markdown
## A/B Test Results: Simplified Checkout Flow

**Test ID:** checkout-v2-2024-04  
**Duration:** 2024-04-15 to 2024-04-22 (7 days)  
**Sample size:** 80,420 total users (40,210 per variant)

### Primary Metric: Conversion Rate
| Variant | Conversions | Exposures | Conv. Rate | Lift |
|---------|-------------|-----------|-----------|------|
| Control | 1,206 | 40,210 | 3.00% | — |
| Variant | 1,318 | 40,210 | 3.28% | +9.3% |

**Statistical test:** Chi-squared = 4.12, p-value = 0.042 (significant at 95%)

### Secondary Metrics
- **Average Order Value:** Control $87.50 vs Variant $88.20 (+0.8%, not significant)
- **Cart Abandonment:** Control 42.5% vs Variant 40.1% (-3.8%, significant)

### Recommendation
**✅ LAUNCH VARIANT B**

The new 2-step checkout increases conversion rate by 9.3% with statistical significance (p=0.042). Combined with a 3.8% reduction in cart abandonment, this is a clear win. Recommend rolling out to 100% of users immediately and documenting savings: ~7.5K additional orders/month at $87.50 AOV = $656K annual incremental revenue.

### Post-Launch
Monitor conversion rate weekly for 4 weeks to ensure gains persist and no long-term negative effects emerge.
```

## Reference

- **Chi-squared calculator:** https://www.socscistatistics.com/tests/chisquare2/default2.aspx
- **Sample size calculator:** https://www.evanmiller.org/ab-testing/sample-size.html
- **Statistical power explained:** https://www.optimizely.com/sample-size-calculator/

---

**Last updated:** M3 curriculum.  
**Questions?** Contact your data analyst or stats expert for p-value interpretation.
