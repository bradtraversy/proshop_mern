# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Before start

Install dependecies:

```bash
npm intall
```

```bash
# Development (runs both frontend on :3000 and backend on :5000 concurrently)
npm run dev

# Backend only (nodemon)
npm run server

# Frontend only
npm run client

# Production
npm start

# Seed database with sample data
npm run data:import

# Destroy all database data
npm run data:destroy

# Frontend tests
cd frontend && npm test
```

## Environment Variables

Create a `.env` file in the root directory:

```
NODE_ENV=development
PORT=5000
MONGO_URI=your_mongodb_uri
JWT_SECRET=your_jwt_secret
PAYPAL_CLIENT_ID=your_paypal_client_id
```

## Architecture

Full-stack MERN (MongoDB, Express, React, Node.js) eCommerce app.

**Backend** (`/backend/`) — Express API on port 5000:
- `server.js` — entry point; mounts routes, serves `frontend/build` in production
- `models/` — Mongoose schemas: `userModel`, `productModel` (with embedded reviews array), `orderModel`
- `controllers/` — business logic for products, users, orders
- `routes/` — REST API routes (`/api/products`, `/api/users`, `/api/orders`, `/api/upload`)
- `middleware/authMiddleware.js` — JWT `protect` middleware and `admin` role check
- `config/db.js` — MongoDB connection

**Frontend** (`/frontend/src/`) — React 16 app via Create React App:
- `App.js` — defines all React Router v5 routes
- `screens/` — page-level components (Home, Product, Cart, Checkout flow, Admin screens)
- `components/` — reusable UI pieces (Header, Footer, Rating, Loader, Message, etc.)
- `actions/` + `reducers/` + `constants/` — Redux with Thunk (pre-Redux Toolkit pattern)
- `store.js` — Redux store; initializes cart and userInfo from `localStorage`

**State Management**: Classic Redux pattern (actions → reducers → constants). Cart and user auth are persisted in `localStorage`. No Redux Toolkit — uses raw `createStore` with `combineReducers`.

**Auth**: JWT stored in Redux state (populated from `localStorage`). Backend `protect` middleware decodes token from `Authorization: Bearer <token>` header.

**File Uploads**: Multer handles image uploads; files saved to `/uploads/` directory served as static assets.

**Proxy**: Frontend `package.json` proxies API requests to `http://localhost:5000` in development.

## Key Patterns

### Backend

**Controller comments** — Every controller function uses a consistent 3-line header:
```js
// @desc    Get all products
// @route   GET /api/products
// @access  Public
```

**Async error handling** — Controllers use `express-async-handler` instead of try/catch:
```js
const getProducts = asyncHandler(async (req, res) => {
  const products = await Product.find({})
  res.json(products)
})
```

**Route protection** — Middleware chained directly on routes:
```js
router.route('/').get(getProducts).post(protect, admin, createProduct)
```

### Frontend

**Redux action shape** — Every async action follows `REQUEST → SUCCESS → FAIL`:
```js
dispatch({ type: PRODUCT_LIST_REQUEST })
// ...axios call...
dispatch({ type: PRODUCT_LIST_SUCCESS, payload: data })
// ...catch...
dispatch({ type: PRODUCT_LIST_FAIL, payload: message })
```

**Auth header config** — Repeated in every protected action:
```js
const { userInfo } = getState().userLogin
const config = { headers: { Authorization: `Bearer ${userInfo.token}` } }
```

**Screen structure** — Every screen follows: `useDispatch` + `useSelector` → `useEffect` to dispatch → render with `{loading ? <Loader/> : error ? <Message/> : <content/>}`.

### Data Flow

```
User action → dispatch(actionCreator) → axios call → dispatch(SUCCESS/FAIL)
     → reducer updates store → useSelector re-renders screen
```

Cart and `userInfo` are persisted to `localStorage` and rehydrated into the Redux store on app load (`store.js`).

## Sample Credentials (seeded data)

- Admin: `admin@example.com` / `123456`
- Users: `john@example.com` / `123456`, `jane@example.com` / `123456`

## Secrets & Env Safety
- Never print secret values (even truncated) in code or logs
- Stop and ask if a task seems to require new env vars
- Secrets live in `.env.local` (gitignored)

