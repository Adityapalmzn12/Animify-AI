# Animify AI - API Documentation

## Base URL

```
Production: https://api.animify.ai/api/v1
Development: http://localhost:3000/api/v1
```

## Authentication

All authenticated endpoints require a Bearer token in the Authorization header:

```
Authorization: Bearer <access_token>
```

## Response Format

All responses follow a consistent format:

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "req_abc123"
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": { ... }
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "req_abc123"
  }
}
```

### Paginated Response
```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5,
    "hasMore": true
  },
  "meta": { ... }
}
```

---

## Authentication API

### POST /auth/register

Register a new user with email and password.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123!",
  "name": "John Doe"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "John Doe",
      "emailVerified": false
    },
    "message": "Verification email sent"
  }
}
```

### POST /auth/login

Login with email and password.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123!"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": 900,
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "John Doe",
      "avatarUrl": null,
      "emailVerified": true
    }
  }
}
```

### POST /auth/google

Login/Register with Google OAuth.

**Request Body:**
```json
{
  "idToken": "google_id_token_here"
}
```

**Response:** Same as login response.

### POST /auth/send-otp

Send OTP to email for passwordless login.

**Request Body:**
```json
{
  "email": "user@example.com",
  "purpose": "login"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "OTP sent successfully",
    "expiresIn": 300
  }
}
```

### POST /auth/verify-otp

Verify OTP and complete login.

**Request Body:**
```json
{
  "email": "user@example.com",
  "otp": "123456",
  "purpose": "login"
}
```

**Response:** Same as login response.

### POST /auth/refresh

Refresh access token.

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": 900
  }
}
```

### POST /auth/logout

Logout and revoke refresh token.

**Headers:** `Authorization: Bearer <access_token>`

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Logged out successfully"
  }
}
```

### POST /auth/forgot-password

Request password reset.

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

### POST /auth/reset-password

Reset password with OTP.

**Request Body:**
```json
{
  "email": "user@example.com",
  "otp": "123456",
  "newPassword": "newSecurePassword123!"
}
```

---

## Users API

### GET /users/me

Get current user profile.

**Headers:** `Authorization: Bearer <access_token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "avatarUrl": "https://...",
    "emailVerified": true,
    "subscription": {
      "planType": "premium",
      "status": "active",
      "expiresAt": "2024-02-15T00:00:00Z",
      "videoLimit": 45,
      "minutesLimit": 450
    },
    "usage": {
      "videosUsed": 10,
      "minutesUsed": 45.5,
      "periodStart": "2024-01-01",
      "periodEnd": "2024-01-31"
    },
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

### PATCH /users/me

Update current user profile.

**Headers:** `Authorization: Bearer <access_token>`

**Request Body:**
```json
{
  "name": "John Updated",
  "avatarUrl": "https://..."
}
```

### DELETE /users/me

Delete current user account.

**Headers:** `Authorization: Bearer <access_token>`

---

## Videos API

### POST /videos/upload-url

Get signed URL for video upload.

**Headers:** `Authorization: Bearer <access_token>`

**Request Body:**
```json
{
  "fileName": "my-video.mp4",
  "fileSize": 25000000,
  "mimeType": "video/mp4"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "uploadUrl": "https://r2.cloudflare.com/...",
    "fileId": "uuid",
    "expiresIn": 3600
  }
}
```

### POST /videos/jobs

Create a new video processing job.

**Headers:** `Authorization: Bearer <access_token>`

**Request Body:**
```json
{
  "inputFileId": "uuid",
  "templateId": "uuid",
  "settings": {
    "removeBackground": true,
    "backgroundType": "replace",
    "backgroundValue": "#000000",
    "enhanceFace": true,
    "enhanceAudio": true,
    "generateSubtitles": true,
    "outputQuality": "hd"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "jobId": "uuid",
    "status": "pending",
    "estimatedTime": 300
  }
}
```

### GET /videos/jobs

List user's video jobs.

**Headers:** `Authorization: Bearer <access_token>`

**Query Parameters:**
- `page` (default: 1)
- `limit` (default: 20, max: 100)
- `status` (optional): pending, queued, processing, completed, failed
- `sortBy` (default: createdAt)
- `sortOrder` (default: desc)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "status": "completed",
      "progress": 100,
      "template": {
        "id": "uuid",
        "name": "Anime Style"
      },
      "inputFile": {
        "id": "uuid",
        "originalName": "my-video.mp4",
        "thumbnailUrl": "https://..."
      },
      "outputFile": {
        "id": "uuid",
        "downloadUrl": "https://...",
        "expiresAt": "2024-01-16T00:00:00Z"
      },
      "createdAt": "2024-01-15T10:00:00Z",
      "completedAt": "2024-01-15T10:05:00Z"
    }
  ],
  "pagination": { ... }
}
```

### GET /videos/jobs/:id

Get specific job details.

**Headers:** `Authorization: Bearer <access_token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "processing",
    "progress": 65,
    "currentStep": "animation",
    "template": { ... },
    "inputFile": { ... },
    "outputFile": null,
    "settings": { ... },
    "createdAt": "2024-01-15T10:00:00Z",
    "startedAt": "2024-01-15T10:00:30Z",
    "completedAt": null
  }
}
```

### DELETE /videos/jobs/:id

Cancel a pending/processing job.

**Headers:** `Authorization: Bearer <access_token>`

### GET /videos/jobs/:id/download

Get download URL for completed video.

**Headers:** `Authorization: Bearer <access_token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "downloadUrl": "https://...",
    "expiresAt": "2024-01-15T11:00:00Z",
    "fileName": "animify_output_abc123.mp4"
  }
}
```

---

## Templates API

### GET /templates

List available templates.

**Query Parameters:**
- `page` (default: 1)
- `limit` (default: 20)
- `category` (optional)
- `search` (optional)
- `isPremium` (optional): true/false

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Anime Style",
      "description": "Convert to anime animation style",
      "previewUrl": "https://...",
      "thumbnailUrl": "https://...",
      "category": "anime",
      "isPremium": false,
      "usageCount": 15000
    }
  ],
  "pagination": { ... }
}
```

### GET /templates/:id

Get template details.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Anime Style",
    "description": "Convert to anime animation style",
    "previewUrl": "https://...",
    "thumbnailUrl": "https://...",
    "category": "anime",
    "tags": ["anime", "cartoon", "japanese"],
    "isPremium": false,
    "config": {
      "style": "anime_v2",
      "intensity": 0.8
    }
  }
}
```

### GET /templates/categories

List template categories.

**Response:**
```json
{
  "success": true,
  "data": [
    { "id": "anime", "name": "Anime", "count": 15 },
    { "id": "cartoon", "name": "Cartoon", "count": 12 },
    { "id": "artistic", "name": "Artistic", "count": 8 }
  ]
}
```

---

## Subscriptions API

### GET /subscriptions/plans

List available subscription plans.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "free_trial",
      "name": "Free Trial",
      "price": 0,
      "currency": "INR",
      "videoLimit": 3,
      "minutesLimit": null,
      "maxUploadSize": 52428800,
      "maxDuration": 180,
      "features": ["3 free videos", "Basic templates"]
    },
    {
      "id": "premium",
      "name": "Premium",
      "price": 49,
      "currency": "INR",
      "interval": "month",
      "videoLimit": 45,
      "minutesLimit": 450,
      "maxUploadSize": 52428800,
      "maxDuration": 180,
      "features": ["45 videos/month", "450 minutes/month", "All templates", "Priority processing"]
    }
  ]
}
```

### GET /subscriptions/current

Get current subscription.

**Headers:** `Authorization: Bearer <access_token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "planType": "premium",
    "status": "active",
    "startedAt": "2024-01-01T00:00:00Z",
    "expiresAt": "2024-02-01T00:00:00Z",
    "videoLimit": 45,
    "minutesLimit": 450,
    "autoRenew": true
  }
}
```

### POST /subscriptions/subscribe

Subscribe to a plan.

**Headers:** `Authorization: Bearer <access_token>`

**Request Body:**
```json
{
  "planId": "premium",
  "couponCode": "SAVE20"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "orderId": "order_abc123",
    "amount": 39.20,
    "currency": "INR",
    "paymentUrl": "https://razorpay.com/...",
    "expiresAt": "2024-01-15T11:00:00Z"
  }
}
```

### POST /subscriptions/cancel

Cancel subscription.

**Headers:** `Authorization: Bearer <access_token>`

---

## Payments API

### GET /payments

List payment history.

**Headers:** `Authorization: Bearer <access_token>`

**Query Parameters:**
- `page` (default: 1)
- `limit` (default: 20)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "amount": 49.00,
      "currency": "INR",
      "status": "completed",
      "provider": "razorpay",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ],
  "pagination": { ... }
}
```

### POST /payments/webhook/razorpay

Razorpay webhook endpoint.

**Headers:** `X-Razorpay-Signature: <signature>`

---

## Notifications API

### GET /notifications

List notifications.

**Headers:** `Authorization: Bearer <access_token>`

**Query Parameters:**
- `page` (default: 1)
- `limit` (default: 20)
- `unreadOnly` (optional): true/false

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "title": "Video Ready!",
      "body": "Your animated video is ready to download",
      "type": "video_complete",
      "data": { "jobId": "uuid" },
      "readAt": null,
      "createdAt": "2024-01-15T10:05:00Z"
    }
  ],
  "pagination": { ... }
}
```

### PATCH /notifications/:id/read

Mark notification as read.

**Headers:** `Authorization: Bearer <access_token>`

### POST /notifications/read-all

Mark all notifications as read.

**Headers:** `Authorization: Bearer <access_token>`

---

## Admin API

### POST /admin/auth/login

Admin login.

**Request Body:**
```json
{
  "email": "admin@animify.ai",
  "password": "adminPassword123!"
}
```

### GET /admin/dashboard

Get dashboard statistics.

**Headers:** `Authorization: Bearer <admin_token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "users": {
      "total": 10000,
      "active": 8500,
      "newToday": 50,
      "newThisWeek": 350
    },
    "subscriptions": {
      "active": 2000,
      "premium": 1500,
      "revenue": {
        "today": 4900,
        "thisMonth": 147000,
        "currency": "INR"
      }
    },
    "videos": {
      "totalProcessed": 50000,
      "processingNow": 25,
      "queueSize": 100,
      "failedToday": 5
    },
    "storage": {
      "usedBytes": 1099511627776,
      "usedFormatted": "1 TB"
    }
  }
}
```

### GET /admin/users

List all users.

**Headers:** `Authorization: Bearer <admin_token>`

### GET /admin/users/:id

Get user details.

### PATCH /admin/users/:id

Update user.

### POST /admin/users/:id/suspend

Suspend user.

### GET /admin/subscriptions

List all subscriptions.

### GET /admin/payments

List all payments.

### GET /admin/video-jobs

List all video jobs.

### GET /admin/templates

List all templates.

### POST /admin/templates

Create template.

### PATCH /admin/templates/:id

Update template.

### DELETE /admin/templates/:id

Delete template.

### GET /admin/coupons

List all coupons.

### POST /admin/coupons

Create coupon.

### PATCH /admin/coupons/:id

Update coupon.

### GET /admin/audit-logs

List audit logs.

### GET /admin/settings

Get system settings.

### PATCH /admin/settings

Update system settings.

---

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| AUTH_INVALID_CREDENTIALS | 401 | Invalid email or password |
| AUTH_TOKEN_EXPIRED | 401 | Access token expired |
| AUTH_TOKEN_INVALID | 401 | Invalid access token |
| AUTH_OTP_INVALID | 400 | Invalid or expired OTP |
| AUTH_OTP_MAX_ATTEMPTS | 429 | Too many OTP attempts |
| USER_NOT_FOUND | 404 | User not found |
| USER_SUSPENDED | 403 | User account suspended |
| SUBSCRIPTION_REQUIRED | 403 | Active subscription required |
| SUBSCRIPTION_LIMIT_REACHED | 403 | Video/minutes limit reached |
| VIDEO_TOO_LARGE | 400 | Video exceeds size limit |
| VIDEO_TOO_LONG | 400 | Video exceeds duration limit |
| VIDEO_INVALID_FORMAT | 400 | Unsupported video format |
| VIDEO_JOB_NOT_FOUND | 404 | Video job not found |
| TEMPLATE_NOT_FOUND | 404 | Template not found |
| TEMPLATE_PREMIUM_REQUIRED | 403 | Premium subscription required |
| PAYMENT_FAILED | 400 | Payment processing failed |
| COUPON_INVALID | 400 | Invalid or expired coupon |
| RATE_LIMIT_EXCEEDED | 429 | Too many requests |
| VALIDATION_ERROR | 400 | Request validation failed |
| INTERNAL_ERROR | 500 | Internal server error |

---

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| /auth/* | 10 requests/minute |
| /videos/upload-url | 5 requests/minute |
| /videos/jobs (POST) | 10 requests/minute |
| General API | 100 requests/minute |
| Admin API | 200 requests/minute |

---

## Webhooks

### Video Processing Complete

Sent when a video job completes.

```json
{
  "event": "video.completed",
  "timestamp": "2024-01-15T10:05:00Z",
  "data": {
    "jobId": "uuid",
    "userId": "uuid",
    "status": "completed",
    "downloadUrl": "https://..."
  }
}
```

### Video Processing Failed

Sent when a video job fails.

```json
{
  "event": "video.failed",
  "timestamp": "2024-01-15T10:05:00Z",
  "data": {
    "jobId": "uuid",
    "userId": "uuid",
    "status": "failed",
    "error": "Processing error message"
  }
}
```
