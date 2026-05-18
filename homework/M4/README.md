# M4 — ProShop MERN Redesign: Tailwind CSS v4 + shadcn/ui

## Tools Used

| Category | Technology | Version |
|----------|-----------|---------|
| Build tool | Vite | 6.x |
| CSS framework | Tailwind CSS | 4.x |
| Component library | shadcn/ui (ported) | custom |
| Icons | Lucide React | ^0.468 |
| Design tokens | CSS `@theme` (Tailwind v4) | — |
| Docker | node:18 + @tailwindcss/oxide-linux-x64-gnu | 4.3.0 |

## Redesigned Pages

| # | Page | Route | File | Visibility | Done |
|---|------|-------|------|------------|:----:|
| 1 | Home / Search results | `/`, `/search/:keyword`, `/page/:n` | HomeScreen.jsx | public | ✅ |
| 2 | Product details | `/product/:id` | ProductScreen.jsx | public | ✅ |
| 3 | Cart | `/cart/:id?` | CartScreen.jsx | public | ✅ |
| 4 | Login | `/login` | LoginScreen.jsx | public | ✅ |
| 5 | Register | `/register` | RegisterScreen.jsx | public | ✅ |
| 6 | Profile | `/profile` | ProfileScreen.jsx | auth | ✅ |
| 7 | Shipping | `/shipping` | ShippingScreen.jsx | auth | ✅ |
| 8 | Payment | `/payment` | PaymentScreen.jsx | auth | ✅ |
| 9 | Place Order | `/placeorder` | PlaceOrderScreen.jsx | auth | ✅ |
| 10 | Order details | `/order/:id` | OrderScreen.jsx | auth | ✅ |
| 11 | Admin: Users list | `/admin/userlist` | UserListScreen.jsx | admin | ✅ |
| 12 | Admin: User edit | `/admin/user/:id/edit` | UserEditScreen.jsx | admin | ✅ |
| 13 | Admin: Products list | `/admin/productlist` | ProductListScreen.jsx | admin | ✅ |
| 14 | Admin: Product edit | `/admin/product/:id/edit` | ProductEditScreen.jsx | admin | ✅ |
| 15 | Admin: Orders list | `/admin/orderlist` | OrderListScreen.jsx | admin | ✅ |
| 16 | Feature Dashboard | `/admin/featuredashboard` | FeatureDashboardScreen.jsx | admin | ✅ |

**Total: 16/16 pages redesigned.**

## Component Decisions

### shadcn/ui — used as-is (ported)

Components in `frontend/src/components/ui/`:

| Component | File | Usage |
|-----------|------|-------|
| Button | `button.jsx` | All forms, actions, navigation |
| Card | `card.jsx` | Product cards, order summaries, form containers |
| Table | `table.jsx` | Admin lists (users, products, orders, features) |
| Badge | `badge.jsx` | Order statuses, feature flag states |
| Alert | `alert.jsx` | Error/info messages (replaces react-bootstrap Alert) |
| Input | `input.jsx` | All text form fields |
| Select | `select.jsx` | Dropdowns (quantity, categories) |
| Slider | `slider.jsx` | Traffic percentage in Feature Dashboard |
| Label | `label.jsx` | Form field labels |
| Separator | `separator.jsx` | Visual section dividers |
| Skeleton | `skeleton.jsx` | Loading states (replaces Loader in tables) |

### Custom components (written from scratch with Tailwind)

| Component | File | Purpose |
|-----------|------|---------|
| Header | `Header.jsx` | Navigation, dropdown menu, responsive layout |
| Footer | `Footer.jsx` | Site footer |
| Loader | `Loader.jsx` | Loading spinner (Tailwind animation) |
| Message | `Message.jsx` | Toast/alert wrapper with variants |
| Rating | `Rating.jsx` | Star rating display (Lucide icons) |
| Product | `Product.jsx` | Product card (Card + Rating) |
| ProductCarousel | `ProductCarousel.jsx` | Top-rated products carousel |
| Paginate | `Paginate.jsx` | Pagination (custom Tailwind) |
| SearchBox | `SearchBox.jsx` | Search input in Header |
| CheckoutSteps | `CheckoutSteps.jsx` | Checkout breadcrumb steps |
| FormContainer | `FormContainer.jsx` | Centered form wrapper |
| Meta | `Meta.jsx` | React Helmet for SEO |

### Off-the-shelf vs custom — decision rationale

- **shadcn/ui** — used for base UI primitives (buttons, inputs, tables, cards) where consistency and built-in accessibility matter most.
- **Custom** — used for domain-specific components (Rating, Product, CheckoutSteps) and layout components (Header, Footer) that have no shadcn equivalent and are tightly coupled to ProShop's business logic.

## Architectural Decisions

1. **Tailwind v4 `@theme`** instead of `tailwind.config.js` — all design tokens (colors, radii, fonts) declared via CSS `@theme` in `index.css`.
2. **No react-bootstrap** — fully removed. All components rewritten with Tailwind utility classes.
3. **Vite instead of CRA** — HMR, ESM-native, fast builds.
4. **Docker fix** — explicit install of `@tailwindcss/oxide-linux-x64-gnu@4.3.0` to work around npm bug #4828 with optional dependencies.
