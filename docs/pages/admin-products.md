> **TODO(audit-2026-05-29):** Routes / access rules / Redux slices / API calls remain accurate. The 'What Users See' / Components sections describe the old Bootstrap layout — verify against frontend/src/components/good-shop.
>
> _Marker added during M6 Stage 3 living-docs audit. Behavioural content below verified accurate; only the noted parts are stale._

# Admin Products List Screen

## Route
`/admin/productlist`, `/admin/productlist/:pageNumber`

## Access
Admin users only. Non-admin users and unauthenticated users are redirected to login.

## What Users See
A heading "Products" with a "Create Product" button positioned to the right. Below that is a paginated table listing all products with columns: ID, Name, Price, Category, Brand, and action buttons (Edit, Delete). Each row represents one product.

The table is responsive and paginated. A paginate component below the table allows navigating between pages.

## State (Redux)
- `productList` slice: `loading`, `error`, `products` array, `page`, `pages`
- `productDelete` slice: `loading`, `success`, `error` for delete action
- `productCreate` slice: `loading`, `success`, `error`, `product` (newly created product)
- `userLogin` slice: `userInfo` (used for admin access control)

## API Calls
- **On mount**: `GET /api/products?pageNumber=[pageNumber]` via `listProducts()` action
- **On delete button click**: `DELETE /api/products/:id` via `deleteProduct(id)` action
- **On "Create Product" button click**: `POST /api/products` (creates sample product) via `createProduct()` action

## Components
- **Table** (Bootstrap) – responsive paginated table
- **Button** – create, edit, delete action buttons
- **Message** – error alert display
- **Loader** – loading spinner for fetch, delete, or create operations
- **Paginate** – pagination controls (with isAdmin=true flag)
- **LinkContainer** – wraps edit button for navigation

## User Actions
- **Click "Create Product"**: Dispatches createProduct action; on success, navigates to edit page for new product
- **Click Edit button**: Navigates to `/admin/product/:id/edit`
- **Click Delete button**: Shows confirmation dialog; if confirmed, dispatches deleteProduct action
- **Click page number**: Navigates to specific page with pagination component

## Edge Cases
- User not authenticated: Redirected to login on mount
- User not admin: Redirected to login on mount
- Empty products list: Table renders with no body rows
- Create product error: Error message displayed, user remains on list
- Create product success: User auto-navigated to edit page for new product
- Delete error: Error message displayed
- Delete success: Table refreshes automatically (successDelete dependency triggers refetch)
- Loading state: Spinner replaces table content
- Multiple loading states: Delete, create, and fetch spinners shown separately
- Pagination: Table respects page number from URL params
