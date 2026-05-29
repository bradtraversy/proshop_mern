# Authentication API Reference

## Overview

The authentication system uses JWT (JSON Web Tokens) for user session management. All authentication tokens are included in the `Authorization` header as a Bearer token and expire after 30 days.

## Endpoints

### POST /api/users/login

Authenticate a user with email and password credentials. Returns user profile data and a JWT token valid for 30 days.

**Auth:** Public  
**Description:** Authenticate user and retrieve JWT token for session management

**Request body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Response 200 (Success):**
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "name": "John Doe",
  "email": "user@example.com",
  "isAdmin": false,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Errors:**
- 401: Invalid email or password (credentials do not match)
- 400: Validation error (missing fields)

**Notes:**
- Password is verified using bcrypt.compare() for security
- Token TTL: 30 days from login time
- Token must be included in subsequent requests as `Authorization: Bearer {token}`
- Passwords are never returned in responses

---

### POST /api/users

Register a new user account. Creates user with default non-admin role.

**Auth:** Public  
**Description:** Register new user account and receive authentication token

**Request body:**
```json
{
  "name": "Jane Smith",
  "email": "jane@example.com",
  "password": "newpassword123"
}
```

**Response 201 (Created):**
```json
{
  "_id": "507f1f77bcf86cd799439012",
  "name": "Jane Smith",
  "email": "jane@example.com",
  "isAdmin": false,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Errors:**
- 400: User already exists (email registered)
- 400: Invalid user data (missing required fields)
- 400: Validation error

**Notes:**
- Email must be unique across system
- Password is automatically hashed using bcrypt with salt rounds of 10
- New users default to `isAdmin: false`
- User can log in immediately after registration

---

### GET /api/users/profile

Retrieve the authenticated user's own profile information.

**Auth:** Private (JWT token required)  
**Description:** Get current user's profile data

**Headers:**
```
Authorization: Bearer {token}
```

**Response 200 (Success):**
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "name": "John Doe",
  "email": "user@example.com",
  "isAdmin": false
}
```

**Errors:**
- 401: Not authorized, token failed (invalid/expired token)
- 401: Not authorized, no token (missing Authorization header)
- 404: User not found (user account deleted)

**Notes:**
- Password is never included in response
- User can only access their own profile with this endpoint
- Token is extracted from `Authorization: Bearer {token}` header

---

### PUT /api/users/profile

Update the authenticated user's own profile (name, email, or password).

**Auth:** Private (JWT token required)  
**Description:** Update current user's profile information and optionally change password

**Headers:**
```
Authorization: Bearer {token}
```

**Request body:**
```json
{
  "name": "John Updated",
  "email": "newemail@example.com",
  "password": "newpassword456"
}
```

**Response 200 (Success):**
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "name": "John Updated",
  "email": "newemail@example.com",
  "isAdmin": false,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Errors:**
- 401: Not authorized, token failed (invalid/expired token)
- 401: Not authorized, no token (missing Authorization header)
- 404: User not found

**Notes:**
- All fields are optional; omitted fields retain current values
- If password is provided, it is automatically hashed before storage
- New token is returned to maintain session validity
- Password validation/strength is not enforced on API level

---

## JWT Token Flow

1. User submits email/password to `/api/users/login` or registers via `/api/users`
2. Server validates credentials and generates JWT token
3. Client stores token (typically in localStorage/sessionStorage)
4. Client includes token in `Authorization: Bearer {token}` header for all protected requests
5. Server decodes token using JWT_SECRET environment variable
6. If valid, request proceeds; if invalid/expired, 401 error returned
7. Token expires after 30 days; user must re-login

---

## Error Response Format

All authentication errors follow this structure:

```json
{
  "message": "Error description"
}
```

Status codes:
- 200: Successful request
- 201: Resource created
- 400: Validation/input error
- 401: Authentication failed or token invalid
- 404: Resource not found
