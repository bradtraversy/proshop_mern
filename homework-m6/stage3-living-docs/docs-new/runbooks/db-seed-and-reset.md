# Database Seed and Reset Runbook

**Purpose:** Manage database state through seeding sample data, resetting production data safely, and performing backups.  
**Audience:** Developers, QA, database administrators.  
**Duration:** 5–30 minutes depending on operation.  
**Scope:** Covers local development and production scenarios.

## Overview

### Seed Operations Available

| Command | Purpose | Safety |
|---------|---------|--------|
| `npm run data:import` | Load sample users, products, empty orders (seed) | **Safe** — idempotent, designed for dev/test |
| `npm run data:destroy` | Wipe all users, products, orders | **Dangerous** — irreversible in production |
| `npm run data:import-extra` | Load additional test fixtures | **Safe** — additive only |

### Database Schema

Seed data includes:
- **Users:** 1 admin user (email: `admin@example.com`) + 2 customer users.
- **Products:** 8–10 sample products (laptops, phones, monitors, etc.) with prices, images, categories.
- **Orders:** Empty (created on demand during testing).

## Local Development Workflows

### Workflow 1: Fresh Start (After Clone or Git Checkout)

Bring codebase to known-good state:

```bash
# 1. Ensure MongoDB is running
npm run mongo:up

# 2. Wait 3 seconds for container startup
sleep 3

# 3. Verify connection
docker ps | grep mongo  # Should show proshop-mongo container

# 4. Seed database
npm run data:import

# 5. Expected output:
# Data Imported!
# (Process will exit with code 0)
```

Verify seed succeeded:

```bash
# Query MongoDB directly
docker exec proshop-mongo mongosh proshop --eval \
  "db.users.countDocuments()" 

# Expected: 3 (admin + 2 customers)

docker exec proshop-mongo mongosh proshop --eval \
  "db.products.countDocuments()"

# Expected: ~10
```

### Workflow 2: Reset Between Test Runs

You created test data and want to start fresh:

```bash
# Destroy all data
npm run data:destroy

# Wait 2 seconds
sleep 2

# Reimport seed
npm run data:import

# Restart app (if already running)
# Ctrl+C, then npm run dev
```

## Production Scenarios (High Risk)

### ⚠️ WARNING: Production Destruction

**DO NOT RUN `npm run data:destroy` IN PRODUCTION without explicit approval and a backup.**

Production data is real. Accidental loss = revenue loss, customer trust damage, legal issues.

### Pre-Production-Reset Checklist

Before any production reset:

- [ ] **Database backup taken** (see Backup Procedure below).
- [ ] **Backup verified restorable** (test restore to staging).
- [ ] **Stakeholder approval obtained** (manager, product lead).
- [ ] **Customer notification sent** (if major data wipe, e.g., all orders).
- [ ] **Maintenance window scheduled** (inform support team).
- [ ] **Rollback plan documented** (how to restore from backup if things go wrong).
- [ ] **Post-reset verification plan** (sanity checks to run after restore).

## Backup Procedures

### Full Database Backup (MongoDB)

#### Option 1: Using mongodump (Recommended)

```bash
# Backup MongoDB to local directory
mongodump --uri "mongodb+srv://<user>:<password>@<cluster>/proshop" \
          --out ./backup_$(date +%Y%m%d_%H%M%S)

# Output: 
# backup_20240415_142030/
#   proshop/
#     users.bson
#     products.bson
#     orders.bson
#     ... (metadata files)
```

**To restore from backup:**

```bash
mongorestore --uri "mongodb+srv://<user>:<password>@<cluster>/proshop" \
             ./backup_20240415_142030/proshop
```

#### Option 2: Using MongoDB Atlas GUI

1. Log in to MongoDB Atlas dashboard.
2. Click "Database" → select your cluster → "Backup" tab.
3. Click "Take On-Demand Snapshot" → wait 5–10 minutes.
4. Once complete, click the snapshot → "Restore" → choose target (same cluster or new).

**Advantage:** No local storage required, managed by MongoDB.  
**Disadvantage:** Slower, requires GUI access.

#### Option 3: Export Collections as JSON

```bash
# Export users collection
mongoexport --uri "mongodb+srv://<user>:<password>@<cluster>/proshop" \
            --collection users \
            --out users_backup.json

# Export products collection
mongoexport --uri "mongodb+srv://<user>:<password>@<cluster>/proshop" \
            --collection products \
            --out products_backup.json

# Export orders collection
mongoexport --uri "mongodb+srv://<user>:<password>@<cluster>/proshop" \
            --collection orders \
            --out orders_backup.json
```

**To restore:**

```bash
mongoimport --uri "mongodb+srv://<user>:<password>@<cluster>/proshop" \
            --collection users \
            --file users_backup.json
```

## Seed Data Details

### Admin User (Auto-Created)

```javascript
{
  name: "Admin User",
  email: "admin@example.com",
  password: "123456",        // Hashed via bcrypt in seeder
  isAdmin: true,
  createdAt: "2024-04-15T...",
  updatedAt: "2024-04-15T..."
}
```

Login credentials for testing checkout flows with admin privileges.

### Sample Products

Example seeded products:

```javascript
[
  {
    name: "Airpods Wireless Bluetooth Headphones",
    image: "/images/airpods.jpg",
    description: "Bluetooth wireless headphones",
    brand: "Apple",
    category: "Electronics",
    price: 89.99,
    countInStock: 10,
    rating: 4.5,
    numReviews: 12,
    user: "<admin-user-id>"
  },
  {
    name: "iPhone 15 Pro Max",
    image: "/images/iphone15.jpg",
    description: "Latest Apple smartphone",
    brand: "Apple",
    category: "Electronics",
    price: 1199.99,
    countInStock: 5,
    rating: 4.8,
    numReviews: 45,
    user: "<admin-user-id>"
  }
  // ... 8–10 more products
]
```

To view seeded products:

```bash
curl http://localhost:5001/api/products | jq '.[] | {name, price, brand}'
```

### Customer Test Users

```javascript
{
  name: "John Doe",
  email: "john@example.com",
  password: "123456",
  isAdmin: false
},
{
  name: "Jane Smith",
  email: "jane@example.com",
  password: "123456",
  isAdmin: false
}
```

Use these to test customer checkout flows without admin privileges.

## Seeding Custom Data

If you want to seed custom test data (e.g., 100 products, specific categories):

### Step 1: Create Seed File

```javascript
// backend/seedCustom.js
import mongoose from 'mongoose'
import dotenv from 'dotenv'
import colors from 'colors'
import User from './models/userModel.js'
import Product from './models/productModel.js'
import connectDB from './config/db.js'

dotenv.config()
connectDB()

const customProducts = [
  {
    name: "Custom Product 1",
    brand: "TestBrand",
    category: "TestCategory",
    description: "A custom test product",
    price: 99.99,
    countInStock: 20,
    rating: 0,
    numReviews: 0,
  },
  // ... more products
]

const importCustomData = async () => {
  try {
    const adminUser = await User.findOne({ email: 'admin@example.com' })
    
    const productsWithUser = customProducts.map(p => ({
      ...p,
      user: adminUser._id
    }))

    await Product.insertMany(productsWithUser)
    console.log(`Imported ${productsWithUser.length} custom products`.green.inverse)
    process.exit()
  } catch (error) {
    console.error(`${error}`.red.inverse)
    process.exit(1)
  }
}

importCustomData()
```

### Step 2: Add NPM Script

Edit `package.json`:

```json
{
  "scripts": {
    "data:import-custom": "node backend/seedCustom.js"
  }
}
```

### Step 3: Run Custom Seed

```bash
npm run data:import-custom
```

## Seeding with Production-Like Data

For staging/performance testing, you might want realistic data volumes:

```javascript
// backend/seedLarge.js
// Generate 1000 products with varied attributes

const generateLargeDataset = async (productCount = 1000) => {
  const products = []
  const categories = ['Electronics', 'Books', 'Clothing', 'Sports', 'Home']
  const brands = ['Brand A', 'Brand B', 'Brand C', 'Brand D']

  for (let i = 1; i <= productCount; i++) {
    products.push({
      name: `Product ${i}`,
      brand: brands[i % brands.length],
      category: categories[i % categories.length],
      description: `Description for product ${i}`,
      price: Math.random() * 500 + 10,  // Random price $10–$510
      countInStock: Math.floor(Math.random() * 100),
      rating: Math.random() * 5,
      numReviews: Math.floor(Math.random() * 50),
    })
  }

  const adminUser = await User.findOne({ email: 'admin@example.com' })
  const productsWithUser = products.map(p => ({ ...p, user: adminUser._id }))

  await Product.insertMany(productsWithUser)
  console.log(`Created ${productCount} products for load testing`.green.inverse)
  process.exit()
}

generateLargeDataset(1000)
```

## Monitoring Database Health

### Check Database Size

```bash
# Connect to MongoDB and check database size
docker exec proshop-mongo mongosh proshop --eval \
  "db.stats()" | grep dataSize

# Output shows size in bytes
```

### View Collection Counts

```bash
docker exec proshop-mongo mongosh proshop --eval \
  "print('Users:', db.users.countDocuments()); \
   print('Products:', db.products.countDocuments()); \
   print('Orders:', db.orders.countDocuments())"
```

### Find Orphaned Data

Orders without a valid user reference (data integrity check):

```bash
docker exec proshop-mongo mongosh proshop --eval \
  "db.orders.aggregate([ \
     { \$lookup: { from: 'users', localField: 'user', foreignField: '_id', as: 'user_data' } }, \
     { \$match: { user_data: { \$eq: [] } } }, \
     { \$project: { _id: 1, createdAt: 1 } } \
   ])"
```

If found, these are orphaned orders (user deleted but order remains). You may want to remove them:

```bash
docker exec proshop-mongo mongosh proshop --eval \
  "db.orders.deleteMany({ user: null })"
```

## Troubleshooting

### Issue: `npm run data:import` hangs or times out

**Cause:** MongoDB not running or network unreachable.

**Fix:**
```bash
npm run mongo:down
sleep 2
npm run mongo:up
sleep 3
npm run data:import
```

### Issue: `Seed succeeded but no products in UI`

**Cause:** Frontend cached old data.

**Fix:**
1. Hard-refresh browser: `Cmd+Shift+R` (macOS) or `Ctrl+Shift+R` (Windows).
2. Clear Redux state (if using Redux DevTools, dispatch reset action).
3. Check backend logs: `heroku logs --tail` (if production) or terminal (if local).

### Issue: Production data restore failed

**Worst case:** You restored from an incorrect backup or restore failed midway.

**Recovery:**
1. Stop all application traffic (maintenance mode).
2. Take another backup (of the broken state) for post-mortem analysis.
3. Restore from a known-good earlier backup.
4. Verify data integrity (check counts, sample documents).
5. Bring app back online.

---

**Last updated:** M3 curriculum.  
**Critical:** Always test backup restoration in staging before relying on backups for production recovery.
