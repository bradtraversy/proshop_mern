> **TODO(audit-2026-05-29):** No app test suite exists (tests live only under homework-m6/), and stores are polyglot (Mongo + Postgres/pgvector) — adjust the 'npm run test' and Mongo-only assumptions.
>
> _Marker added during M6 Stage 3 living-docs audit. Behavioural content below verified accurate; only the noted parts are stale._

# Deployment Runbook

**Purpose:** Deploy proshop-mern to production (Heroku).  
**Audience:** DevOps engineers, deployment maintainers.  
**Duration:** 20–30 minutes including build time.  
**Prerequisites:** Heroku CLI installed, git remote configured, production MongoDB Atlas cluster.

## Pre-Deployment Checklist

Before deploying to production:

- [ ] All tests pass locally (`npm run test`, if available).
- [ ] Code reviewed and merged to `main` branch.
- [ ] Environment variables verified for production.
- [ ] MongoDB Atlas connection string validated.
- [ ] Backup of production database taken (if updating schema).
- [ ] Rollback plan documented (see Rollback Procedure below).
- [ ] Notify team of planned deployment window (if during business hours).

## Environment Variables Setup

### 1. Create `.env.production` (Never Commit)

```
NODE_ENV=production
PORT=80
MONGO_URI=mongodb+srv://<user>:<password>@<cluster>/proshop?retryWrites=true&w=majority
JWT_SECRET=<generate-a-strong-random-secret>
PAYPAL_CLIENT_ID=<production-client-id>
```

### 2. Set Heroku Config Vars

```bash
heroku config:set NODE_ENV=production --app proshop-prod
heroku config:set MONGO_URI="mongodb+srv://<user>:<password>@..." --app proshop-prod
heroku config:set JWT_SECRET="<strong-secret>" --app proshop-prod
heroku config:set PAYPAL_CLIENT_ID="<prod-id>" --app proshop-prod
```

Verify config was set:

```bash
heroku config --app proshop-prod
```

## Deployment Process

### Step 1: Prepare Git Repository

Ensure you're on the `main` branch with all changes committed:

```bash
git status  # Should show "working tree clean"
git branch  # Should show "* main"
```

If you have uncommitted changes, either commit or stash them:

```bash
git add .
git commit -m "Deployment: prepare production release"
```

### Step 2: Build Frontend

The `heroku-postbuild` script in `package.json` handles this automatically, but you can test locally:

```bash
npm run build --prefix frontend
```

This creates `frontend/build/` with optimized React bundle.

### Step 3: Deploy to Heroku

Push to Heroku remote:

```bash
git push heroku main
```

**Expected output:**
- Heroku compiles Node.js dependencies.
- Runs `heroku-postbuild` script (installs frontend deps + builds React).
- Starts the app dyno.
- Logs appear in terminal — watch for errors.

**Typical build time:** 3–5 minutes.

### Step 4: Verify Deployment

Check app status:

```bash
heroku logs --app proshop-prod --tail
```

Expected final log line: `App started` or `Listening on port 80` (or dynamic PORT).

Open the app in browser:

```bash
heroku open --app proshop-prod
```

**Manual checks:**
1. Homepage loads and displays product grid.
2. Click a product — details page renders.
3. Add to cart — cart updates.
4. Login — authentication works.
5. Curl API endpoint: `curl https://proshop-prod.herokuapp.com/api/products`

## Rollback Procedure

If deployment causes issues, quickly revert to the previous version:

### Option 1: Rollback via Heroku Release History

```bash
# View recent releases
heroku releases --app proshop-prod

# Output:
# === Releases - proshop-prod
# v25   Deploy 1a2b3c  2024-04-15 14:32:00 UTC
# v24   Deploy 4d5e6f  2024-04-14 13:12:00 UTC
# ...

# Rollback to previous release (v24)
heroku releases:rollback v24 --app proshop-prod
```

Heroku automatically restarts the app with the previous code. Wait ~1 minute for restart.

### Option 2: Rollback via Git

If Heroku rollback is unavailable, push a previous commit:

```bash
# Find the commit before the broken deployment
git log --oneline | head -10

# Revert to a specific commit
git revert HEAD  # or git reset --hard <commit-hash>

# Push again
git push heroku main --force
```

**Warning:** Using `--force` can cause race conditions. Prefer Option 1.

### Option 3: Emergency Kill Switch

Temporarily disable the app:

```bash
heroku dyno:kill web.1 --app proshop-prod
```

This stops the app immediately (users see error page). Buy time to investigate root cause and prepare a real fix.

To restart:

```bash
heroku dyno:restart --app proshop-prod
```

## Monitoring Post-Deployment

### Check Application Logs

```bash
heroku logs --app proshop-prod --num 100  # Last 100 lines
```

Watch for:
- `Error:` or `FATAL:` messages.
- `MongoError:` — database connection issues.
- `ReferenceError:` — undefined variables.

### Monitor Dyno Performance

```bash
heroku dyno:type --app proshop-prod
```

Check CPU/memory usage (available in Heroku dashboard).

### Basic Health Check

Create a simple endpoint in your backend (if not already present) to monitor:

```javascript
// backend/routes/healthRoutes.js
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date() })
})
```

Curl it every 30 seconds for 5 minutes post-deploy:

```bash
watch -n 30 'curl -s https://proshop-prod.herokuapp.com/api/health | jq .'
```

## Troubleshooting Deployment Issues

### Issue: `H14 – No web processes running`

**Cause:** Procfile missing or incorrect.  
**Fix:** Ensure `Procfile` exists in root:

```
web: node backend/server.js
```

Redeploy:

```bash
git push heroku main
```

### Issue: `Application error` on browser, logs show `Cannot find module`

**Cause:** Dependencies not installed.  
**Fix:** Clear Heroku build cache and redeploy:

```bash
heroku builds:cancel --app proshop-prod
git push heroku main --force
```

### Issue: `MONGO_URI not found` error

**Cause:** Environment variable not set.  
**Fix:** Verify config vars:

```bash
heroku config --app proshop-prod | grep MONGO
```

If missing, set it:

```bash
heroku config:set MONGO_URI="mongodb+srv://..." --app proshop-prod
```

Restart app:

```bash
heroku dyno:restart --app proshop-prod
```

### Issue: Frontend shows blank page

**Cause:** Frontend bundle not built or served correctly.  
**Fix:**
1. Check `heroku-postbuild` script ran: `heroku logs | grep build`
2. Verify `server.js` has static file handler for `frontend/build/`.
3. Rebuild frontend manually: `npm run build --prefix frontend && git push heroku main`

## Post-Deployment

Once verified stable:

1. **Document the release:** Update `CHANGELOG.md` (if available).
   ```markdown
   ## [1.0.5] — 2024-04-15
   - Fixed payment flow bug
   - Updated product filters
   ```

2. **Notify stakeholders:** Alert team that deployment is complete and stable.

3. **Monitor for 24 hours:** Watch logs and error tracking for anomalies.

4. **Cleanup:** Remove any temporary branches or configs.

## Reference Commands

| Command | Purpose |
|---------|---------|
| `git push heroku main` | Deploy main branch to Heroku |
| `heroku logs --tail` | Stream live logs |
| `heroku config` | View all environment variables |
| `heroku restart` | Restart the app dyno |
| `heroku releases` | View deployment history |
| `heroku releases:rollback` | Revert to previous release |

---

**Last updated:** M3 curriculum.  
**Contact:** Deploy lead or DevOps team for production secrets (MONGO_URI, JWT_SECRET).
