> **TODO(audit-2026-05-29):** Frontend is now Vite (not CRA) and needs Node >=18; update the dev command and Node version. Backend/Mongo/Docker steps still valid.
>
> _Marker added during M6 Stage 3 living-docs audit. Behavioural content below verified accurate; only the noted parts are stale._

# Local Setup Runbook

**Purpose:** Bootstrap proshop-mern development environment on a fresh machine.  
**Audience:** Students, local development setup.  
**Duration:** 10–15 minutes (including Docker container startup).

## Prerequisites

- **Node.js** v14+ (check: `node --version`)
- **npm** v6+ (comes with Node; check: `npm --version`)
- **Docker Desktop** installed and running (for MongoDB)
- **Git** (check: `git --version`)
- **Text editor or IDE** (VS Code recommended)

## Step-by-Step Setup

### 1. Clone Repository

```bash
git clone <repository-url> proshop-mern
cd proshop-mern
```

Verify you're in the root directory by checking for `package.json`:

```bash
ls package.json  # Should print "package.json"
```

### 2. Install Root Dependencies

```bash
npm install
```

This installs backend dependencies: `express`, `mongoose`, `bcryptjs`, `jsonwebtoken`, `dotenv`, etc.

**Verify:** Check that `node_modules/` directory was created.

### 3. Install Frontend Dependencies

```bash
npm install --prefix frontend
```

This installs React, Redux, and frontend build tools in `frontend/node_modules/`.

### 4. Create Environment File

Copy the template:

```bash
cp .env.example .env
```

Edit `.env` with your values:

```
NODE_ENV=development
PORT=5001
MONGO_URI=mongodb://localhost:27017/proshop
JWT_SECRET=your_super_secret_key_here
PAYPAL_CLIENT_ID=sb
```

**Note:** For local dev:
- **PORT:** 5001 (5000 often conflicts with macOS Control Center).
- **MONGO_URI:** Use `localhost:27017` for local Docker MongoDB.
- **JWT_SECRET:** Any non-empty string for dev; rotate for production.
- **PAYPAL_CLIENT_ID:** `sb` for PayPal sandbox (safe for testing).

### 5. Start MongoDB Container

```bash
npm run mongo:up
```

This pulls and runs `mongo:7` container via Docker Compose.

**Verify container is running:**

```bash
docker ps | grep proshop-mongo
```

Expected output: Container named `proshop-mongo` with port mapping `27017:27017`.

### 6. Seed Database

```bash
npm run data:import
```

This script (`backend/seeder.js`) populates the database with sample users, products, and empty orders.

**Verify import succeeded:** You should see green output: `Data Imported!`

If import fails, check:
- MongoDB container is running (`npm run mongo:up`)
- `.env` file has correct `MONGO_URI`
- No network errors blocking localhost:27017

### 7. Start Development Servers

**Option A: Run Both Backend + Frontend Together**

```bash
npm run dev
```

This runs `concurrently` — backend on http://localhost:5001 and frontend on http://localhost:3000.

**Option B: Run Separately (for debugging)**

Terminal 1 — Backend:
```bash
npm run server
```

Terminal 2 — Frontend:
```bash
npm run client
```

### 8. Verify Application

**Check backend:** Open terminal and curl:

```bash
curl http://localhost:5001/api/products
```

Expected: JSON array of products.

**Check frontend:** Open browser:

```
http://localhost:3000
```

Expected: ProShop homepage with product grid, navbar, and shopping cart icon.

**Test basic flow:**
1. Click a product → view product details page.
2. Add to cart → item appears in cart (top-right corner).
3. Go to cart → see items with quantity selector.
4. Proceed to checkout → login or register.
5. Complete shipping and payment forms (PayPal sandbox accepted).

## Common Issues & Fixes

### Issue: `EADDRINUSE :::5001` (Port Already In Use)

**Solution:** Either:
1. Kill the process: `lsof -ti:5001 | xargs kill -9`
2. Change PORT in `.env` to an unused port (e.g., 5002).

### Issue: `MongoServerError: connect ECONNREFUSED 127.0.0.1:27017`

**Solution:**
1. Ensure Docker Desktop is running.
2. Start MongoDB: `npm run mongo:up`
3. Wait 3–5 seconds for container to be ready.
4. Check: `docker ps | grep mongo`

### Issue: `Cannot find module 'colors'`

**Solution:** Reinstall dependencies:

```bash
rm -rf node_modules
npm install
```

### Issue: Frontend shows blank page or 404 errors

**Solution:**
1. Backend server must be running on the correct port (check PORT in `.env`).
2. Check frontend `package.json` proxy matches backend PORT.
3. Clear browser cache: `Cmd+Shift+R` (macOS) or `Ctrl+Shift+R` (Windows/Linux).

### Issue: `openssl` legacy provider error

**Solution:** Already handled in `package.json` via `NODE_OPTIONS=--openssl-legacy-provider` for Node.js 16+.

## Useful Commands Reference

| Command | What It Does |
|---------|-------------|
| `npm run dev` | Start backend + frontend concurrently |
| `npm run server` | Start backend only (nodemon watch) |
| `npm run client` | Start frontend only (React dev server) |
| `npm run mongo:up` | Start MongoDB in Docker |
| `npm run mongo:down` | Stop MongoDB container |
| `npm run data:import` | Seed database with sample data |
| `npm run data:destroy` | Wipe all users, products, orders |
| `npm run data:import-extra` | Import additional seed data |

## Next Steps

Once local setup is complete:
1. Explore the codebase: backend routes in `backend/routes/`, frontend components in `frontend/src/components/`.
2. Read API documentation in project docs (if provided).
3. Start modifying features or adding new endpoints.
4. Run tests (if configured) or manually test via browser/curl.

## Shutdown

To cleanly shut down:

```bash
# Stop backend + frontend (Ctrl+C in terminal)
# Stop MongoDB container:
npm run mongo:down
```

This prevents port conflicts on the next startup.

---

**Last updated:** M3 curriculum.  
**Questions?** Check `.env.example` or `backend/config/db.js` for MongoDB connection options.
