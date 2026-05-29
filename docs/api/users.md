> **TODO(audit-2026-05-29):** GET /api/users now enforces .select('-password') (Stage-2 fix 2026-05-29) — the admin user list never returns bcrypt hashes. Confirm no example implies otherwise.
>
> _Marker added during M6 Stage 3 living-docs audit. Behavioural content below verified accurate; only the noted parts are stale._

# User Management API Reference

## Overview

User management endpoints are restricted to administrators only. These endpoints allow admin users to view, modify, and delete user accounts from the system.

## Endpoints

### GET /api/users

Retrieve a list of all registered users in the system.

**Auth:** Private/Admin  
**Description:** Fetch all user accounts (admin only)

**Headers:**
```
Authorization: Bearer {admin-token}
```

**Query Parameters:** None

**Response 200 (Success):**
```json
[
  {
    "_id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "email": "john@example.com",
    "isAdmin": false,
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  },
  {
    "_id": "507f1f77bcf86cd799439012",
    "name": "Jane Smith",
    "email": "jane@example.com",
    "isAdmin": true,
    "createdAt": "2024-01-10T08:15:00.000Z",
    "updatedAt": "2024-01-10T08:15:00.000Z"
  }
]
```

**Errors:**
- 401: Not authorized, token failed (invalid/expired token)
- 401: Not authorized, no token
- 401: Not authorized as an admin (user lacks admin privileges)

**Notes:**
- Returns all users without pagination
- Passwords are excluded from response
- Timestamps indicate account creation and last modification
- Only admin users can access this endpoint

---

### GET /api/users/:id

Retrieve detailed information about a specific user by ID.

**Auth:** Private/Admin  
**Description:** Get user account details by user ID

**Headers:**
```
Authorization: Bearer {admin-token}
```

**URL Parameters:**
- `id` (string, required): MongoDB ObjectId of the user

**Response 200 (Success):**
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "name": "John Doe",
  "email": "john@example.com",
  "isAdmin": false,
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

**Errors:**
- 401: Not authorized, token failed
- 401: Not authorized, no token
- 401: Not authorized as an admin
- 404: User not found (invalid ID or deleted user)

**Notes:**
- Password field is excluded (using .select('-password'))
- ID must be valid MongoDB ObjectId format
- Case-sensitive endpoint path

---

### PUT /api/users/:id

Update user account details (name, email, or admin status).

**Auth:** Private/Admin  
**Description:** Modify user account properties

**Headers:**
```
Authorization: Bearer {admin-token}
```

**URL Parameters:**
- `id` (string, required): MongoDB ObjectId of the user

**Request body:**
```json
{
  "name": "John Updated",
  "email": "newemail@example.com",
  "isAdmin": true
}
```

**Response 200 (Success):**
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "name": "John Updated",
  "email": "newemail@example.com",
  "isAdmin": true
}
```

**Errors:**
- 401: Not authorized, token failed
- 401: Not authorized, no token
- 401: Not authorized as an admin
- 404: User not found

**Notes:**
- All fields are optional; only provided fields are updated
- Cannot update password through this endpoint (use profile endpoint)
- Admin role can only be modified through this endpoint
- Email uniqueness is enforced

---

### DELETE /api/users/:id

Permanently delete a user account and all associated data.

**Auth:** Private/Admin  
**Description:** Remove user account from system (admin only)

**Headers:**
```
Authorization: Bearer {admin-token}
```

**URL Parameters:**
- `id` (string, required): MongoDB ObjectId of the user

**Response 200 (Success):**
```json
{
  "message": "User removed"
}
```

**Errors:**
- 401: Not authorized, token failed
- 401: Not authorized, no token
- 401: Not authorized as an admin
- 404: User not found

**Notes:**
- Deletion is permanent and cannot be undone
- All associated orders and reviews remain in system
- User account cannot be recovered after deletion
- Attempting to delete non-existent user returns 404

---

## Admin Authorization

All user management endpoints require:
1. Valid JWT token in `Authorization: Bearer {token}` header
2. User account must have `isAdmin: true` flag
3. Both conditions must be met or request returns 401 error

**Middleware stack:**
1. `protect` middleware: validates JWT token
2. `admin` middleware: checks isAdmin flag

---

## Data Model

User documents contain:

| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | Unique user identifier |
| `name` | String | User's display name |
| `email` | String | Unique email address |
| `password` | String | Hashed password (excluded from responses) |
| `isAdmin` | Boolean | Admin privilege flag (default: false) |
| `createdAt` | Date | Account creation timestamp |
| `updatedAt` | Date | Last modification timestamp |

---

## Response Codes

- 200: Successful request
- 201: Resource created
- 400: Validation error
- 401: Authentication failed or insufficient permissions
- 404: User not found
