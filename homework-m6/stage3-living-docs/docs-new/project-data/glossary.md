> **TODO(audit-2026-05-29):** Missing newer terms: feature flag, pgvector, RAG, MCP, shadcn/Tailwind v4. Add them.
>
> _Marker added during M6 Stage 3 living-docs audit. Behavioural content below verified accurate; only the noted parts are stale._

# ProShop MERN E-Commerce Glossary

**Purpose:** Define key domain, technical, operational, and business terms used in the proshop-mern project.  
**Scope:** All domains covered by M3 curriculum.  
**Update frequency:** As new features are added.

---

## Domain Terms (E-Commerce Concepts)

### Customer
A user registered in the system who can browse products, add items to cart, and place orders. Customers have authentication credentials (email/password) and order history. Related: User, Account.

**In proshop:** Stored in MongoDB `users` collection with `isAdmin: false`. Example: john@example.com.

---

### Product
A physical or digital good offered for sale, with a unique price, description, inventory count, and reviews. Products are created and managed by admin users. A product always has a category, brand, and in-stock count.

**In proshop:** `Product` model with fields: `name`, `price`, `countInStock`, `category`, `brand`, `description`, `reviews[]`, `rating`, `numReviews`. Accessible via `/api/products` endpoint.

**Example:**
```json
{
  "_id": "60d5ec49c1234567890abcde",
  "name": "iPhone 15 Pro",
  "price": 999.99,
  "countInStock": 15,
  "category": "Electronics",
  "brand": "Apple",
  "rating": 4.8,
  "numReviews": 42
}
```

---

### Order
A confirmed purchase by a customer containing one or more order items, shipping address, payment method, and totals (tax, shipping, total). Orders track payment status (`isPaid`, `paidAt`) and delivery status (`isDelivered`, `deliveredAt`).

**In proshop:** `Order` model with `user` reference, `orderItems[]`, `shippingAddress`, `paymentMethod`, `totalPrice`, `isPaid`, `isDelivered`. Once an order is placed, inventory is decremented (if implemented).

**Lifecycle:** Created → Awaiting payment → Paid → Shipped → Delivered.

---

### Order Item
A single line-item in an order, representing one product with a quantity, price at time of purchase, and product reference. Order items are immutable snapshots—if product price changes later, the order item keeps the original price.

**In proshop:** Embedded in `Order.orderItems[]` with fields: `product` (ObjectId ref), `name`, `qty`, `price`, `image`.

**Example:**
```json
{
  "product": "60d5ec49c1234567890abcde",
  "name": "iPhone 15 Pro",
  "qty": 2,
  "price": 999.99,
  "image": "/images/iphone15.jpg"
}
```

---

### Cart
Temporary collection of products selected by a customer but not yet ordered. Carts exist client-side (Redux state) and are not persisted to database in proshop v1. When checkout completes, cart items become order items.

**In proshop:** Managed in Redux (`frontend/src/slices/cartSlice.js`). Has `cartItems[]`, `itemsPrice`, `shippingPrice`, `taxPrice`, `totalPrice`.

---

### Checkout
Multi-step process where customers provide shipping address, payment method, and review before finalizing an order. Typically 2–4 steps depending on design (e.g., Address → Payment → Review → Confirm).

**In proshop:** Implemented as multi-screen flow in `frontend/src/screens/CheckoutScreen.jsx` (or similar). Backend validates order via `/api/orders` POST endpoint.

---

### Review
User-submitted feedback on a product, containing a rating (1–5 stars), comment text, and author (customer). Reviews influence product's aggregate `rating` and `numReviews` count.

**In proshop:** Embedded in `Product.reviews[]` with fields: `rating`, `comment`, `user` (ObjectId ref), `name`, `createdAt`. Submitted via `POST /api/products/:id/reviews`.

---

### Rating
Numeric score (0–5 stars) aggregating all reviews for a product. Calculated as mean of all individual review ratings. Updated when a review is added.

**In proshop:** Stored on product as `rating` (float) and `numReviews` (count). Both updated when new review is created.

---

### Wishlist (Optional)
Personal list of products a customer wants to purchase later. Not fully implemented in base proshop but could be added as a feature.

**Related term:** Bookmark, Save for later.

---

## Technical Terms (Implementation Details)

### JWT (JSON Web Token)
Stateless authentication token containing encoded user info (ID, role, email). Sent in request headers for authorization. Server verifies token signature to ensure authenticity.

**In proshop:** Issued on login (`POST /api/users/login`). Token contains `userId` and `isAdmin`. Verified by `protect` middleware. Example header: `Authorization: Bearer eyJhbGc...`

**Security note:** Never expose `JWT_SECRET` in code. Rotate for production.

---

### bcrypt
Cryptographic library for hashing passwords. Bcrypt is slow-by-design, making brute-force attacks infeasible. Passwords are hashed with salt; two identical passwords produce different hashes.

**In proshop:** Used in `User` model's `pre('save')` hook. Plain-text password → bcrypt.hash() → stored hash. Login verifies via `matchPassword()` method.

**Example:**
```javascript
// Register: password "123456" becomes "$2a$10$..."
userSchema.pre('save', async function (next) {
  const salt = await bcrypt.genSalt(10)
  this.password = await bcrypt.hash(this.password, salt)
})

// Login: compare entered password with stored hash
const isMatch = await user.matchPassword(enteredPassword)
```

---

### Mongoose
Object-Document Mapper (ODM) for MongoDB in Node.js. Provides schema validation, type coercion, and middleware hooks. Makes MongoDB queries more structured and less error-prone.

**In proshop:** Models defined as `userSchema`, `productSchema`, `orderSchema`. Each schema maps to a MongoDB collection. `Model.findById()`, `Model.save()`, `Model.deleteMany()` are ORM methods.

**Example:**
```javascript
// Define schema
const userSchema = new mongoose.Schema({ email: String, password: String })
// Create model
const User = mongoose.model('User', userSchema)
// Query
const user = await User.findById(userId)
```

---

### Express Middleware
Function that intercepts HTTP requests/responses. Middleware can log, authenticate, validate, or transform data before passing to next handler.

**In proshop:** Examples: `protect` (JWT verification), `admin` (role check), `errorHandler` (catch errors).

**Example:**
```javascript
export const protect = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) return res.status(401).json({ error: 'No token' })
  const decoded = jwt.verify(token, process.env.JWT_SECRET)
  req.user = await User.findById(decoded.id)
  next()
}
```

---

### REST Endpoint
HTTP endpoint following REST conventions: `GET /api/products` (list), `POST /api/products` (create), `PUT /api/products/:id` (update), `DELETE /api/products/:id` (delete).

**In proshop:** All routes follow REST:
- `GET /api/products` → list all products.
- `GET /api/products/:id` → get one product.
- `POST /api/orders` → create order.
- `PUT /api/orders/:id/pay` → mark order as paid.

---

### ObjectId
MongoDB's native unique identifier format (12-byte hex string like `"60d5ec49c1234567890abcde"`). Used as primary key for every document.

**In proshop:** Every document has `_id` field (ObjectId). Foreign keys use ObjectId refs. Example: `Order.user` = ObjectId of the customer.

---

### Virtual Field
Mongoose computed field not stored in database. Calculated on-the-fly from other fields. Useful for derived data.

**In proshop:** Could add virtual like `product.totalReviewScore = reviews.length * avgRating` (not stored, computed when accessed).

---

### Populate (Reference Resolution)
Mongoose method to replace a reference (ObjectId) with the actual document. Called `populate()` on queries.

**In proshop:** When fetching an order, `populate('user')` replaces the user ObjectId with the full user document.

**Example:**
```javascript
// Without populate: order.user = "60d5ec49..."
// With populate: order.user = { _id: "60d5ec49...", name: "John", email: "john@example.com" }
const order = await Order.findById(orderId).populate('user').populate('orderItems.product')
```

---

### Async Handler
Wrapper for async route handlers that catches errors and passes to error middleware. Prevents unhandled promise rejections.

**In proshop:** Imported as `express-async-handler`. Wraps controllers:
```javascript
import asyncHandler from 'express-async-handler'

router.get('/', asyncHandler(async (req, res) => {
  const products = await Product.find()
  res.json(products)
}))
```

---

## Operations & Deployment Terms

### Feature Flag
Boolean or percentage-based toggle that enables/disables code path without redeployment. Used for canary deployments, A/B testing, and emergency kill switches.

**In proshop:** Example flag `new_search_filter` with `enabled: true/false` and optional `rolloutPercentage: 0–100`. Checked at runtime in controller:
```javascript
if (featureFlags.new_search_filter?.enabled) {
  // new code path
} else {
  // old code path
}
```

**Use case:** Safely roll out checkout redesign to 5% of users, monitor, expand to 100%.

---

### Canary Deployment
Gradual rollout of new code to subset of users (5% → 25% → 50% → 100%) to catch bugs early without affecting all users.

**In proshop:** Implemented via feature flag's `rolloutPercentage`. Start at 5% for 1–2 hours, watch metrics, expand if stable.

---

### Rollback
Revert to previous code version (git revert or Heroku release rollback). Fastest way to stop a broken deploy from harming users.

**In proshop:** `heroku releases:rollback v20` reverts to release 20 in <1 minute. No code change needed.

**When to use:** Incident detected within 5 minutes of deploy.

---

### Blue-Green Deployment
Strategy where two identical production environments (blue=current, green=new) run in parallel. Switch traffic from blue to green once green is verified. Allows instant rollback.

**In proshop:** Not currently implemented (Heroku doesn't natively support blue-green). Could be added with load balancer + multiple dynos.

---

### Health Check
Simple endpoint or query to verify service is running and responsive. Used for monitoring and automated restarts.

**In proshop:** Could implement `GET /api/health` returning `{ status: "OK", uptime: 3600 }`. Monitored every 30 seconds.

---

### Dead Letter Queue (DLQ)
Message queue for failed/unprocessable messages. Prevents infinite retries of bad data and preserves data for analysis.

**In proshop:** Not currently used. If emails fail, they could go to DLQ instead of being retried infinitely.

**Concept:** Order confirmation email fails → message moved to DLQ → manual review later.

---

### SLA (Service Level Agreement)
Commitment to uptime/performance. Example: "99.9% uptime" = max 43 minutes downtime/month.

**In proshop:** Hypothetical SLA: 99% uptime, P95 latency < 1 second, checkout success rate > 99.5%.

---

### SLO (Service Level Objective)
Internal target stricter than SLA. Example: SLA is 99% uptime; SLO is 99.5% (buffer for incidents).

**In proshop:** SLO: 99.5% uptime, P99 latency < 2 seconds (more aggressive than SLA to catch issues early).

---

### P95 Latency
Response time where 95% of requests complete faster. Measures typical user experience (ignores slow outliers).

**In proshop:** "P95 latency is 800ms" = 95% of requests complete in <800ms, 5% take longer. If P95 suddenly spikes to 5000ms, incident likely.

---

## Business & Metrics Terms

### AOV (Average Order Value)
Total revenue divided by number of orders. Indicator of purchase size and monetization.

**In proshop:** If 1000 orders totaled $45,000, AOV = $45. Goal: increase AOV through upsells, bundles, etc.

**Formula:** `AOV = Total Revenue / Total Orders`

---

### GMV (Gross Merchandise Value)
Total value of orders placed (before refunds, cancellations). Gross measure of platform activity.

**In proshop:** If 1000 orders placed with AOV $45, GMV = $45,000. Higher GMV = healthier business.

**Formula:** `GMV = Number of Orders × Average Order Value`

---

### Conversion Rate
Percentage of visitors who complete a purchase. Critical metric for e-commerce health.

**In proshop:** If 10,000 users visit, 300 place orders, conversion rate = 3%. Industry avg: 1–3%.

**Formula:** `Conversion Rate = Orders / Visitors × 100%`

---

### Cart Abandonment Rate
Percentage of shopping carts created but not converted to orders. Indicates friction in checkout.

**In proshop:** If 5000 carts created but only 1500 complete checkout, abandonment = 70%. High abandonment suggests checkout is too complex or too many payment options failing.

**Formula:** `Cart Abandonment = (Carts Created - Orders Completed) / Carts Created × 100%`

---

### Repeat Purchase Rate
Percentage of customers who buy more than once. Indicator of customer satisfaction and retention.

**In proshop:** If 1000 customers exist and 200 placed 2+ orders, repeat rate = 20%. Goal: >30% indicates healthy business.

**Formula:** `Repeat Rate = Repeat Customers / Total Customers × 100%`

---

### NPS (Net Promoter Score)
Survey metric measuring customer loyalty. Customers rate "likelihood to recommend" 0–10. Detractors (0–6) subtract from Promoters (9–10).

**In proshop:** Could add post-checkout survey. Example: 50% Promoters, 10% Detractors = NPS = 40. Target: >50 is healthy.

**Formula:** `NPS = % Promoters - % Detractors`

---

### Churn Rate
Percentage of customers who stop using service in a period. Opposite of retention.

**In proshop:** If 1000 active customers last month, 50 never return, churn = 5%. High churn = problem with product/service.

**Formula:** `Churn = Lost Customers / Starting Customers × 100%`

---

## Cross-Cutting Reference

### Environment Variables
Configuration passed at runtime (not hardcoded). Examples: `NODE_ENV`, `MONGO_URI`, `JWT_SECRET`, `PAYPAL_CLIENT_ID`.

**In proshop:** Stored in `.env` (local) or Heroku config vars (production). Always `.env` is gitignored for security.

---

### Node.js
JavaScript runtime for server-side code. Allows JavaScript to run outside browser. Event-driven, non-blocking I/O.

**In proshop:** Backend runs on Node.js v14+. `npm start` launches Node.js process running `backend/server.js`.

---

### npm (Node Package Manager)
JavaScript package manager. `npm install` pulls dependencies from registry. `package.json` lists all dependencies.

**In proshop:** `npm install` downloads 50+ packages (express, mongoose, bcryptjs, etc.).

---

### Docker
Containerization platform. `docker compose up` starts containers (MongoDB) without installing MongoDB locally.

**In proshop:** `npm run mongo:up` = `docker compose up -d mongo` = starts MongoDB in isolated container. Same image everywhere (dev, staging, prod).

---

### Heroku
Platform-as-a-Service (PaaS) for hosting Node.js/Python/Go apps. Handles deployment, scaling, and infrastructure.

**In proshop:** `git push heroku main` deploys code. Heroku builds Docker image, runs `npm install`, executes `heroku-postbuild` script, starts dyno.

---

### Idempotent
Operation that produces same result if run multiple times. Safe to retry.

**In proshop:** `npm run data:import` is idempotent—running twice is safe (seed script deletes then recreates data). Non-idempotent: `POST /api/orders` without check—running twice creates 2 orders.

---

### Atomicity
Database guarantee that operation completes fully or not at all. No partial updates.

**In proshop:** If order creation involves: 1) create order, 2) decrement inventory, 3) charge payment, all three must succeed or all rollback. MongoDB transactions ensure atomicity.

---

## Useful Links

- **Mongoose docs:** https://mongoosejs.com/
- **Express docs:** https://expressjs.com/
- **JWT intro:** https://jwt.io/introduction
- **bcrypt guide:** https://auth0.com/blog/hashing-in-action-understanding-bcrypt/
- **MongoDB docs:** https://docs.mongodb.com/
- **Heroku deployment:** https://devcenter.heroku.com/articles/getting-started-with-nodejs

---

**Last updated:** M3 curriculum.  
**Maintainers:** Course instructors.  
**Contributing:** When adding features, update this glossary with new terms and definitions.
