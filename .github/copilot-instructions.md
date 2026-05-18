# Copilot Instructions — ProShop MERN

## Design rules: see ./DESIGN.md

## 1. Overview

ProShop is a full-stack e-commerce application built on the MERN stack (MongoDB, Express, React, Node.js). It supports product browsing with search and pagination, user authentication with JWT, shopping cart, PayPal checkout, product reviews, and an admin panel for managing users, products, and orders. The backend serves a REST API consumed by a React/Redux single-page application. Originally authored by Brad Traversy as a course project; deployed on Heroku.

## 2. Tech Stack

| Layer         | Technology                      | Version     |
|---------------|---------------------------------|-------------|
| Runtime       | Node.js                         | ≥18         |
| Backend       | Express                         | ^4.17       |
| Database      | MongoDB + Mongoose              | ^5.10       |
| Auth          | jsonwebtoken + bcryptjs         | ^8.5 / ^2.4 |
| Upload        | Multer                          | ^1.4        |
| Frontend      | React (Vite)                    | ^18.3       |
| State         | Redux + Redux Thunk             | ^4.2 / ^2.4 |
| UI            | Tailwind CSS v4 + shadcn/ui     | ^4.0        |
| Icons         | Lucide React                    | ^0.468      |
| Routing       | React Router DOM v5             | ^5.3        |
| HTTP          | Axios                           | ^1.7        |
| Module system | ES Modules (`"type": "module"`) | —           |

## 3. Architecture

```
proshop_mern/
├── backend/
│   ├── config/db.js              # Mongoose connection
│   ├── controllers/              # Request handlers (product, user, order)
│   ├── data/                     # Seed data (users.js, products.js)
│   ├── middleware/
│   │   ├── authMiddleware.js     # protect, admin guards
│   │   └── errorMiddleware.js    # notFound, errorHandler
│   ├── models/                   # Mongoose schemas (User, Product, Order)
│   ├── routes/                   # Express routers (product, user, order, upload)
│   ├── utils/generateToken.js    # JWT helper
│   ├── seeder.js                 # DB seed/destroy script
│   └── server.js                 # ★ Express entry point
├── frontend/src/
│   ├── actions/                  # Redux thunk action creators
│   ├── constants/                # Action type string constants
│   ├── reducers/                 # Redux reducers
│   ├── components/               # Reusable UI (Header, Footer, Loader, Rating…)
│   ├── screens/                  # Page-level components (15 screens)
│   ├── store.js                  # Redux store configuration
│   ├── App.js                    # Router & layout
│   └── index.js                  # ★ React entry point
├── uploads/                      # User-uploaded images (served statically)
├── package.json                  # Root: backend deps + dev scripts
├── Procfile                      # Heroku start command
└── .env                          # Environment variables (not committed)
```

**API base path:** `/api` — endpoints: `/api/products`, `/api/users`, `/api/orders`, `/api/upload`, `/api/config/paypal`.

## 4. Commands

```bash
npm install && npm install --prefix frontend   # Install all deps
npm run dev              # Dev: Express + CRA concurrently
npm run server           # Backend only (nodemon)
npm run client           # Frontend only (CRA)
npm run data:import      # Seed sample data
npm run data:destroy     # Wipe all collections
npm run build --prefix frontend   # Production build
npm test --prefix frontend        # Frontend tests (Jest/RTL)
```

> **No linter, formatter, or backend test suite** configured. Frontend uses CRA's default ESLint (`eslint-config-react-app`) and Jest/RTL scaffolding but has no written tests.

## 5. Conventions

### 5.0 Code Style
- **Indentation:** 4 spaces. **Line width:** 100 characters max.
- **Quotes:** Single quotes everywhere. **Semicolons:** Required.

### 5.1 File Naming
- **Backend:** camelCase — `productController.js`, `authMiddleware.js`, `userModel.js`.
- **Frontend components/screens:** PascalCase — `HomeScreen.js`, `Product.js`.
- **Frontend logic:** camelCase — `cartActions.js`, `userReducers.js`, `productConstants.js`.

### 5.2 Imports & Exports
- ES Modules everywhere (`import`/`export`). Backend files use `.js` extension in imports.
- **Models & components:** `export default`. **Controllers:** named export block `export { fn1, fn2 }`.
- **Constants:** individual named exports — `export const PRODUCT_LIST_REQUEST = '…'`.

### 5.3 Backend Controller Pattern
Every controller is wrapped with `express-async-handler` and preceded by a JSDoc-style comment:
```js
// @desc    Fetch single product
// @route   GET /api/products/:id
// @access  Public
const getProductById = asyncHandler(async (req, res) => { … })
```

### 5.4 Error Handling

**Backend:**
1. Every controller wrapped in `asyncHandler` — never use bare `async (req, res)`.
2. Signal errors by setting status then throwing: `res.status(404); throw new Error('Product not found');`
3. Global error middleware responds with `{ message, stack }` (stack only in dev). Status defaults to `500` if still `200`.
4. `notFound` middleware catches undefined routes → `404`. Auth middleware throws `401` with `'Not authorized, token failed'` / `'Not authorized, no token'` / `'Not authorized as an admin'`.
5. Never place code after `throw` — it is unreachable.

**Frontend (Redux actions):**
1. Every async action uses `try/catch`. Error extraction: prefer `error.response.data.message` over `error.message`.
2. Token expiry (`'Not authorized, token failed'`) auto-dispatches `logout()` to clear `localStorage`.
3. UI renders errors via `<Message variant='danger'>{error}</Message>`.
```js
catch (error) {
    const message = error.response && error.response.data.message
        ? error.response.data.message : error.message;
    if (message === 'Not authorized, token failed') { dispatch(logout()); }
    dispatch({ type: ACTION_FAIL, payload: message });
}
```

### 5.5 Redux Flow (Actions → Constants → Reducers)
- One file per domain in each of `actions/`, `constants/`, `reducers/`.
- Constant triplet: `DOMAIN_ACTION_REQUEST`, `_SUCCESS`, `_FAIL` (optional `_RESET`).
- Reducer shape: `{ loading, error, <data> }`.
- Auth requests: extract `userInfo.token` from `getState()`, pass as `Authorization: Bearer <token>`.
- Persistence: cart, user info, shipping, payment method stored in `localStorage`.

### 5.6 Screen Component Structure
```js
const ScreenName = ({ match, location, history }) => {
  // 1. Local state (useState)        // 4. Event handlers (*Handler suffix)
  // 2. Redux hooks (useDispatch/Sel)  // 5. Conditional renders (Loader/Message)
  // 3. Side effects (useEffect)       // 6. Main JSX
}
export default ScreenName
```

### 5.7 Routing
- React Router v5: `match.params`, `location.search`, `history.push`. Admin routes prefixed `/admin/`.

### 5.8 Auth
- JWT 30-day expiry in `localStorage`. Middleware chain: `protect` → `admin`. Header: `Authorization: Bearer <token>`.

## 6. What NOT To Do

- **Don't skip `asyncHandler`** — bare `async (req, res)` swallows errors silently.
- **Don't put code after `throw`** — it's unreachable (see `orderController.js`).
- **Don't omit `return` after `next()`** — `userModel.js` pre-save hook risks double hashing. Always `return next()`.
- **Don't pass user input to `$regex`** — `productController.js` is vulnerable to ReDoS. Escape special chars or use `$text`.
- **Don't commit `.env`** — secrets (`JWT_SECRET`, `MONGO_URI`, `PAYPAL_CLIENT_ID`) must stay out of version control.
- **Don't accept uploads without size limits** — add `limits: { fileSize: <max> }` to Multer config.
- **Don't skip request body validation** — use Joi / express-validator or manual checks before DB writes.
- **Don't introduce new state libraries** — follow existing `REQUEST/SUCCESS/FAIL` + thunk pattern.
- **Don't add class components** — the entire frontend uses functional components with hooks.
- **Don't use `require()`** — project is `"type": "module"`. Always use ES `import`/`export`.

## 7. Project Documentation Search (search-docs MCP)

- For any questions about functionality, features, architecture, ADRs, runbooks, or incidents — **ALWAYS** use the `search_project_docs` MCP tool first.
- It is faster and returns relevant chunks with metadata (source_file, parent_headings, score, snippet).
- **ONLY** if vector search did not return the needed results, or you need the full file content from a found chunk's metadata → fall back to grep + read.
- **DO NOT** start with grep + read across the project — it is slow and expensive in tokens.

## 8. Feature Flag Management (feature-flags MCP)

- When the user asks about a feature's status ("what's the status of gift_message?", "is search_v2 enabled?") — call `get_feature_info` from the feature-flags MCP. **Do not** read `features.json` directly.
- When the user wants to change a status ("enable feature X", "move Y to Testing", "set traffic to 25%") — call the appropriate MCP tools (`set_feature_state`, `adjust_traffic_rollout`). **Never** edit `backend/features.json` manually via Edit / Write.
- When the user asks for a list of all features — use the `list_features` tool. **Do not** grep the file.

## 9. Pull Request Approval Criteria

**Must have (blockers):**
- All CI checks pass
- Architecture patterns followed
- Proper error handling
- No security issues

**Should have:**
- Tests for new functionality
- Documentation updated if needed
- No code smells (functions <50 lines)
