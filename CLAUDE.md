# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

ProShop — MERN-stack eCommerce app (Express + MongoDB backend, CRA-based React + Redux frontend). The repo is a single npm project at the root that orchestrates a separate frontend workspace under `frontend/`.

## Commands

Install (must be done in both root and frontend):
```
npm install
npm install --prefix frontend
```

Run dev (concurrently starts backend on :5000 and CRA dev server on :3000, which proxies `/api` to the backend via `frontend/package.json` `proxy`):
```
npm run dev          # both
npm run server       # backend only (nodemon)
npm run client       # frontend only
```

Frontend build / test (run from `frontend/`):
```
npm run build
npm test             # react-scripts test (jest, watch mode)
npm test -- --watchAll=false MyFile.test.js   # single test, non-watch
```

Backend has no test runner configured.

Database seed (requires `MONGO_URI` set — see Env below):
```
npm run data:import
npm run data:destroy
```

## Docker

`docker-compose.yaml` brings up `mongo` (Mongo 7), runs the `seeder` once (waits on mongo healthcheck), then starts `backend` (host port `5001` → container `5000`) and `frontend` (host `:3000`). The frontend Dockerfile rewrites `package.json`'s `proxy` to `http://backend:5000` at build time, so inside Docker the CRA dev server proxies to the backend service rather than `127.0.0.1:5000`.

```
docker compose up --build
```

`JWT_SECRET` and `PAYPAL_CLIENT_ID` are read from the host env (with placeholder defaults). `./backend` and `./uploads` are bind-mounted into the backend container; `./frontend/src` and `./frontend/public` into the frontend container — local edits hot-reload.

## Env

Root `.env` (see `.env.example`):
```
NODE_ENV, PORT, MONGO_URI, JWT_SECRET, PAYPAL_CLIENT_ID
```
The PayPal client ID is exposed to the frontend via the unauthenticated endpoint `GET /api/config/paypal`.

## Architecture

### Backend (`backend/`, ES modules — `"type": "module"`)
- `server.js` wires Express, connects Mongo via `config/db.js`, mounts route modules under `/api/products`, `/api/users`, `/api/orders`, `/api/upload`, serves `/uploads` statically, and in `production` also serves the built `frontend/build` for any non-API path. Errors are funnelled through `middleware/errorMiddleware.js` (`notFound`, `errorHandler`).
- Routing follows the standard `routes → controllers → models` split. Controllers wrap async handlers with `express-async-handler` and throw plain `Error` objects with `res.status(...)` set first; the error middleware turns those into JSON responses.
- Auth: `middleware/authMiddleware.js` exports `protect` (verifies `Authorization: Bearer <jwt>` and attaches `req.user`) and `admin` (requires `req.user.isAdmin`). Tokens are minted by `utils/generateToken.js` using `JWT_SECRET`.
- Mongoose models live in `models/`. `userModel` hashes passwords with bcrypt in a pre-save hook and exposes `matchPassword`. `productModel` embeds reviews; `orderModel` snapshots ordered items, shipping, and payment result.
- File uploads: `routes/uploadRoutes.js` uses `multer` with disk storage into `uploads/` and a jpg/jpeg/png filter. The route returns the saved relative path which the frontend stores on the product.

### Frontend (`frontend/src/`, CRA + React 16 + Redux + Redux Thunk)
- `store.js` is the single Redux store. It hydrates `cart.cartItems`, `cart.shippingAddress`, and `userLogin.userInfo` from `localStorage` at boot — any code that mutates those slices must keep `localStorage` in sync (the existing actions do this).
- State is split into many small reducers per use case (e.g. `productListReducer`, `productCreateReducer`, `productUpdateReducer`, etc.) rather than one big reducer per resource. Each follows the `_REQUEST / _SUCCESS / _FAIL / _RESET` action pattern with constants in `constants/`.
- Actions in `actions/` are thunks that call `axios` against the same-origin `/api/...` paths (works because of CRA's `proxy` in dev and the express static serving in prod). Authenticated requests pull the JWT from `getState().userLogin.userInfo.token` and send it as `Authorization: Bearer ...`.
- Routing is via `react-router-dom` v5 in `App.js`. Admin screens live under `/admin/...` and assume the logged-in user has `isAdmin: true`.

### Cross-cutting
- The frontend talks to the backend exclusively through `/api/*`; never hardcode `http://localhost:5000` — rely on the CRA proxy (or the Docker-rewritten proxy) so dev and prod behave the same.
- Image URLs returned from the upload endpoint start with `/uploads/...` and are served by the same Express app, so they work in both dev (via proxy) and prod (via static middleware).

## Notes / gotchas

- ES modules in backend require `.js` extensions in relative imports (`import ... from './foo.js'`); omitting the extension breaks at runtime.
- React 16 + react-scripts 3.4 + many deps are years old — `npm install` will surface peer-dep warnings; do not casually upgrade major versions as a side effect of unrelated work.
- The upstream README marks this project as deprecated in favor of `proshop-v2` (Redux Toolkit). This repo still uses classic Redux + thunks.
