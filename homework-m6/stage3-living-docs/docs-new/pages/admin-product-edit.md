> **TODO(audit-2026-05-29):** Routes / access rules / Redux slices / API calls remain accurate. The 'What Users See' / Components sections describe the old Bootstrap layout — verify against frontend/src/components/good-shop.
>
> _Marker added during M6 Stage 3 living-docs audit. Behavioural content below verified accurate; only the noted parts are stale._

# Admin Product Edit Screen

## Route
`/admin/product/:id/edit`

## Access
Admin users only. Non-admin users and unauthenticated users are redirected to login.

## What Users See
A form to edit product details with a "Go Back" button returning to the products list. The form contains fields: Name, Price, Image (URL text input + file upload), Brand, Count In Stock, Category, and Description (all text inputs). An "Update" button submits changes.

Below the Image URL field is a file input for uploading a new product image. During upload, a loader is shown. On successful update, user is redirected back to the products list.

## State (Redux)
- `productDetails` slice: `loading`, `error`, `product` object (fetched data)
- `productUpdate` slice: `loading`, `success`, `error` for update action
- Local state: `uploading` boolean for file upload status

## API Calls
- **On mount**: `GET /api/products/:id` via `listProductDetails()` action to fetch product data
- **On form submit**: `PUT /api/products/:id` with product data via `updateProduct()` action
- **On file upload**: `POST /api/upload` with FormData (multipart) via axios; response is image path/URL
- **Authorization**: Upload request includes Bearer token from userInfo.token

## Components
- **FormContainer** – centered form wrapper
- **Form** (Bootstrap) – text inputs for all product fields, file input for image upload
- **Message** – error messages
- **Loader** – loading spinner during fetch, upload, or update
- **Button** – submit button and "Go Back" navigation button
- **Form.File** – file input for image upload

## User Actions
- **Edit product fields**: Updates local state on input change
- **Upload image file**: Dispatches multipart POST request; sets image URL on response
- **Click "Update"**: Dispatches updateProduct action with all changed values
- **Click "Go Back"**: Navigates back to `/admin/productlist`

## Edge Cases
- User not authenticated: Redirected to login on mount
- User not admin: Redirected to login on mount
- Product ID not found: Error message displayed, form hidden
- Loading initial product data: Spinner shown, form hidden
- Update error: Error message displayed, form remains editable
- Successful update: User redirected to products list, state reset
- Form pre-population: Initial state loaded from fetched product data
- Image upload error: Error caught, uploading flag set to false, user sees upload attempt failed
- Image upload success: New image URL set in form, ready to save with next update
- Price field: Accepts numbers only
- Count In Stock field: Accepts numbers only
- Category and Brand: No format validation, accepts any text
- Store state access: Uses store.getState() to get current userInfo token for upload auth
