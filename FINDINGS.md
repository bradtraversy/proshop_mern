# Code Quality Findings

> Reviewed: 2026-04-27 | Reviewer: Claude Code (senior QA pass)

## Top 5 by Risk

| # | Where | What's wrong | Level | How to fix |
|---|-------|-------------|-------|-----------|
| 1 | `backend/middleware/authMiddleware.js` → `protect()` | After the `try/catch` block throws an error, execution falls through to the `if (!token)` check below — it can throw a second, unrelated error and mask the original one. | 🔴 critical | Add an `else` branch or restructure so the `!token` guard is at the top, before the try block. |
| 2 | `backend/controllers/orderController.js` → `updateOrderToPaid()` | Accesses `req.body.payer.email_address` with no null/undefined guard — crashes with an unhandled TypeError if the PayPal payload arrives malformed or missing `payer`. | 🔴 critical | Use optional chaining: `req.body?.payer?.email_address`. |
| 3 | `frontend/src/screens/PlaceOrderScreen.js` → disabled check | Button disabled condition is `cart.cartItems === 0` (comparing an **array** to the number 0 — always `false`), so the Place Order button is never actually disabled. | 🔴 critical | Change to `cart.cartItems.length === 0`. |
| 4 | `backend/config/db.js` + root `package.json` | `mongoose@5` with `useCreateIndex`, `useNewUrlParser`, `useUnifiedTopology` options — all removed in Mongoose 7; current version is 8. Will crash on a clean install against a modern Node/npm env. | 🔴 critical | Upgrade to `mongoose@8`, remove deprecated connection options. |
| 5 | `frontend/package.json` + `frontend/src/` | `react@16`, `react-scripts@3`, and `axios@0.20` — React 16 is 6 major versions behind (18 is LTS), react-scripts 3 requires the `NODE_OPTIONS=--openssl-legacy-provider` workaround, and axios 0.x has known CVEs. | 🟡 medium | Upgrade `react`/`react-dom` to 18, `react-scripts` to 5, `axios` to 1.x (expect minor breaking changes in Router and Bootstrap APIs too). |

---

## Full Findings by Category

### 1. HOTSPOTS

| File → Function | Issue | Level |
|-----------------|-------|-------|
| `frontend/src/screens/OrderScreen.js` | 213-line component with complex nested conditional rendering, multiple state selectors, and a deeply nested useEffect with PayPal SDK side effects. | 🟡 medium |
| `frontend/src/screens/ProductEditScreen.js` | 150+ line component mixing upload logic, form state, and product fetch in a single useEffect. | 🟡 medium |

### 2. EDGE CASES

| File → Function | Issue | Level |
|-----------------|-------|-------|
| `backend/middleware/authMiddleware.js` → `protect()` | Control flow bug: execution continues past the catch block and hits a second error path, masking the original error. | 🔴 critical |
| `backend/controllers/orderController.js` → `updateOrderToPaid()` | `req.body.payer.email_address` accessed without null guard — crashes if PayPal payload is missing `payer`. | 🔴 critical |
| `frontend/src/screens/PlaceOrderScreen.js` → disabled check | `cart.cartItems === 0` compares array to number (always `false`); Place Order button never disabled. | 🔴 critical |
| `backend/controllers/orderController.js` → `addOrderItems()` | Checks `orderItems.length === 0` but never guards against `orderItems` being `undefined`/`null`. No validation for shippingAddress, paymentMethod, or pricing fields. | 🟡 medium |
| `backend/controllers/productController.js` → `createProductReview()` | Destructures `rating` and `comment` from `req.body` without validating range (1–5) or non-empty string. | 🟡 medium |
| `backend/controllers/productController.js` → `updateProduct()` | No type or range validation on `price`/`countInStock` — invalid data is accepted and saved. | 🟡 medium |
| `backend/controllers/userController.js` → `registerUser()` | No email format check, no password strength requirement, no name length limit. | 🟡 medium |
| `frontend/src/actions/cartActions.js` → `addToCart()` | `axios.get()` call has no try/catch — if the request fails, dispatch still executes and the component crashes. | 🟡 medium |
| `frontend/src/screens/LoginScreen.js` | `location.search.split('=')[1]` throws if query string is malformed or contains no `=`. | 🟡 medium |
| `frontend/src/screens/RegisterScreen.js` | Same unsafe query-string parsing as LoginScreen. | 🟡 medium |

### 3. OUTDATED DEPS

| Package | Current in repo | Latest (2026) | Level |
|---------|----------------|---------------|-------|
| `mongoose` | `^5.10.6` | `8.x` | 🔴 critical |
| `react` / `react-dom` | `^16.13.1` | `18.x` | 🔴 critical |
| `react-scripts` | `3.4.3` | `5.0.x` | 🔴 critical |
| `axios` | `^0.20.0` | `1.6.x` | 🟡 medium |
| `react-router-dom` | `^5.2.0` | `6.x` | 🟡 medium |
| `dotenv` | `^8.2.0` | `16.x` | 🟡 medium |
| `jsonwebtoken` | `^8.5.1` | `9.x` | 🟡 medium |
| `react-bootstrap` | `^1.3.0` | `2.x` | 🟡 medium |
| `react-redux` | `^7.2.1` | `8.x` | 🟡 medium |

### 4. HARDCODED VALUES

| File → Location | Issue | Level |
|-----------------|-------|-------|
| `frontend/src/screens/PlaceOrderScreen.js` + `OrderScreen.js` | Tax rate `0.15` and free-shipping threshold `100` duplicated as magic numbers in two files. | 🟡 medium |
| `backend/utils/generateToken.js` | JWT expiration hardcoded as `'30d'` — not configurable via env. | 🟡 medium |
| `backend/routes/uploadRoutes.js` | Upload directory `'uploads/'`, allowed extensions `/jpg|jpeg|png/`, and no file size limit — all hardcoded. | 🟡 medium |
| `frontend/package.json` | Proxy `http://127.0.0.1:5000` hardcoded — not derived from env. | 🟡 medium |
| `backend/controllers/productController.js` | Page size `10` and top-products limit `3` hardcoded. | 🟢 cosmetic |
| `backend/server.js` | Fallback port `5000` hardcoded. | 🟢 cosmetic |

### 5. DEAD CODE

| File → Location | Issue | Level |
|-----------------|-------|-------|
| `frontend/src/screens/OrderScreen.js` | `console.log(paymentResult)` left in production path. | 🟢 cosmetic |
| `frontend/src/screens/ProductEditScreen.js` | `console.error(error)` in catch block instead of proper error handling. | 🟢 cosmetic |
| `backend/controllers/orderController.js` → `addOrderItems()` | Unreachable `return` statement after `throw new Error()`. | 🟢 cosmetic |
| `frontend/src/screens/PlaceOrderScreen.js` | `// eslint-disable-next-line` suppresses a missing-dependency warning in useEffect instead of fixing it. | 🟢 cosmetic |