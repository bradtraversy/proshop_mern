# Incident Response Runbook

**Purpose:** Define structured response to production incidents (P0/P1 severity).  
**Audience:** On-call engineers, incident commanders, DevOps, support teams.  
**Duration:** Varies (15 minutes to hours, depending on severity and root cause).  
**Goal:** Minimize user impact, prevent cascading failures, gather data for post-incident review.

## Severity Levels

| Level | Definition | Examples | Response Time |
|-------|-----------|----------|---|
| **P0 – Critical** | Complete service outage; users cannot access app or core features. | Database unreachable, app won't start, payment system down. | Immediate (< 5 min) |
| **P1 – Major** | Significant functionality degraded; affects >1% of users or revenue-critical paths. | Checkout broken for specific payment methods, 10sec+ latency spikes. | < 15 minutes |
| **P2 – Moderate** | Limited functionality affected; annoying but workaround exists. | Admin search slow, order history doesn't load (but orders still process). | < 1 hour |
| **P3 – Minor** | Cosmetic or very limited impact. | Typo in product description, icon misaligned. | No urgency |

## Incident Phases

```
Discovery (How did we find out?)
    ↓
Declaration (Officially call it an incident)
    ↓
Triage (Assess severity, gather team)
    ↓
Mitigation (Stop the bleeding, quick fix or rollback)
    ↓
Resolution (Root cause fix, if needed)
    ↓
Verification (Confirm stability)
    ↓
Communication (Notify users/stakeholders)
    ↓
Post-Incident (Postmortem, action items, documentation)
```

## Phase 1: Discovery & Declaration (0–5 Minutes)

### How Incidents Are Detected

- **Monitoring alerts:** Error rate spike, latency >2s, CPU >90%.
- **User reports:** Support email, Slack message, or social media complaint.
- **Manual discovery:** Engineer testing finds broken feature.

### Declare the Incident

When you suspect a critical issue:

1. **Confirm it's real:**
   ```bash
   # Is the app up?
   curl -i https://proshop-prod.herokuapp.com/health
   
   # Check logs for errors
   heroku logs --app proshop-prod --tail
   ```

2. **Assess severity:**
   - Can users access the homepage? → Not P0.
   - Is checkout broken? → P0 if revenue-critical.
   - Are all orders rejected? → P0.

3. **Declare in Slack/war room:**
   ```
   🚨 INCIDENT DECLARED - Severity: P1
   Summary: Checkout payment processing failing for PayPal users
   Status: Investigating
   Incident Commander: @engineer-name
   War Room: #incidents channel
   ```

### Escalate If Needed

```
P0 → Page on-call engineer immediately (phone call, SMS)
P1 → Notify on-call + team lead within 5 minutes
P2 → Notify team, no page required
```

## Phase 2: Triage (5–10 Minutes)

### Gather the Team

For P0/P1, assemble:
- **Incident Commander (IC):** Leads response, communicates status.
- **Lead Engineer:** Knows the code, can deploy fixes.
- **Database Admin:** If DB-related.
- **Support Lead:** Communicates with customers.

### Diagnose the Problem

Ask:

| Question | Why | How to Find |
|----------|-----|-----------|
| **When did it start?** | Narrow down scope. | Check logs timestamp, alert history. |
| **What changed recently?** | Likely cause. | `git log --oneline` last 24 hours. |
| **Who is affected?** | Scope impact. | Logs showing affected user IDs, regions. |
| **Is it complete outage or partial?** | Affects response strategy. | Test multiple API endpoints, regions. |
| **Is data being lost?** | Critical for orders. | Check order counts, recent orders in DB. |

### Quick Diagnostics

```bash
# Check app health
heroku logs --app proshop-prod --tail | head -50

# Check database connectivity
heroku run "mongosh MONGO_URI --eval 'db.adminCommand(\"ping\")'" --app proshop-prod

# Check CPU/memory
heroku dyno:type --app proshop-prod

# Check recent deployments
heroku releases --app proshop-prod | head -10

# Check error rate
heroku logs --app proshop-prod | grep -i error | wc -l
```

## Phase 3: Mitigation (10–20 Minutes)

Choose mitigation strategy based on root cause:

### Strategy A: Immediate Rollback (Fastest)

If incident started after a recent deploy:

```bash
# Check releases
heroku releases --app proshop-prod

# Rollback to previous stable version
heroku releases:rollback v20 --app proshop-prod
```

**Pros:** Instant. No debugging needed.  
**Cons:** Loses features from latest deploy. Might not fix root cause if issue is environmental.

**When to use:** After deployment, clear broken feature introduced.

### Strategy B: Feature Flag Kill Switch (1–2 Minutes)

If broken feature is behind a feature flag:

```javascript
// Update flag in MongoDB
db.featureflags.updateOne(
  { key: "new_checkout_flow" },
  { $set: { enabled: false, rolloutPercentage: 0 } }
)
```

All users revert to old code path. No redeploy needed.

**Pros:** Surgical, instant, no full rollback required.  
**Cons:** Only works if feature was flagged.

**When to use:** Specific feature is broken, rest of system is fine.

### Strategy C: Restart / Scaling (30 Seconds)

If issue is a one-time glitch (memory leak, race condition):

```bash
# Restart the app dyno
heroku dyno:restart web.1 --app proshop-prod

# Wait 30 seconds
sleep 30

# Verify recovery
curl https://proshop-prod.herokuapp.com/health
```

**Pros:** Often fixes transient issues.  
**Cons:** Doesn't fix root cause, issue may recur.

**When to use:** Sporadic errors or memory spikes.

### Strategy D: Database Failover (2–5 Minutes)

If MongoDB Atlas is having issues:

1. **In MongoDB Atlas dashboard:**
   - Navigate to your cluster.
   - Click "Failover" → "Initiate Failover" for replica set.
   - Wait 2–3 minutes for failover to complete.

2. **Verify connection:**
   ```bash
   heroku run "mongosh MONGO_URI --eval 'db.version()'" --app proshop-prod
   ```

**Pros:** Eliminates DB as single point of failure.  
**Cons:** Brief downtime during failover, data in flight may be lost (rare with modern DBs).

**When to use:** Database is unresponsive or showing replication lag.

## Phase 4: Resolution (20 Minutes – Hours)

Once user impact is mitigated (system back up), work on root cause:

### Example Root Cause Scenarios

**Scenario 1: Payment API credential expired**

```bash
# Check error logs for 401/403 from PayPal
heroku logs --app proshop-prod | grep -i paypal

# Fix:
heroku config:set PAYPAL_CLIENT_ID="<new-valid-id>" --app proshop-prod

# Redeploy or restart
heroku dyno:restart web.1 --app proshop-prod
```

**Scenario 2: Database connection timeout**

```bash
# Check if MongoDB Atlas cluster is overloaded
# In MongoDB Atlas dashboard → Metrics tab

# Add more connection pool
# or scale up the cluster (M5 → M10)

# Update MONGO_URI if needed
heroku config:set MONGO_URI="new_uri" --app proshop-prod

# Restart app
heroku dyno:restart web.1 --app proshop-prod
```

**Scenario 3: Code bug in recent deploy**

```bash
# 1. Fix code locally
# vim backend/controllers/orderController.js

# 2. Test fix locally
npm run dev
# Test checkout flow

# 3. Commit and push
git add .
git commit -m "Fix: order payment processing bug [INCIDENT-123]"
git push origin main

# 4. Deploy to production
git push heroku main

# 5. Verify
curl https://proshop-prod.herokuapp.com/health
```

## Phase 5: Verification (5–10 Minutes)

Confirm issue is fully resolved:

```bash
# 1. Check app logs (no errors last 5 minutes)
heroku logs --app proshop-prod --num 50 | grep -i error

# 2. Test core flows manually
curl https://proshop-prod.herokuapp.com/api/products | jq '.[0].name'
curl -X POST https://proshop-prod.herokuapp.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"123456"}'

# 3. Check metrics (latency, error rate back to baseline)
heroku logs --app proshop-prod --tail | grep response_time | tail -20

# 4. Monitor for 10 minutes (no regression)
watch -n 30 'heroku logs --app proshop-prod --num 5'
```

## Phase 6: Communication

### Timeline

| Time | Who | Message | Channel |
|------|-----|---------|---------|
| T+0 | IC | "Incident declared. Investigating." | Slack #incidents |
| T+5 | IC | "Issue: Payment processing failing for 5% of users. Rollback in progress." | Slack + Email |
| T+10 | IC | "Rollback complete. System recovering. Analyzing root cause." | Slack + Email |
| T+30 | IC | "System stable. All users can checkout. Root cause identified: expired PayPal creds. Fix deployed." | Slack + Email |
| T+60 | IC | "All-clear. No further action needed. Postmortem scheduled for tomorrow." | Slack + Email |

### Customer Communication (If >5 min downtime)

Email template:

```
Subject: Incident Update: proshop Service

Dear Customers,

We experienced a brief service interruption from 14:22 UTC to 14:32 UTC 
on April 15, affecting checkout functionality for approximately 30 minutes.

Root cause: Payment processor credentials expired.
Resolution: Credentials renewed and system verified.

Impact: ~500 orders delayed, zero data loss.

Compensation: We're issuing $5 store credits to affected accounts.

We apologize for the inconvenience and are implementing additional monitoring 
to prevent recurrence.

Best regards,
The ProShop Team
```

## Phase 7: Post-Incident

### Postmortem (Schedule within 24 hours)

**Postmortem template:**

```markdown
## Incident Postmortem: PayPal Payment Processor Outage

**Date:** 2024-04-15  
**Duration:** 10 minutes (14:22–14:32 UTC)  
**Severity:** P1  
**Incident ID:** INC-2024-042  

### Timeline

| Time | Event |
|------|-------|
| 14:20 | Monitoring alert: Payment API returns 401 Unauthorized |
| 14:22 | Customer reports: "Can't checkout" |
| 14:24 | IC declared incident, notified team |
| 14:26 | Root cause identified: PayPal credentials expired April 15 |
| 14:28 | Credentials renewed, redeployed |
| 14:32 | Payment flow verified working; all-clear |

### Root Cause

PayPal API credentials have 1-year expiration (set to April 15, 2024). 
No calendar reminder was set. Credentials expired at midnight UTC.

### Impact

- **User-facing:** 10 minutes of checkout failures.
- **Business:** ~150 orders delayed (no revenue loss, orders retried after fix).
- **Reputational:** 5 social media complaints.

### Remediation (Action Items)

| Item | Owner | Due Date | Status |
|------|-------|----------|--------|
| Set calendar reminder for credential renewal 30 days before expiry | DevOps | 2024-04-16 | 🔄 |
| Add automated credential expiry monitoring | Backend Lead | 2024-04-25 | 🔄 |
| Document all 3rd-party API credential dates in CREDENTIALS.md | Security | 2024-04-16 | 🔄 |
| Review similar credentials (Stripe, AWS keys) for expiry | DevOps | 2024-04-16 | 🔄 |

### Prevention

✅ Add Datadog/Sentry alert for payment API 401 errors (early warning).  
✅ Implement credential rotation checklist (quarterly).  
✅ Add lifecycle email from PayPal to security@company.com (90-day warning).

### What Went Well

- Team responded quickly (2-minute diagnosis).
- Clear communication to customers.
- Fix deployed in <8 minutes.

### What Could Be Better

- No automated alert for approaching credential expiry.
- Postmortem not scheduled immediately (should be <24 hours).
- No runbook for this specific failure scenario.
```

### Action Items (Follow-Up)

Create a Jira/GitHub issue for each action item. Review in weekly standup until resolved.

### Knowledge Sharing

Document the incident and lessons learned:
- Add this scenario to the runbook (this document).
- Share postmortem in team Slack/wiki.
- Update monitoring to catch similar issues early.

## Incident Command Responsibilities

### Incident Commander (IC)

- Declares incident and sets severity.
- Owns timeline and communications.
- Makes go/no-go decisions (rollback, escalate, etc.).
- Facilitates postmortem.

**Example IC decision tree:**

```
Is the system completely down (P0)?
  ├─ YES → Immediate rollback + notify exec team
  └─ NO → Is checkout broken (P1)?
            ├─ YES → Kill switch or quick fix + 15-min update
            └─ NO → Diagnose, plan fix, standard cadence
```

### Engineer Lead

- Provides technical diagnosis.
- Codes/deploys fixes.
- Reports status to IC every 5 minutes (for P0/P1).

### Support Lead

- Monitors inbound tickets/social media.
- Prepares customer communication drafts.
- Tracks customer impact (# of affected orders, complaints, etc.).

## Escalation Contacts

```
On-call Engineer: [phone number]
Team Lead: [email/phone]
VP Engineering: [emergency contact]
CEO: [for P0 + media attention]
```

## Reference Commands

| Command | Purpose |
|---------|---------|
| `heroku logs --tail` | Live logs |
| `heroku releases:rollback v<N>` | Rollback to release N |
| `heroku dyno:restart` | Restart app |
| `heroku config` | View env vars |
| `git log --oneline` | Recent commits |
| `curl https://proshop-prod.herokuapp.com/health` | Health check |

---

**Last updated:** M3 curriculum.  
**Reminder:** Blameless culture. Postmortems are learning opportunities, not witch hunts.
