# ProShop eCommerce Platform

ProShop is a full-featured eCommerce web application built with the MERN stack (MongoDB, Express, React, Node.js). It covers the complete shopping flow — browsing a product catalog, managing a cart, checking out with PayPal, and tracking orders — alongside a full admin panel for managing products, users, and orders. It is aimed at developers who want a realistic, end-to-end reference app or a working starting point for their own online store.

![screenshot](https://github.com/bradtraversy/proshop_mern/blob/master/uploads/Screen%20Shot%202020-09-29%20at%205.50.52%20PM.png)

## Features

- Full featured shopping cart
- Product reviews and ratings
- Top products carousel
- Product pagination and search
- User profile with order history
- Admin panel: product, user, and order management
- Mark orders as delivered
- Full checkout flow (shipping → payment method → place order)
- PayPal / credit card integration
- Database seeder (products and users)

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Frontend | React | 16.13.1 |
| Frontend | React Router | 5.2.0 |
| Frontend | React Bootstrap | 1.3.0 |
| Frontend | Redux + Redux Thunk | 4.0.5 / 2.3.0 |
| Frontend | Axios | 0.20.0 |
| Frontend | PayPal Button | react-paypal-button-v2 2.6.2 |
| Backend | Node.js | 14.6+ (16+ recommended) |
| Backend | Express | 4.17.1 |
| Backend | Mongoose | 5.10.6 |
| Backend | JSON Web Token | jsonwebtoken 8.5.1 |
| Backend | Multer (file uploads) | 1.4.2 |
| Backend | bcryptjs | 2.4.3 |
| Database | MongoDB | any 4.x / 5.x, or Atlas |

---

## Folder Structure

```
proshop_mern/
├── backend/
│   ├── config/
│   │   └── db.js               # Mongoose connection
│   ├── controllers/            # Business logic (products, users, orders)
│   ├── data/                   # Seed data (products.js, users.js)
│   ├── middleware/
│   │   ├── authMiddleware.js   # JWT protect + admin role check
│   │   └── errorMiddleware.js  # 404 and global error handler
│   ├── models/                 # Mongoose schemas (Product, User, Order)
│   ├── routes/                 # Express routers mounted under /api/*
│   ├── utils/
│   │   └── generateToken.js    # JWT sign helper
│   ├── seeder.js               # Import / destroy seed data
│   └── server.js               # Express entry point
├── frontend/
│   ├── public/                 # Static HTML shell + favicon
│   └── src/
│       ├── actions/            # Redux async action creators (axios calls)
│       ├── components/         # Reusable UI: Header, Footer, Rating, Loader…
│       ├── constants/          # Action type string constants
│       ├── reducers/           # Redux reducers
│       ├── screens/            # Page-level components (one per route)
│       ├── App.js              # React Router route definitions
│       └── store.js            # Redux store; rehydrates from localStorage
├── uploads/                    # Multer upload destination (served as static)
├── .env                        # Environment variables (you create this)
└── package.json                # Root: backend deps + dev scripts
```

---

## Installation and Running

### Prerequisites

- **Node.js** v14.6 or higher (v16 recommended; v17+ works — the legacy OpenSSL flag is already set in `frontend/package.json`)
- **npm** v6+
- **MongoDB** — one of:
  - [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) free tier (easiest — no local install)
  - Local install via [Homebrew](https://formulae.brew.sh/formula/mongodb-community) (`brew install mongodb-community`) or the [official installer](https://www.mongodb.com/try/download/community)

### 1. Clone the repository

```bash
git clone https://github.com/bradtraversy/proshop_mern.git
cd proshop_mern
```

### 2. Configure environment variables

Create a `.env` file in the **root** directory (same level as `package.json`):

```env
NODE_ENV=development
PORT=5000
MONGO_URI=mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/proshop?retryWrites=true&w=majority
JWT_SECRET=any_random_string_at_least_32_chars
PAYPAL_CLIENT_ID=your_paypal_sandbox_client_id
```

| Variable | Required | Description |
|---|---|---|
| `NODE_ENV` | Yes | `development` locally, `production` in prod |
| `PORT` | No | Backend port — defaults to `5000` if omitted |
| `MONGO_URI` | Yes | Full MongoDB connection URI (Atlas or local `mongodb://localhost:27017/proshop`) |
| `JWT_SECRET` | Yes | Any random string; used to sign auth tokens |
| `PAYPAL_CLIENT_ID` | Yes* | PayPal sandbox client ID from [developer.paypal.com](https://developer.paypal.com); the PayPal button won't render without it |

> **PayPal sandbox:** Sign up at developer.paypal.com → My Apps & Credentials → Create App → copy the **Client ID**. Use the sandbox buyer account to complete test checkouts. The real payment flow requires a live client ID.

### 3. Install dependencies

```bash
# Root (backend) dependencies
npm install

# Frontend dependencies
cd frontend && npm install && cd ..
```

### 4. Seed the database (optional but recommended)

```bash
npm run data:import
```

This creates sample products and three user accounts:

| Role | Email | Password |
|---|---|---|
| Admin | admin@example.com | 123456 |
| Customer | john@example.com | 123456 |
| Customer | jane@example.com | 123456 |

To wipe everything:

```bash
npm run data:destroy
```

### 5. Run in development mode

```bash
npm run dev
```

This starts both servers concurrently:
- **Backend** API on [http://localhost:5000](http://localhost:5000)
- **Frontend** React app on [http://localhost:3000](http://localhost:3000) (with proxy to backend)

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Build for Production

```bash
cd frontend && npm run build && cd ..
npm start
```

Express serves `frontend/build` as static files, so a single process handles the UI and the API.

### Deploy to Heroku

A `heroku-postbuild` script is already configured. Just push:

```bash
git push heroku main
```

Heroku will install frontend dependencies and build automatically.

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start frontend + backend concurrently (development) |
| `npm run server` | Start backend only (nodemon auto-reload) |
| `npm run client` | Start frontend only |
| `npm start` | Start backend in production mode |
| `npm run data:import` | Seed the database |
| `npm run data:destroy` | Wipe the database |
| `cd frontend && npm test` | Run frontend tests |

---

## Troubleshooting

### MongoDB connection fails on startup

```
Error: connect ECONNREFUSED 127.0.0.1:27017
```

- **Atlas:** Check that your IP is whitelisted under Network Access → Add Current IP Address.
- **Atlas:** Verify the URI is in the form `mongodb+srv://user:pass@cluster.../proshop`. The database name at the end (`/proshop`) is required; Atlas won't create it automatically but Mongoose will on first write.
- **Local:** Make sure `mongod` is running (`brew services start mongodb-community` on macOS).
- Double-check there are no quotes around the value in `.env` — `MONGO_URI="..."` vs `MONGO_URI=...`. `dotenv` includes the quotes literally if you add them.

### API requests return HTML instead of JSON (404 on `/api/*`)

The frontend proxies API calls to `http://127.0.0.1:5000` via the `proxy` field in `frontend/package.json`. This only works when you start the frontend with `react-scripts start` (i.e., `npm run dev` or `npm run client`). If you open `localhost:3000` while only the backend is running, or build for production without the correct setup, the proxy won't apply and API calls will 404.

### CORS errors in the browser console

There is no CORS middleware in this project by design — the dev proxy eliminates the need for it. If you see CORS errors:
- Make sure you're using `npm run dev` (not just the backend alone).
- Do not call `localhost:5000` directly from the browser — all API calls should go through `localhost:3000` so the proxy can forward them.
- If you need to call the backend from a different origin (e.g., a mobile app), add `cors` middleware to `backend/server.js`.

### PayPal button does not appear on the order page

- `PAYPAL_CLIENT_ID` must be set in `.env` before starting the server. The backend exposes it at `/api/config/paypal`; the frontend fetches it at runtime.
- Use a **sandbox** client ID for local development (not a live one). Create one at [developer.paypal.com](https://developer.paypal.com) → My Apps & Credentials → Sandbox.
- To complete a test payment, log in with the **sandbox buyer account** (auto-created alongside your sandbox app), not your real PayPal account.

### `react-scripts start` crashes with `ERR_OSSL_EVP_UNSUPPORTED`

This happens on Node.js 17+ due to a breaking OpenSSL change. The fix (`NODE_OPTIONS=--openssl-legacy-provider`) is already set in `frontend/package.json` scripts, so it should work automatically. If it still fails, verify you are running `npm run client` or `npm run dev` (which call the patched scripts) rather than calling `react-scripts start` directly.

### Port already in use

```
Error: listen EADDRINUSE: address already in use :::5000
```

Kill the process on that port:

```bash
# macOS / Linux
lsof -ti :5000 | xargs kill -9

# Or find and kill port 3000 for the frontend
lsof -ti :3000 | xargs kill -9
```

### Image upload returns 404 for `/uploads/*`

The `uploads/` directory in the project root is served as a static path by Express. If you cloned the repo fresh, the directory may be empty but must exist. Running `npm run data:import` seeds product images from `frontend/public/images`, not from `uploads/`, so this only affects images you upload through the admin panel. Make sure the `uploads/` directory exists at the repo root.

---

## License

MIT — Copyright (c) 2020 Traversy Media https://traversymedia.com
