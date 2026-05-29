> **TODO(audit-2026-05-29):** Routes / access rules / Redux slices / API calls remain accurate. The 'What Users See' / Components sections describe the old Bootstrap layout — verify against frontend/src/components/good-shop.
>
> _Marker added during M6 Stage 3 living-docs audit. Behavioural content below verified accurate; only the noted parts are stale._

# Product Detail Screen

## Route
`/product/:id`

## Access
Public (no authentication required)

## What Users See
A detailed product page showing a large product image on the left, product metadata (name, rating, description, price) in the center, and a purchase card on the right with pricing summary and "Add To Cart" button.

Below the purchase section, a reviews area displays existing customer reviews and provides an authenticated user with a form to submit a new review (rating 1-5 and comment). Non-authenticated users see a message prompting them to sign in to write a review.

## State (Redux)
- `productDetails` slice: `loading`, `error`, `product` object
- `userLogin` slice: `userInfo` (user credentials, if logged in)
- `productReviewCreate` slice: `loading`, `success`, `error` for review submission

## API Calls
- **On mount/product ID change**: `GET /api/products/:id` via `listProductDetails()` action
- **On review submit**: `POST /api/products/:id/reviews` with `{ rating, comment }` via `createProductReview()` action

## Components
- **Rating** – displays star rating and review count
- **Message** – error or success notifications
- **Loader** – loading spinner during data fetch
- **Meta** – sets document title to product name for SEO
- **Form** (Bootstrap) – review submission form with rating dropdown and comment textarea

## User Actions
- **Select quantity**: Dropdown to choose quantity (1 to countInStock)
- **Click "Add To Cart"**: Navigates to `/cart/:id?qty=[quantity]`
- **Submit review** (if logged in): Dispatches review creation action; form clears on success
- **Click "Go Back"**: Returns to previous page or home
- **Click product image**: No action (image is static)

## Edge Cases
- Out of stock: "Add To Cart" button is disabled, status shows "Out Of Stock"
- No reviews: Shows "No Reviews" message
- Loading review submission: Button is disabled, loader appears
- Review submission error: Error message displayed below form
- User not logged in: Review form replaced with sign-in link
- Quantity dropdown: Only shows options up to countInStock value
