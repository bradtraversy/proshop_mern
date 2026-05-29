> **TODO(audit-2026-05-29):** GET /api/orders/:id is now owner/admin-only; a non-owner receives 404 (IDOR closed, Stage-2 fix 2026-05-29). Update any text describing open self-service reads.
>
> _Marker added during M6 Stage 3 living-docs audit. Behavioural content below verified accurate; only the noted parts are stale._

# Orders API Reference

## Overview

Order endpoints manage the complete order lifecycle including creation, retrieval, and payment/delivery status tracking. Users can create orders and view their own orders; admins can view all orders and mark orders as paid/delivered.

## Endpoints

### POST /api/orders

Create a new order with items and shipping information.

**Auth:** Private  
**Description:** Create order from cart contents

**Headers:**
```
Authorization: Bearer {user-token}
```

**Request body:**
```json
{
  "orderItems": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "name": "Wireless Headphones",
      "image": "/images/headphones.jpg",
      "price": 129.99,
      "qty": 2,
      "product": "507f1f77bcf86cd799439011"
    }
  ],
  "shippingAddress": {
    "address": "123 Main Street",
    "city": "Springfield",
    "postalCode": "12345",
    "country": "USA"
  },
  "paymentMethod": "PayPal",
  "itemsPrice": 259.98,
  "taxPrice": 20.80,
  "shippingPrice": 10.00,
  "totalPrice": 290.78
}
```

**Response 201 (Created):**
```json
{
  "_id": "507f1f77bcf86cd799439051",
  "user": "507f1f77bcf86cd799439001",
  "orderItems": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "name": "Wireless Headphones",
      "image": "/images/headphones.jpg",
      "price": 129.99,
      "qty": 2,
      "product": "507f1f77bcf86cd799439011"
    }
  ],
  "shippingAddress": {
    "address": "123 Main Street",
    "city": "Springfield",
    "postalCode": "12345",
    "country": "USA"
  },
  "paymentMethod": "PayPal",
  "itemsPrice": 259.98,
  "taxPrice": 20.80,
  "shippingPrice": 10.00,
  "totalPrice": 290.78,
  "isPaid": false,
  "isDelivered": false,
  "createdAt": "2024-01-20T14:30:00.000Z"
}
```

**Errors:**
- 401: Not authorized, token failed
- 401: Not authorized, no token
- 400: No order items (orderItems array is empty)

**Notes:**
- orderItems array must contain at least one item
- User ID is set from authenticated user
- Order starts with isPaid: false and isDelivered: false
- All price fields must be provided in request
- Prices are stored as-is; no server-side calculation

---

### GET /api/orders/myorders

Retrieve all orders for the authenticated user.

**Auth:** Private  
**Description:** Get current user's order history

**Headers:**
```
Authorization: Bearer {user-token}
```

**Query Parameters:** None

**Response 200 (Success):**
```json
[
  {
    "_id": "507f1f77bcf86cd799439051",
    "user": "507f1f77bcf86cd799439001",
    "orderItems": [
      {
        "_id": "507f1f77bcf86cd799439011",
        "name": "Wireless Headphones",
        "price": 129.99,
        "qty": 2,
        "product": "507f1f77bcf86cd799439011"
      }
    ],
    "shippingAddress": {
      "address": "123 Main Street",
      "city": "Springfield"
    },
    "paymentMethod": "PayPal",
    "totalPrice": 290.78,
    "isPaid": true,
    "paidAt": "2024-01-21T10:15:00.000Z",
    "isDelivered": false,
    "createdAt": "2024-01-20T14:30:00.000Z"
  }
]
```

**Errors:**
- 401: Not authorized, token failed
- 401: Not authorized, no token

**Notes:**
- Returns all orders for authenticated user
- Orders not filtered or paginated
- Empty array if user has no orders

---

### GET /api/orders/:id

Retrieve detailed information about a specific order.

**Auth:** Private  
**Description:** Get order details by order ID

**Headers:**
```
Authorization: Bearer {user-token}
```

**URL Parameters:**
- `id` (string, required): MongoDB ObjectId of the order

**Response 200 (Success):**
```json
{
  "_id": "507f1f77bcf86cd799439051",
  "user": {
    "_id": "507f1f77bcf86cd799439001",
    "name": "John Doe",
    "email": "john@example.com"
  },
  "orderItems": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "name": "Wireless Headphones",
      "image": "/images/headphones.jpg",
      "price": 129.99,
      "qty": 2,
      "product": "507f1f77bcf86cd799439011"
    }
  ],
  "shippingAddress": {
    "address": "123 Main Street",
    "city": "Springfield",
    "postalCode": "12345",
    "country": "USA"
  },
  "paymentMethod": "PayPal",
  "itemsPrice": 259.98,
  "taxPrice": 20.80,
  "shippingPrice": 10.00,
  "totalPrice": 290.78,
  "isPaid": true,
  "paidAt": "2024-01-21T10:15:00.000Z",
  "paymentResult": {
    "id": "PAY-123456",
    "status": "COMPLETED",
    "update_time": "2024-01-21T10:15:00Z",
    "email_address": "john@example.com"
  },
  "isDelivered": false,
  "createdAt": "2024-01-20T14:30:00.000Z"
}
```

**Errors:**
- 401: Not authorized, token failed
- 401: Not authorized, no token
- 404: Order not found

**Notes:**
- User object is populated with name and email
- Returns complete order with all nested details
- paymentResult only present if order is paid

---

### PUT /api/orders/:id/pay

Mark an order as paid with payment details from PayPal.

**Auth:** Private  
**Description:** Update order payment status

**Headers:**
```
Authorization: Bearer {user-token}
```

**URL Parameters:**
- `id` (string, required): MongoDB ObjectId of the order

**Request body:**
```json
{
  "id": "PAY-123456789",
  "status": "COMPLETED",
  "update_time": "2024-01-21T10:15:00Z",
  "payer": {
    "email_address": "john@example.com"
  }
}
```

**Response 200 (Success):**
```json
{
  "_id": "507f1f77bcf86cd799439051",
  "user": "507f1f77bcf86cd799439001",
  "orderItems": [...],
  "isPaid": true,
  "paidAt": "2024-01-21T10:15:00.000Z",
  "paymentResult": {
    "id": "PAY-123456789",
    "status": "COMPLETED",
    "update_time": "2024-01-21T10:15:00Z",
    "email_address": "john@example.com"
  },
  "totalPrice": 290.78,
  "createdAt": "2024-01-20T14:30:00.000Z"
}
```

**Errors:**
- 401: Not authorized, token failed
- 401: Not authorized, no token
- 404: Order not found

**Notes:**
- Sets isPaid to true
- paidAt set to current timestamp (Date.now())
- paymentResult stores PayPal transaction details
- email_address extracted from payer object
- Typically called by frontend after PayPal callback

---

### PUT /api/orders/:id/deliver

Mark an order as delivered. Admin only.

**Auth:** Private/Admin  
**Description:** Update order delivery status

**Headers:**
```
Authorization: Bearer {admin-token}
```

**URL Parameters:**
- `id` (string, required): MongoDB ObjectId of the order

**Request body:** None

**Response 200 (Success):**
```json
{
  "_id": "507f1f77bcf86cd799439051",
  "user": "507f1f77bcf86cd799439001",
  "orderItems": [...],
  "isPaid": true,
  "paidAt": "2024-01-21T10:15:00.000Z",
  "isDelivered": true,
  "deliveredAt": "2024-01-25T14:45:00.000Z",
  "totalPrice": 290.78,
  "createdAt": "2024-01-20T14:30:00.000Z"
}
```

**Errors:**
- 401: Not authorized, token failed
- 401: Not authorized, no token
- 401: Not authorized as an admin
- 404: Order not found

**Notes:**
- Sets isDelivered to true
- deliveredAt set to current timestamp
- Admin-only operation
- Order must exist but does not require isPaid: true

---

### GET /api/orders

Retrieve all orders in the system. Admin only.

**Auth:** Private/Admin  
**Description:** Get all orders (admin only)

**Headers:**
```
Authorization: Bearer {admin-token}
```

**Query Parameters:** None

**Response 200 (Success):**
```json
[
  {
    "_id": "507f1f77bcf86cd799439051",
    "user": {
      "_id": "507f1f77bcf86cd799439001",
      "name": "John Doe"
    },
    "orderItems": [...],
    "totalPrice": 290.78,
    "isPaid": true,
    "isDelivered": false,
    "createdAt": "2024-01-20T14:30:00.000Z"
  },
  {
    "_id": "507f1f77bcf86cd799439052",
    "user": {
      "_id": "507f1f77bcf86cd799439002",
      "name": "Jane Smith"
    },
    "orderItems": [...],
    "totalPrice": 450.25,
    "isPaid": true,
    "isDelivered": true,
    "createdAt": "2024-01-18T09:20:00.000Z"
  }
]
```

**Errors:**
- 401: Not authorized, token failed
- 401: Not authorized, no token
- 401: Not authorized as an admin

**Notes:**
- Admin endpoint for order management dashboard
- User object populated with id and name
- All orders in system returned
- No pagination implemented
- Empty array if no orders exist

---

## Order Data Model

| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | Unique order identifier |
| `user` | ObjectId/Object | Reference to user who placed order |
| `orderItems` | Array | Array of ordered product items |
| `shippingAddress` | Object | Delivery address object |
| `paymentMethod` | String | Payment method (e.g., "PayPal") |
| `paymentResult` | Object | Payment processor response data |
| `itemsPrice` | Number | Subtotal of items |
| `taxPrice` | Number | Calculated tax amount |
| `shippingPrice` | Number | Shipping cost |
| `totalPrice` | Number | Grand total |
| `isPaid` | Boolean | Payment completion flag |
| `paidAt` | Date | Payment timestamp |
| `isDelivered` | Boolean | Delivery completion flag |
| `deliveredAt` | Date | Delivery timestamp |
| `createdAt` | Date | Order creation timestamp |
| `updatedAt` | Date | Last modification timestamp |

---

## Order Lifecycle

1. User submits order with items/shipping via POST /api/orders (isPaid: false)
2. User completes payment with PayPal
3. Frontend calls PUT /api/orders/:id/pay with PayPal details (isPaid: true)
4. Admin marks order for shipment
5. Admin updates status via PUT /api/orders/:id/deliver (isDelivered: true)
6. User views order history via GET /api/orders/myorders

---

## Response Codes

- 200: Successful request
- 201: Resource created
- 400: Invalid input or empty order
- 401: Authentication failed or insufficient permissions
- 404: Order not found
