> **TODO(audit-2026-05-29):** Routes / access rules / Redux slices / API calls remain accurate. The 'What Users See' / Components sections describe the old Bootstrap layout — verify against frontend/src/components/good-shop.
>
> _Marker added during M6 Stage 3 living-docs audit. Behavioural content below verified accurate; only the noted parts are stale._

# Home Screen

## Route
`/` (root), `/search/:keyword`, `/page/:pageNumber`, `/search/:keyword/page/:pageNumber`

## Access
Public (no authentication required)

## What Users See
The home page displays a paginated grid of products available in the store. At the top, a product carousel showcases featured items (only shown when not searching). The page includes a heading "Latest Products" and a responsive grid layout that adjusts from 1 column on mobile to 4 columns on extra-large screens.

When a search is active, a "Go Back" button appears above the product list to allow users to return to browsing all products. Pagination controls appear at the bottom when there are multiple pages of results.

## State (Redux)
- `productList` slice: `loading`, `error`, `products` array, `page` (current), `pages` (total)

## API Calls
- **On mount/param change**: `GET /api/products?keyword=[keyword]&pageNumber=[pageNumber]` via `listProducts()` action
- Returns paginated product data

## Components
- **ProductCarousel** – featured products carousel (shown only on homepage, not search results)
- **Product** – reusable product card component (name, image, rating, price)
- **Message** – error message display
- **Loader** – loading spinner
- **Paginate** – pagination controls for page navigation

## User Actions
- **Click product card**: Navigate to product details page
- **Click "Go Back"**: Return to home from search
- **Click page number**: Navigate to specific page of results
- **Search**: Triggered from Header, navigates to `/search/:keyword`

## Edge Cases
- Empty search results: Still shows grid layout with no products
- Loading state: Displays spinner, replaces product grid
- API error: Shows red error message, disables pagination
- Missing keyword parameter: Defaults to showing all products
- Page number out of bounds: API returns empty array gracefully
