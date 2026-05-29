> **TODO(audit-2026-05-29):** POST /api/upload now requires protect+admin (Stage-2 fix 2026-05-29); unauthenticated/non-admin get 401. Verify route path is singular /api/upload.
>
> _Marker added during M6 Stage 3 living-docs audit. Behavioural content below verified accurate; only the noted parts are stale._

# File Upload API Reference

## Overview

The upload endpoint handles product image uploads. Images must be in JPG, JPEG, or PNG format and cannot exceed 2MB. Only authenticated admin users can upload product images.

## Endpoints

### POST /api/uploads

Upload a product image file to server storage.

**Auth:** Private/Admin  
**Description:** Upload product image file

**Headers:**
```
Authorization: Bearer {admin-token}
Content-Type: multipart/form-data
```

**Form Data:**
- `image` (file, required): Image file to upload (field name must be "image")

**Response 200 (Success):**
```
/uploads/image-1705776000000.jpg
```

**Errors:**
- 401: Not authorized, token failed (invalid/expired token)
- 401: Not authorized, no token
- 401: Not authorized as an admin (user lacks admin privileges)
- 400: No image uploaded (missing file in request)
- 400: Images only (jpg, jpeg, png) (unsupported file type)
- 400: File size exceeds maximum (file larger than 2MB)

**Notes:**
- Response is plain text with the file path
- Path is relative to server root; prepend base URL for full URL
- File is stored in `uploads/` directory on server
- Filename format: `{fieldname}-{timestamp}.{extension}`

---

## File Requirements

### Allowed File Types
- `.jpg` (MIME: image/jpeg)
- `.jpeg` (MIME: image/jpeg)
- `.png` (MIME: image/png)

### File Size Limits
- Maximum file size: 2 MB (2097152 bytes)
- Validation occurs at both extension and MIME type level

### Filename Validation

Files are validated by two criteria:
1. **Extension check:** File extension must be `.jpg`, `.jpeg`, or `.png`
2. **MIME type check:** Declared MIME type must be `image/jpeg` or `image/png`

Both checks must pass or upload is rejected with error.

---

## Upload Flow

1. Admin user authenticated with valid JWT token
2. Admin sends POST request with image file in "image" form field
3. Multer middleware:
   - Validates file extension
   - Validates MIME type
   - Checks file size against 2MB limit
4. If all validations pass:
   - File saved to `uploads/` directory
   - Filename generated with timestamp: `image-{timestamp}.{ext}`
   - Server returns file path as response
5. If validation fails:
   - Request returns 400 error
   - Error message describes validation failure
   - No file is written to disk

---

## Storage Configuration

### Storage Location
```
uploads/
├── image-1705776000000.jpg
├── image-1705776015234.jpg
├── image-1705776030567.png
└── ...
```

### Filename Generation
Multer diskStorage generates filenames using:
- Field name from form: `image`
- Current timestamp: `Date.now()`
- Original file extension: `.jpg`, `.jpeg`, or `.png`

**Format:** `{fieldname}-{timestamp}{extension}`

**Example outputs:**
- `image-1705776000000.jpg`
- `image-1705776015234.jpeg`
- `image-1705776030567.png`

---

## Usage Examples

### cURL
```bash
curl -X POST \
  -H "Authorization: Bearer {token}" \
  -F "image=@/path/to/image.jpg" \
  http://localhost:5000/api/uploads
```

### JavaScript (Fetch API)
```javascript
const formData = new FormData()
formData.append('image', fileInputElement.files[0])

const response = await fetch('/api/uploads', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
})

const imagePath = await response.text()
console.log('Image path:', imagePath)
// Output: /uploads/image-1705776000000.jpg
```

### JavaScript (Axios)
```javascript
const formData = new FormData()
formData.append('image', fileInputElement.files[0])

const { data: imagePath } = await axios.post(
  '/api/uploads',
  formData,
  {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'multipart/form-data'
    }
  }
)
```

---

## Security Considerations

### File Type Validation
- Double validation (extension + MIME type) prevents malicious file uploads
- Only image formats are accepted
- MIME type checked against declared type (prevents renaming executables)

### Size Limits
- 2MB maximum prevents disk space exhaustion
- Limits protect against denial-of-service attacks
- Appropriate for product thumbnails and detail images

### Authentication Requirements
- Admin-only access prevents unauthorized uploads
- JWT token must be valid and non-expired
- User account must have `isAdmin: true` flag

### File Storage
- Files stored on server filesystem in `uploads/` directory
- Should be served as static files via web server
- Consider CDN integration for production systems
- Implement file cleanup/archival for old images

---

## Integration with Products

### Typical Workflow

1. Admin creates product with sample image:
   ```
   POST /api/products
   Response: product with image: "/images/sample.jpg"
   ```

2. Admin uploads actual product image:
   ```
   POST /api/uploads
   Response: "/uploads/image-1705776000000.jpg"
   ```

3. Admin updates product with new image:
   ```
   PUT /api/products/:id
   Body: { "image": "/uploads/image-1705776000000.jpg", ... }
   ```

### Image Path Storage

The returned file path is stored in the product's `image` field:
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "name": "Wireless Headphones",
  "image": "/uploads/image-1705776000000.jpg",
  ...
}
```

Image paths are relative URLs and should be prefixed with the API base URL when constructing full URLs on frontend.

---

## Error Handling

### Common Error Scenarios

**Missing token:**
```
Status: 401
Message: "Not authorized, no token"
```

**Invalid/expired token:**
```
Status: 401
Message: "Not authorized, token failed"
```

**Not admin:**
```
Status: 401
Message: "Not authorized as an admin"
```

**No file uploaded:**
```
Status: 400
Message: "No image uploaded"
```

**Unsupported file type:**
```
Status: 400
Message: "Images only (jpg, jpeg, png)"
```

**File too large:**
```
Status: 400
Message: "File size exceeds maximum (2097152 bytes)"
```

---

## Response Codes

- 200: File uploaded successfully
- 400: Validation error (file type, size, or missing file)
- 401: Authentication failed or insufficient permissions

---

## Server Configuration

### Environment Variables
- Base upload directory: `uploads/`
- Max file size: 2 MB (hardcoded: 2 * 1024 * 1024 bytes)
- Field name: `image` (multipart form field)

### Middleware Stack
1. `protect` middleware: validates JWT token
2. `admin` middleware: checks admin privilege
3. Multer middleware: handles file upload and validation

### Dependencies
- `multer`: multipart/form-data parsing and file upload handling
- `path`: Node.js path utilities for filename validation
