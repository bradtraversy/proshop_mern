# Products API Reference

## Overview

Product endpoints handle catalog management including listing, searching, filtering, and CRUD operations. Authenticated admin users can create, update, and delete products. All users can view products and submit reviews.

## Endpoints

### GET /api/products

Retrieve paginated list of all products with optional keyword search filtering.

**Auth:** Public  
**Description:** Fetch products with pagination and search capability

**Query Parameters:**
- `pageNumber` (integer, optional): Page number for pagination (default: 1)
- `keyword` (string, optional): Search term to filter products by name (case-insensitive regex)

**Response 200 (Success):**
```json
{
  "products": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "name": "Wireless Headphones",
      "image": "/images/headphones.jpg",
      "description": "High-quality wireless headphones with noise cancellation",
      "brand": "AudioTech",
      "category": "Electronics",
      "price": 129.99,
      "countInStock": 15,
      "rating": 4.5,
      "numReviews": 12,
      "user": "507f1f77bcf86cd799439001",
      "createdAt": "2024-01-10T08:15:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "page": 1,
  "pages": 3
}
```

**Errors:**
- 400: Invalid query parameters

**Notes:**
- Default page size: 10 products per page
- Keyword search uses case-insensitive regex matching on product name
- Total pages calculated as: `Math.ceil(count / pageSize)`
- Cursor-based pagination not implemented; uses offset/limit

**Example requests:**
```
GET /api/products?pageNumber=2
GET /api/products?keyword=headphones
GET /api/products?keyword=wireless&pageNumber=1
```

---

### GET /api/products/top

Retrieve the top 3 highest-rated products in the catalog.

**Auth:** Public  
**Description:** Get top-rated products for featured display

**Query Parameters:** None

**Response 200 (Success):**
```json
[
  {
    "_id": "507f1f77bcf86cd799439011",
    "name": "Premium Wireless Headphones",
    "image": "/images/headphones-premium.jpg",
    "description": "Best-selling wireless headphones with 5-star reviews",
    "brand": "AudioTech",
    "category": "Electronics",
    "price": 199.99,
    "countInStock": 8,
    "rating": 4.8,
    "numReviews": 45,
    "user": "507f1f77bcf86cd799439001"
  }
]
```

**Errors:** None (always returns array, may be empty if no products exist)

**Notes:**
- Returns maximum 3 products sorted by rating descending
- Often used for "Featured Products" homepage section
- Empty array returned if no products in catalog

---

### GET /api/products/:id

Retrieve detailed information about a specific product.

**Auth:** Public  
**Description:** Get product details by product ID

**URL Parameters:**
- `id` (string, required): MongoDB ObjectId of the product

**Response 200 (Success):**
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "name": "Wireless Headphones",
  "image": "/images/headphones.jpg",
  "description": "High-quality wireless headphones with noise cancellation",
  "brand": "AudioTech",
  "category": "Electronics",
  "price": 129.99,
  "countInStock": 15,
  "rating": 4.5,
  "numReviews": 12,
  "reviews": [
    {
      "_id": "507f1f77bcf86cd799439021",
      "name": "John Doe",
      "rating": 5,
      "comment": "Excellent product, highly recommend",
      "user": "507f1f77bcf86cd799439001",
      "createdAt": "2024-01-12T14:20:00.000Z"
    }
  ],
  "user": "507f1f77bcf86cd799439001",
  "createdAt": "2024-01-10T08:15:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

**Errors:**
- 404: Product not found (invalid ID or deleted product)

**Notes:**
- Includes complete reviews array with all review details
- Rating is calculated average of all review ratings
- numReviews is count of reviews array length

---

### POST /api/products

Create a new product with default sample values. Admin only.

**Auth:** Private/Admin  
**Description:** Create new product entry with sample defaults

**Headers:**
```
Authorization: Bearer {admin-token}
```

**Request body:** None (uses defaults)

**Response 201 (Created):**
```json
{
  "_id": "507f1f77bcf86cd799439099",
  "name": "Sample name",
  "image": "/images/sample.jpg",
  "description": "Sample description",
  "brand": "Sample brand",
  "category": "Sample category",
  "price": 0,
  "countInStock": 0,
  "rating": 0,
  "numReviews": 0,
  "reviews": [],
  "user": "507f1f77bcf86cd799439001",
  "createdAt": "2024-01-20T09:45:00.000Z",
  "updatedAt": "2024-01-20T09:45:00.000Z"
}
```

**Errors:**
- 401: Not authorized, token failed
- 401: Not authorized, no token
- 401: Not authorized as an admin

**Notes:**
- Endpoint creates product with sample defaults for admin to populate
- Price defaults to 0, should be updated immediately
- Image defaults to sample placeholder image
- User field set to authenticated admin's ID
- Created product should be updated with actual details via PUT

---

### PUT /api/products/:id

Update existing product details. Admin only.

**Auth:** Private/Admin  
**Description:** Modify product information

**Headers:**
```
Authorization: Bearer {admin-token}
```

**URL Parameters:**
- `id` (string, required): MongoDB ObjectId of the product

**Request body:**
```json
{
  "name": "Updated Headphones",
  "price": 149.99,
  "description": "Premium wireless headphones with active noise cancellation",
  "image": "/images/headphones-updated.jpg",
  "brand": "AudioTech Pro",
  "category": "Electronics",
  "countInStock": 20
}
```

**Response 200 (Success):**
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "name": "Updated Headphones",
  "image": "/images/headphones-updated.jpg",
  "description": "Premium wireless headphones with active noise cancellation",
  "brand": "AudioTech Pro",
  "category": "Electronics",
  "price": 149.99,
  "countInStock": 20,
  "rating": 4.5,
  "numReviews": 12,
  "reviews": [],
  "user": "507f1f77bcf86cd799439001",
  "createdAt": "2024-01-10T08:15:00.000Z",
  "updatedAt": "2024-01-20T11:25:00.000Z"
}
```

**Errors:**
- 401: Not authorized, token failed
- 401: Not authorized, no token
- 401: Not authorized as an admin
- 404: Product not found

**Notes:**
- All fields in request body are replaced in database
- Reviews array is not modified by this endpoint
- Rating and numReviews are calculated from reviews, not directly updated
- Updates trigger updatedAt timestamp modification

---

### DELETE /api/products/:id

Delete a product from catalog. Admin only.

**Auth:** Private/Admin  
**Description:** Remove product from system

**Headers:**
```
Authorization: Bearer {admin-token}
```

**URL Parameters:**
- `id` (string, required): MongoDB ObjectId of the product

**Response 200 (Success):**
```json
{
  "message": "Product removed"
}
```

**Errors:**
- 401: Not authorized, token failed
- 401: Not authorized, no token
- 401: Not authorized as an admin
- 404: Product not found

**Notes:**
- Deletion is permanent
- All associated reviews are lost
- Product cannot be recovered after deletion

---

### POST /api/products/:id/reviews

Submit a product review. Authenticated user.

**Auth:** Private  
**Description:** Add review to product (one per user)

**Headers:**
```
Authorization: Bearer {user-token}
```

**URL Parameters:**
- `id` (string, required): MongoDB ObjectId of the product

**Request body:**
```json
{
  "rating": 5,
  "comment": "Excellent quality and fast shipping"
}
```

**Response 201 (Created):**
```json
{
  "message": "Review added"
}
```

**Errors:**
- 401: Not authorized, token failed
- 401: Not authorized, no token
- 404: Product not found
- 400: Product already reviewed (user has existing review)

**Notes:**
- Rating must be provided (numeric value 1-5)
- User can only submit one review per product
- Submitting second review returns 400 error
- Review includes reviewer's name from user account
- Product rating and numReviews automatically recalculated
- Rating calculation: average of all review ratings

---

## Product Data Model

| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | Unique product identifier |
| `name` | String | Product display name |
| `image` | String | Product image URL path |
| `description` | String | Detailed product description |
| `brand` | String | Product brand/manufacturer |
| `category` | String | Product category classification |
| `price` | Number | Product price in currency units |
| `countInStock` | Number | Available inventory quantity |
| `rating` | Number | Average rating (0-5) calculated from reviews |
| `numReviews` | Number | Count of total reviews |
| `reviews` | Array | Array of review objects |
| `user` | ObjectId | ID of admin who created product |
| `createdAt` | Date | Product creation timestamp |
| `updatedAt` | Date | Last modification timestamp |

---

## Response Codes

- 200: Successful request
- 201: Resource created
- 400: Invalid input or duplicate review
- 401: Authentication failed or insufficient permissions
- 404: Product not found
