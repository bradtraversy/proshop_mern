# Incident i-002: MongoDB Connection Pool Exhaustion — Black Friday 2023

**Severity:** P0 (full service outage)
**Status:** Resolved
**Date detected:** 2023-11-24 08:47 UTC
**Date resolved:** 2023-11-24 11:30 UTC
**Duration:** 2 hours 43 minutes
**Author:** On-call Engineer
**Reviewed by:** Full engineering team — postmortem 2023-11-27

---

## Summary

On Black Friday 2023, the ProShop service experienced a complete outage lasting 2 hours and 43 minutes. The root cause was MongoDB connection pool exhaustion: Mongoose's default `maxPoolSize` of 5 connections was insufficient for the concurrent request volume, causing new requests to queue indefinitely until they timed out with a `MongoTimeoutError`. The application returned 500 errors to all users. The upstream load balancer (Render's routing layer) continued forwarding traffic, amplifying the connection request queue.

---

## Timeline

All times UTC.

| Time | Event |
|------|-------|
| 2023-11-24 08:00 | Black Friday sale begins; marketing email sent to ~1,200 subscribers |
| 2023-11-24 08:20 | Request rate rises from baseline 8 req/min to ~180 req/min |
| 2023-11-24 08:41 | MongoDB Atlas connection count reaches 5 (pool ceiling) |
| 2023-11-24 08:43 | First `MongoTimeoutError: connection timed out` appears in application logs |
| 2023-11-24 08:47 | Error rate crosses 50%; on-call pager alert fires (custom Render log alert) |
| 2023-11-24 08:52 | On-call Engineer acknowledges alert, begins investigation |
| 2023-11-24 09:00 | Initial hypothesis: Atlas cluster overloaded. Team logs into Atlas console. |
| 2023-11-24 09:08 | Atlas metrics show: CPU 12%, RAM 18%, **active connections: 5 of 5 (100%)** |
| 2023-11-24 09:12 | Root cause identified: pool size ceiling at 5 (Mongoose default) |
| 2023-11-24 09:15 | `MONGO_POOL_SIZE=25` env var added to Render dashboard; service restart initiated |
| 2023-11-24 09:22 | Service restarting (Render cold start: ~90 seconds) |
| 2023-11-24 09:24 | Service up; error rate drops to 0% |
| 2023-11-24 09:30 | Monitoring confirms stability; on-call engineer begins data collection |
| 2023-11-24 11:30 | Incident declared resolved after 2-hour observation window |
| 2023-11-27 14:00 | Postmortem meeting |

---

## Impact

- **Downtime:** 2 hours 43 minutes (08:47–11:30 UTC), full 500 response on all routes
- **Affected users:** All users accessing the service during the window; estimated 340 unique sessions based on Render log counts
- **Orders lost:** Unable to determine precisely; approximately 12–18 orders-in-progress abandoned based on cart session analysis
- **Revenue impact:** Estimated $600–900 in abandoned orders (back-of-envelope based on average order value)
- **SLA breach:** No formal SLA existed at the time

---

## Technical Deep Dive

### Mongoose connection pool behavior

Mongoose creates a connection pool to MongoDB on startup. By default, `maxPoolSize` is 5. This means a maximum of 5 simultaneous in-flight database operations. Any request requiring a DB operation when all 5 connections are occupied enters a wait queue.

The wait queue is bounded by `waitQueueTimeoutMS` (default: 0, meaning indefinite). In practice, Express's socket timeout (default: 5 seconds via Node.js) killed connections before Mongoose's internal timeout fired, resulting in the client receiving a socket hang rather than a meaningful error.

### Why the default was never changed

The Mongoose default of 5 was inherited from the initial project setup. The `mongoose.connect()` call in `backend/config/db.js` at the time of the incident was:

```javascript
const connectDB = async () => {
  const conn = await mongoose.connect(process.env.MONGO_URI);
  console.log(`MongoDB Connected: ${conn.connection.host}`);
};
```

No pool size was specified. During development and staging (single developer, low concurrency), 5 connections was never a constraint — the queue depth never exceeded 1. There were no load tests that would have surfaced this.

### Request anatomy that saturated the pool

Each product page load in this application issues 3 sequential DB queries:
1. `Product.findById()` — product detail
2. `Product.find({ category })` — related products sidebar
3. Implicit session validation (`User.findById()` from `protect` middleware if logged in)

At 180 req/min (3 req/sec) with average DB query time of 40ms, the expected concurrency was 3 × 0.04 = 0.12 concurrent connections — well under the ceiling. However, at Black Friday peak the actual observed pattern was:
- Concurrent logged-in users: ~85 simultaneous (Render log analysis)
- Average requests per active session: 4.2 req/min (browsing behavior)
- Effective concurrent DB operations: 85 × 4.2/60 × 3 = ~17.8 connections needed

The 5-connection pool could not sustain this. The queue grew faster than it was drained, and latency compounded until requests began timing out.

### Atlas cluster utilization

Contrary to the initial hypothesis (cluster overload), the Atlas M2 cluster was barely stressed:
- CPU: 12% peak
- RAM: 18% peak
- Active connections to Atlas: 5 (the application pool ceiling — not Atlas's ceiling)
- Atlas M2 allows up to 500 connections

The bottleneck was entirely on the application side. The cluster had substantial headroom.

---

## Resolution

**Immediate (during incident):**
- Mongoose `maxPoolSize` set to 25 via environment variable.

**Short-term (within one week):**
- Atlas cluster upgraded from M2 (shared) to M10 (dedicated, 1,500 connection limit).
- `waitQueueTimeoutMS: 5000` added so queued requests fail fast and return a 503 rather than hanging.
- `/api/health` endpoint added with DB ping to enable external uptime monitoring.

**Medium-term (within 30 days):**
- `k6` load test added to CI: 50 virtual users, 5-minute ramp, asserting p95 < 500ms and error rate < 1%.
- MongoDB Atlas alerts configured: active connections > 80% of pool, replication lag > 10s, CPU > 70%.
- Render autoscale evaluated (single instance → 2 instances with sticky sessions for file uploads).

---

## Postmortem — Action Items

| Action | Owner | Priority | Status | Completed |
|--------|-------|----------|--------|-----------|
| Set `maxPoolSize: 50` in `connectDB()` | Engineer A | P0 | Done | 2023-11-24 |
| Add `waitQueueTimeoutMS: 5000` | Engineer A | P0 | Done | 2023-11-24 |
| Upgrade Atlas M2 → M10 | Tech Lead | P1 | Done | 2023-12-01 |
| Add `/api/health` endpoint | Engineer B | P1 | Done | 2023-12-05 |
| Add Atlas alerting (connections, CPU, lag) | Tech Lead | P1 | Done | 2023-12-01 |
| Write `k6` baseline load test | Engineer B | P2 | Done | 2023-12-18 |
| Document pool sizing formula in runbook | Tech Lead | P2 | Done | 2024-01-10 |
| Evaluate image upload to S3 (removes single-instance constraint) | Engineer A | P3 | Backlogged | — |

---

## Lessons

**Load testing is not optional for any public-facing endpoint.** A 20-minute `k6` run with 50 concurrent users before Black Friday would have exposed the pool ceiling in the first 90 seconds. The fix would have been a one-line config change deployed weeks before the incident.

**Mongoose defaults are set for development, not production.** A pool size of 5 is appropriate for a single developer hitting a local database. It is not appropriate for any service that will receive concurrent traffic. Production configuration should be explicitly set and documented, not inherited from library defaults.

**Monitoring must cover application-layer constraints, not just infrastructure.** Atlas CPU and RAM looked healthy throughout the incident. An engineer without context would conclude the database was fine. The actual constraint — connection count at the application pool — was only visible after someone thought to check it manually. The fix was adding an alert specifically for that metric.

**"It worked in staging" is not a sufficient test.** Staging had one developer making occasional requests. The production traffic pattern (85 concurrent users, multi-query pages, logged-in session middleware) was qualitatively different. Staging should have a load profile that approximates production peak.

**Queue depth matters as much as pool size.** After the fix, `waitQueueTimeoutMS` was set so that requests that cannot get a connection within 5 seconds return a 503 immediately rather than hanging. Users get a clear error; the server doesn't accumulate zombie connections. Fail fast is better than fail slow.
