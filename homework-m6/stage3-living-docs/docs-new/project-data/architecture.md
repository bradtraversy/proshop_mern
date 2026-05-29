> **TODO(audit-2026-05-29):** Tech-stack lists React-Bootstrap and .js screens — superseded by Tailwind v4 + shadcn rework. Add the RAG/pgvector + two MCP servers and a polyglot-persistence (Mongo + features.json + Postgres/pgvector) section.
>
> _Marker added during M6 Stage 3 living-docs audit. Behavioural content below verified accurate; only the noted parts are stale._

# ProShop MERN — Architecture Overview

> **Deprecation notice.** The upstream project (`bradtraversy/proshop_mern`) is
> explicitly marked as deprecated in favour of `proshop-v2`. This document
> describes the v1 codebase as-is, including its known technical debt, because
> understanding legacy code is part of the exercise.

---

## 1. System Overview

ProShop is a full-stack e-commerce web application built with the MERN stack
(MongoDB, Express, React, Node). It ships a working storefront where customers
browse a product catalogue, build a cart, authenticate, complete a multi-step
checkout, and pay via PayPal. Administrators get a separate management surface
for products, users, and orders.

**Business scope:**

- Product catalogue with pagination, keyword search, and top-rated carousel.
- Per-product star rating and comment system (one review per authenticated user).
- Cart with quantity control, persisted across page reloads via `localStorage`.
- Multi-step checkout: cart → shipping → payment method → order summary → pay.
- PayPal Sandbox payment capture with order status lifecycle (`isPaid`,
  `isDelivered`).
- Admin panel: user CRUD, product CRUD with image upload, order delivery
  management.

**Actors:**

| Actor | Entry points |
|---|---|
| Guest | `/`, `/product/:id` — read-only catalogue |
| Customer (authenticated) | Cart, checkout, order history (`/profile`), reviews |
| Admin | `/admin/userlist`, `/admin/productlist`, `/admin/orderlist`, individual edit screens |

---

## 2. Tech Stack

### Backend

| Technology | Version | Role |
|---|---|---|
| Node.js | 22 (runtime; `"type": "module"` — full ESM) | Runtime |
| Express | ^4.17.1 | HTTP server, routing |
| Mongoose | ^5.10.6 | ODM for MongoDB |
| MongoDB | 7 (Docker image `mongo:7`) | Primary data store |
| jsonwebtoken | ^8.5.1 | JWT signing and verification |
| bcryptjs | ^2.4.3 | Password hashing |
| multer | ^1.4.2 | Multipart file upload handling |
| morgan | ^1.10.0 | HTTP request logger (dev only) |
| dotenv | ^8.2.0 | Env variable loading |
| express-async-handler | ^1.1.4 | Async error propagation without try/catch in every handler |
| colors | ^1.4.0 | Colored console output |
| nodemon | ^2.0.4 (dev) | Auto-restart on file change |
| concurrently | ^5.3.0 (dev) | Run server + client in one terminal |

### Frontend

| Technology | Version | Role |
|---|---|---|
| React | ^16.13.1 | UI library |
| React DOM | ^16.13.1 | DOM rendering |
| React Router DOM | ^5.2.0 | Client-side routing |
| Redux | ^4.0.5 | Global state management |
| React Redux | ^7.2.1 | React bindings for Redux |
| Redux Thunk | ^2.3.0 | Async action middleware |
| redux-devtools-extension | ^2.13.8 | Redux DevTools integration |
| axios | ^0.20.0 | HTTP client for API calls |
| React Bootstrap | ^1.3.0 | Bootstrap 4 component library |
| react-paypal-button-v2 | ^2.6.2 | PayPal SDK integration component |
| react-helmet | ^6.1.0 | `<head>` meta tag management |
| react-scripts | 3.4.3 | CRA build toolchain |

---

## 3. System Layers

```
┌─────────────────────────────────────────────────────────┐
│  Browser                                                │
│  React 16 SPA (CRA)                                     │
│  Redux Store  ←→  Screens  ←→  Components              │
│  axios (proxy → :5001)                                  │
└────────────────────────┬────────────────────────────────┘
                         │ HTTP /api/*
┌────────────────────────▼────────────────────────────────┐
│  Node 22 / Express 4                                    │
│  morgan → json parser → routes → middleware → handlers  │
│  Static: /uploads  (dev + prod)                         │
│  Static: /frontend/build  (prod only)                   │
└────────────────────────┬────────────────────────────────┘
                         │ mongoose
┌────────────────────────▼────────────────────────────────┐
│  MongoDB 7  (Docker volume mongo_data)                  │
│  Collections: users, products, orders                   │
└─────────────────────────────────────────────────────────┘

External integrations
  PayPal Sandbox  ←  react-paypal-button-v2 (frontend)
                  →  PUT /api/orders/:id/pay  (backend confirms)
```

**Development proxy:** `frontend/package.json` sets `"proxy": "http://127.0.0.1:5001"`,
so `axios.get('/api/...')` in dev goes to the Express server without CORS
issues. In production the frontend is built and served statically by Express
itself.

---

## 4. Frontend Architecture

### 4.1 Entry Point and Store Bootstrapping

`frontend/src/index.js` wraps `<App>` in a Redux `<Provider>`. The store
(`store.js`) is constructed with `createStore(reducer, initialState,
composeWithDevTools(applyMiddleware(thunk)))`.

State hydration from `localStorage` happens at store creation time — not in a
middleware, not lazily:

```js
const cartItemsFromStorage = localStorage.getItem('cartItems')
  ? JSON.parse(localStorage.getItem('cartItems'))
  : []

const userInfoFromStorage = localStorage.getItem('userInfo')
  ? JSON.parse(localStorage.getItem('userInfo'))
  : null

const initialState = {
  cart: { cartItems: cartItemsFromStorage, shippingAddress: shippingAddressFromStorage },
  userLogin: { userInfo: userInfoFromStorage },
}
```

### 4.2 Redux Store Structure

`combineReducers` merges 20 slices into a flat state tree:

| State key | Reducer | What it holds |
|---|---|---|
| `productList` | `productListReducer` | `{ loading, products[], pages, page, error }` |
| `productDetails` | `productDetailsReducer` | `{ loading, product, error }` |
| `productDelete` | `productDeleteReducer` | `{ loading, success, error }` |
| `productCreate` | `productCreateReducer` | `{ loading, success, product, error }` |
| `productUpdate` | `productUpdateReducer` | `{ loading, success, product, error }` |
| `productReviewCreate` | `productReviewCreateReducer` | `{ loading, success, error }` |
| `productTopRated` | `productTopRatedReducer` | `{ loading, products[], error }` |
| `cart` | `cartReducer` | `{ cartItems[], shippingAddress, paymentMethod }` |
| `userLogin` | `userLoginReducer` | `{ loading, userInfo, error }` |
| `userRegister` | `userRegisterReducer` | `{ loading, userInfo, error }` |
| `userDetails` | `userDetailsReducer` | `{ loading, user, error }` |
| `userUpdateProfile` | `userUpdateProfileReducer` | `{ loading, success, userInfo, error }` |
| `userList` | `userListReducer` | `{ loading, users[], error }` |
| `userDelete` | `userDeleteReducer` | `{ loading, success, error }` |
| `userUpdate` | `userUpdateReducer` | `{ loading, success, error }` |
| `orderCreate` | `orderCreateReducer` | `{ loading, success, order, error }` |
| `orderDetails` | `orderDetailsReducer` | `{ loading, order, error }` |
| `orderPay` | `orderPayReducer` | `{ loading, success, error }` |
| `orderDeliver` | `orderDeliverReducer` | `{ loading, success, error }` |
| `orderListMy` | `orderListMyReducer` | `{ loading, orders[], error }` |
| `orderList` | `orderListReducer` | `{ loading, orders[], error }` |

Each slice follows the same three-state pattern: `loading: true` on REQUEST,
populated data on SUCCESS, `error` on FAIL. RESET actions clear the slice back
to its initial value to prevent stale state between navigations.

### 4.3 Action Creators

Actions are organised in four files under `frontend/src/actions/`:

- **`productActions.js`** — `listProducts`, `listProductDetails`,
  `deleteProduct`, `createProduct`, `updateProduct`, `createProductReview`,
  `listTopProducts`.
- **`cartActions.js`** — `addToCart`, `removeFromCart`,
  `saveShippingAddress`, `savePaymentMethod`. Cart actions write to
  `localStorage` directly after dispatching.
- **`userActions.js`** — `login`, `logout`, `register`, `getUserDetails`,
  `updateUserProfile`, `listUsers`, `deleteUser`, `updateUser`. The `logout`
  action clears all localStorage keys and forces a redirect to `/login` via
  `document.location.href`.
- **`orderActions.js`** — `createOrder`, `getOrderDetails`, `payOrder`,
  `deliverOrder`, `listMyOrders`, `listOrders`.

All async actions are thunks. The pattern is uniform: dispatch REQUEST → call
axios → dispatch SUCCESS or FAIL. Authenticated actions extract the JWT token
from `state.userLogin.userInfo.token` via `getState()`. When the server returns
`"Not authorized, token failed"`, the action dispatches `logout()` to force a
clean session wipe.

### 4.4 Screens vs Components

**`frontend/src/screens/`** — 14 page-level components, one per route. Screens
own Redux interaction: `useSelector` to read state, `useDispatch` to trigger
actions, `useEffect` to trigger fetches on mount.

| Screen | Route | Access |
|---|---|---|
| `HomeScreen` | `/`, `/search/:keyword`, `/page/:pageNumber` | Public |
| `ProductScreen` | `/product/:id` | Public |
| `CartScreen` | `/cart/:id?` | Public (read); add requires auth |
| `LoginScreen` | `/login` | Guest only |
| `RegisterScreen` | `/register` | Guest only |
| `ProfileScreen` | `/profile` | Auth |
| `ShippingScreen` | `/shipping` | Auth |
| `PaymentScreen` | `/payment` | Auth |
| `PlaceOrderScreen` | `/placeorder` | Auth |
| `OrderScreen` | `/order/:id` | Auth |
| `UserListScreen` | `/admin/userlist` | Admin |
| `UserEditScreen` | `/admin/user/:id/edit` | Admin |
| `ProductListScreen` | `/admin/productlist`, `/admin/productlist/:pageNumber` | Admin |
| `ProductEditScreen` | `/admin/product/:id/edit` | Admin |
| `OrderListScreen` | `/admin/orderlist` | Admin |

**`frontend/src/components/`** — 12 reusable UI components that receive props,
have no direct Redux coupling (except `Header` and `ProductCarousel` which
use `useSelector`):

`Header`, `Footer`, `Product`, `ProductCarousel`, `Rating`, `Loader`,
`Message`, `CheckoutSteps`, `Paginate`, `SearchBox`, `FormContainer`, `Meta`.

### 4.5 Routing

React Router v5 is used with `<BrowserRouter>` and flat `<Route>` components
(no `<Switch>`). This means multiple routes can match simultaneously — an
intentional CRA v1 pattern that works because routes are distinct enough not
to collide in practice. Admin guard is implemented at the screen level (each
admin screen checks `userInfo.isAdmin` and redirects if not met), not at the
router level.

### 4.6 State Lifecycle for Checkout

```
CartScreen → dispatch addToCart → cartReducer → localStorage
ShippingScreen → dispatch saveShippingAddress → cartReducer → localStorage
PaymentScreen → dispatch savePaymentMethod → cartReducer → localStorage
PlaceOrderScreen → dispatch createOrder → POST /api/orders
    → ORDER_CREATE_SUCCESS → dispatch CART_CLEAR_ITEMS + remove 'cartItems'
    → history.push(/order/:id)
OrderScreen → loads PayPal SDK via GET /api/config/paypal
    → user approves → react-paypal-button-v2 callback
    → dispatch payOrder → PUT /api/orders/:id/pay
```

Price calculation (items, shipping, tax, total) happens client-side in
`PlaceOrderScreen` and `OrderScreen`. Shipping is free above $100; tax is fixed
at 15%.

---

## 5. Backend Architecture

### 5.1 Express Middleware Chain

`backend/server.js` assembles middleware in this order:

```
morgan('dev')          // dev only; logs METHOD URL status ms
express.json()         // parses application/json body
/api/products → productRoutes
/api/users    → userRoutes
/api/orders   → orderRoutes
/api/upload   → uploadRoutes
GET /api/config/paypal → inline handler (returns PAYPAL_CLIENT_ID)
/uploads      → express.static (serves uploaded images)
production:   → express.static(frontend/build) + wildcard SPA fallback
notFound      // 404 for unmatched routes
errorHandler  // unified error response
```

### 5.2 REST Routes

**Products** — `GET /api/products`

| Method | Path | Auth | Controller |
|---|---|---|---|
| GET | `/api/products` | Public | `getProducts` — paginated, keyword search |
| GET | `/api/products/top` | Public | `getTopProducts` — top 3 by rating |
| GET | `/api/products/:id` | Public | `getProductById` |
| POST | `/api/products` | Admin | `createProduct` — creates placeholder |
| PUT | `/api/products/:id` | Admin | `updateProduct` |
| DELETE | `/api/products/:id` | Admin | `deleteProduct` |
| POST | `/api/products/:id/reviews` | Auth | `createProductReview` |

**Users** — `GET /api/users`

| Method | Path | Auth | Controller |
|---|---|---|---|
| POST | `/api/users` | Public | `registerUser` |
| POST | `/api/users/login` | Public | `authUser` — returns JWT |
| GET | `/api/users/profile` | Auth | `getUserProfile` |
| PUT | `/api/users/profile` | Auth | `updateUserProfile` — returns new JWT |
| GET | `/api/users` | Admin | `getUsers` |
| GET | `/api/users/:id` | Admin | `getUserById` |
| PUT | `/api/users/:id` | Admin | `updateUser` |
| DELETE | `/api/users/:id` | Admin | `deleteUser` |

**Orders** — `GET /api/orders`

| Method | Path | Auth | Controller |
|---|---|---|---|
| POST | `/api/orders` | Auth | `addOrderItems` |
| GET | `/api/orders/myorders` | Auth | `getMyOrders` |
| GET | `/api/orders/:id` | Auth | `getOrderById` — populates user name/email |
| PUT | `/api/orders/:id/pay` | Auth | `updateOrderToPaid` |
| PUT | `/api/orders/:id/deliver` | Admin | `updateOrderToDelivered` |
| GET | `/api/orders` | Admin | `getOrders` |

**Upload** — `POST /api/upload` (Admin) — returns file path string.

### 5.3 Controllers

Controllers use `express-async-handler` to wrap every handler, so thrown errors
propagate to Express's error middleware without explicit try/catch in each
function. The pattern is consistent:

```js
const getProductById = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id)
  if (product) {
    res.json(product)
  } else {
    res.status(404)
    throw new Error('Product not found')
  }
})
```

Pagination in `getProducts`: page size hardcoded at 10, MongoDB `.limit()` and
`.skip()` applied. Keyword search uses a case-insensitive `$regex` on the
`name` field — not a full-text index.

`createProduct` creates a placeholder document with sample data; the admin is
expected to immediately edit it on the product edit screen.

`createProductReview` prevents duplicate reviews by checking
`product.reviews.find(r => r.user.toString() === req.user._id.toString())`.
Rating is recalculated as a simple arithmetic mean on every new review.

### 5.4 Mongoose Models

See Section 6 for full schema detail.

### 5.5 JWT Auth Flow

1. Client POSTs credentials to `/api/users/login`.
2. Controller calls `user.matchPassword(password)` — a Mongoose instance method
   using `bcrypt.compare`.
3. On success, `generateToken(user._id)` signs a JWT with `process.env.JWT_SECRET`
   (expiry configured in `generateToken.js`; defaults to 30 days in the
   upstream implementation).
4. The JWT is returned in the response body and stored in `localStorage` by the
   frontend.
5. Subsequent requests include `Authorization: Bearer <token>`.
6. The `protect` middleware in `authMiddleware.js` verifies the token, loads
   the full user from MongoDB (excluding password), and attaches it to
   `req.user`.
7. The `admin` middleware checks `req.user.isAdmin`; returns 401 if false.

### 5.6 File Uploads

`multer` is configured in `uploadRoutes.js` with disk storage writing to the
`uploads/` directory at the project root. Constraints:

- Allowed extensions: `.jpg`, `.jpeg`, `.png`
- MIME type check: `image/jpeg`, `image/png`
- Max file size: 2 MB (`2 * 1024 * 1024` bytes)
- Filename pattern: `image-{timestamp}.{ext}` (field name + Date.now)

The route is admin-only (`protect, admin`). On success the handler returns a
plain string path (e.g. `/uploads/image-1712345678900.jpg`) which the client
stores in the `image` field of the product form.

The `uploads/` directory is served as static files by Express:

```js
app.use('/uploads', express.static(path.join(__dirname, '/uploads')))
```

---

## 6. Data Layer

### 6.1 Collection: `users`

```
User {
  _id:       ObjectId (auto)
  name:      String   required
  email:     String   required, unique
  password:  String   required  // bcrypt hash, salt rounds = 10
  isAdmin:   Boolean  required, default: false
  createdAt: Date     (timestamps)
  updatedAt: Date     (timestamps)
}
```

- **Instance method** `matchPassword(enteredPassword)` — `bcrypt.compare`.
- **Pre-save hook** — hashes password only when `isModified('password')`.
  This prevents re-hashing on `updateUserProfile` calls that change only name
  or email.

### 6.2 Collection: `products`

```
Product {
  _id:          ObjectId (auto)
  user:         ObjectId → User  // admin who created/owns the product
  name:         String   required
  image:        String   required  // path to image file or URL
  brand:        String   required
  category:     String   required
  description:  String   required
  reviews:      [Review]           // embedded array
  rating:       Number   required, default: 0
  numReviews:   Number   required, default: 0
  price:        Number   required, default: 0
  countInStock: Number   required, default: 0
  createdAt:    Date     (timestamps)
  updatedAt:    Date     (timestamps)
}

Review {                           // embedded sub-document
  _id:       ObjectId (auto)
  name:      String  required      // denormalised from user at review time
  rating:    Number  required
  comment:   String  required
  user:      ObjectId → User
  createdAt: Date    (timestamps)
  updatedAt: Date    (timestamps)
}
```

Reviews are **embedded** in the product document, not a separate collection.
This means loading a single product always returns all its reviews. `rating` and
`numReviews` are **denormalised** aggregate fields, updated synchronously in the
controller every time a review is added.

Keyword search: `{ name: { $regex: keyword, $options: 'i' } }` — scans all
documents, no text index. Adequate for a demo dataset; would not scale.

### 6.3 Collection: `orders`

```
Order {
  _id:             ObjectId (auto)
  user:            ObjectId → User
  orderItems:      [OrderItem]
  shippingAddress: {
    address:    String required
    city:       String required
    postalCode: String required
    country:    String required
  }
  paymentMethod:   String  required
  paymentResult:   {        // populated after PayPal confirmation
    id:            String
    status:        String
    update_time:   String
    email_address: String
  }
  itemsPrice:      Number  required, default: 0
  taxPrice:        Number  required, default: 0
  shippingPrice:   Number  required, default: 0
  totalPrice:      Number  required, default: 0
  isPaid:          Boolean required, default: false
  paidAt:          Date
  isDelivered:     Boolean required, default: false
  deliveredAt:     Date
  createdAt:       Date    (timestamps)
  updatedAt:       Date    (timestamps)
}

OrderItem {               // embedded sub-document
  name:    String  required
  qty:     Number  required
  image:   String  required
  price:   Number  required
  product: ObjectId → Product
}
```

`OrderItem` is embedded in the order document. Product fields (`name`, `image`,
`price`) are **denormalised at order creation time** — they capture the state of
the product at purchase, insulating the order from future product edits.

### 6.4 Cross-Collection Relationships

```
User  ──< Order            (User.id in Order.user)
Order ──< OrderItem        (embedded)
OrderItem >── Product      (Product.id in OrderItem.product)
Product ──< Review         (embedded)
Review >── User            (User.id in Review.user)
Product >── User           (User.id in Product.user — creator)
```

`Order.findById().populate('user', 'name email')` is the only explicit
`populate()` call in the codebase, used by `getOrderById` and `getOrders`.
Other relationships are resolved client-side or not at all.

### 6.5 Indexes

Mongoose 5 with `useCreateIndex: true` creates unique indexes declared in the
schema. The only explicit unique index is `email` on the `users` collection.
No compound indexes, no text indexes. `_id` indexes are implicit on all
collections.

---

## 7. External Integrations

### 7.1 PayPal Sandbox

The integration uses `react-paypal-button-v2` (wraps the PayPal JavaScript SDK
v2). Flow:

1. `OrderScreen` calls `GET /api/config/paypal` to fetch `PAYPAL_CLIENT_ID`
   from the server (avoids embedding the key in the frontend bundle).
2. A `<script>` tag pointing to `https://www.paypal.com/sdk/js?client-id=...`
   is injected dynamically.
3. Once the SDK is ready (`sdkReady` state), `<PayPalButton>` renders.
4. On approval, PayPal calls the `onSuccess` callback with a payment result
   object (id, status, update_time, payer.email_address).
5. The frontend dispatches `payOrder(orderId, paymentResult)` which calls
   `PUT /api/orders/:id/pay` with the result in the body.
6. The controller sets `isPaid = true`, `paidAt = Date.now()`, and saves
   `paymentResult` in the order document. No server-side PayPal verification
   is performed — the backend trusts the client-provided result object.

**Security note:** No server-side verification of the PayPal payment is
implemented. A malicious client could call `PUT /api/orders/:id/pay` with
fabricated data. In a production system this route must verify the transaction
with PayPal's Orders API before marking the order paid.

### 7.2 Image Uploads

Handled entirely on-premise: `multer` saves to the local filesystem (`uploads/`),
Express serves the files statically. No CDN, no cloud storage. On Heroku (the
original target) the ephemeral filesystem would lose all uploads on dyno
restart — one of the reasons the upstream deprecated this project.

---

## 8. Deployment and DevOps

### 8.1 Local Development

```bash
# Start MongoDB in Docker
npm run mongo:up        # docker compose up -d mongo

# Seed the database
npm run data:import     # node backend/seeder
npm run data:import-extra  # node backend/seedExtra (extended fixtures)

# Run both servers
npm run dev             # concurrently: nodemon server + CRA dev server
```

The frontend dev server runs on port 3000 (CRA default). The backend runs on
port 5000 by default (overridden by `PORT` env var). The CRA proxy setting
routes `/api/*` to `:5001` — note the backend and proxy target differ if
`PORT` is not set, which can cause confusion; the actual backend port must
match the proxy target in `frontend/package.json`.

### 8.2 Docker Compose

`docker-compose.yml` defines a single `mongo` service:

```yaml
services:
  mongo:
    image: mongo:7
    container_name: proshop-mongo
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db
```

No application container is defined — Node runs on the host directly.

### 8.3 Procfile and Production Build

```
web: node backend/server.js
```

`heroku-postbuild` in `package.json`:

```bash
NPM_CONFIG_PRODUCTION=false npm install --prefix frontend \
  && NODE_OPTIONS=--openssl-legacy-provider npm run build --prefix frontend
```

This installs frontend deps and produces `frontend/build/`. In production
(`NODE_ENV=production`) Express serves this directory as a static SPA and
catches all `*` routes to return `index.html`.

The `NODE_OPTIONS=--openssl-legacy-provider` flag is required because
`react-scripts 3.4.3` uses webpack 4 which calls a deprecated OpenSSL API
removed in Node 17+.

**Current status:** Heroku Free tier was discontinued in 2022. This project is
not deployed anywhere. The Procfile is retained as a reference (ADR-0003).

### 8.4 Environment Variables

Required variables in a `.env` file at the project root:

| Variable | Purpose |
|---|---|
| `NODE_ENV` | `development` / `production` |
| `PORT` | Backend listen port (default 5000) |
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret for signing JWTs |
| `PAYPAL_CLIENT_ID` | PayPal Sandbox client ID |

---

## 9. Cross-Cutting Concerns

### 9.1 Authentication and Authorisation

Two middleware functions in `backend/middleware/authMiddleware.js`:

- `protect` — extracts and verifies the Bearer JWT, loads the user from the
  database (minus password), attaches to `req.user`, calls `next()`. Returns
  401 on missing or invalid token.
- `admin` — checks `req.user.isAdmin`; returns 401 if false.

Routes compose them: `router.route('/').get(protect, admin, getOrders)`.
There is no role system beyond the binary `isAdmin` flag.

### 9.2 Error Handling

Two middleware functions in `backend/middleware/errorMiddleware.js`:

- `notFound` — creates a 404 error for any request that fell through all routes.
- `errorHandler` — terminal error handler. Returns JSON `{ message, stack }`;
  stack is suppressed in production.

```js
const errorHandler = (err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode
  res.status(statusCode)
  res.json({
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  })
}
```

Controllers signal errors by setting `res.status(4xx)` and then `throw new
Error(message)`. `express-async-handler` catches the thrown error and passes it
to `errorHandler`. This avoids try/catch boilerplate in every controller.

### 9.3 Logging

`morgan('dev')` logs `METHOD URL STATUS RESPONSE_TIME` to stdout, enabled only
in development. No structured logging, no log aggregation. Production has no
access logs.

### 9.4 CORS

No explicit CORS headers are set. In development the CRA proxy eliminates CORS
because the browser speaks to `:3000` which forwards to `:5001` server-side.
In production the frontend is served from the same origin as the API. Any
non-browser client (e.g., Postman, mobile app) would need to call the backend
directly and no CORS headers would be returned.

### 9.5 Input Validation

No dedicated validation library (no Joi, no express-validator). Validation is
implicit: Mongoose schema `required` constraints catch missing fields at the ODM
level and throw a `CastError` or `ValidationError` that propagates through
`express-async-handler` to `errorHandler`. No length limits or type coercion
guards exist beyond Mongoose's basic type casting.

---

## 10. Architectural Decisions and Technical Debt

### What Works Well

- **Uniform async pattern.** Every controller uses `asyncHandler` + throw.
  Consistent, readable, easy to extend.
- **Redux slice granularity.** One reducer per operation (create, update,
  delete, list) instead of one per entity. Prevents reducer bloat and makes
  optimistic UI state management straightforward.
- **Embedded reviews.** Eliminates a join for the most common read (product
  detail page includes reviews). Appropriate for a dataset where review counts
  per product are small.
- **localStorage hydration at boot.** Cart and auth state survive page reloads
  without a server round-trip. Simple and reliable for a demo application.
- **Price denormalisation in OrderItem.** Captures price at order time, which
  is the correct e-commerce behaviour.

### Known Technical Debt

**JWT in localStorage (ADR-0001).**
The token is readable by any JavaScript on the page. An XSS vulnerability would
allow token theft. The `proshop-v2` upstream moves to `httpOnly` cookies with
CSRF protection. This is the most significant security gap for any real
deployment.

**Mongoose 5 (ADR-0002).**
Four major versions behind current (8.x). Uses deprecated driver options
(`useUnifiedTopology`, `useNewUrlParser`, `useCreateIndex`) and the removed
`Model.remove()` API. No test suite exists to cover an upgrade.

**No server-side PayPal verification.**
`PUT /api/orders/:id/pay` trusts the client-submitted payment result without
verifying the transaction with PayPal's API. Any authenticated user can mark
any of their own orders as paid.

**Regex search, no text index.**
`getProducts` uses `$regex` with a case-insensitive option, which performs a
collection scan. For more than a few hundred products, a MongoDB text index
with `$text` would be required.

**Hardcoded business rules.**
Tax rate (15%), free shipping threshold ($100), and page size (10) are
hardcoded in-source. No configuration layer.

**No test coverage.**
Zero unit or integration tests. No test runner configured on the backend.

**Local file storage for uploads.**
`multer` writes to `uploads/` on the local filesystem. Incompatible with any
horizontally scaled or ephemeral deployment environment. A production system
would need S3-compatible object storage.

**React 16 / CRA 3 / React Router v5.**
All are either end-of-life or superseded by major versions (React 18, Vite,
React Router v6/v7). The `NODE_OPTIONS=--openssl-legacy-provider` workaround
is a symptom of the age of the toolchain.

**Deprecated project status.**
The upstream bradtraversy/proshop_mern repository itself is deprecated in
favour of `proshop-v2`, which addresses several of the above issues (httpOnly
cookies, Mongoose 8, React 18, Redux Toolkit). This codebase is suitable for
learning exercises and architecture analysis, not for production use.
