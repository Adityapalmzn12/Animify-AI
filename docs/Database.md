# Animify AI - Database Schema

## Overview

Animify AI uses PostgreSQL as the primary database with Prisma ORM for type-safe database access.

## Entity Relationship Diagram

```
┌──────────────────┐       ┌──────────────────┐       ┌──────────────────┐
│      users       │       │  subscriptions   │       │    payments      │
├──────────────────┤       ├──────────────────┤       ├──────────────────┤
│ id (PK)          │──┐    │ id (PK)          │       │ id (PK)          │
│ email            │  │    │ user_id (FK)     │◀──────│ user_id (FK)     │
│ name             │  │    │ plan_type        │       │ subscription_id  │
│ avatar_url       │  └───▶│ status           │◀──────│ amount           │
│ google_id        │       │ started_at       │       │ currency         │
│ email_verified   │       │ expires_at       │       │ status           │
│ password_hash    │       │ video_limit      │       │ provider         │
│ role             │       │ minutes_limit    │       │ provider_id      │
│ status           │       │ created_at       │       │ created_at       │
│ created_at       │       │ updated_at       │       │ updated_at       │
│ updated_at       │       └──────────────────┘       └──────────────────┘
└──────────────────┘
        │
        │
        ▼
┌──────────────────┐       ┌──────────────────┐       ┌──────────────────┐
│   video_jobs     │       │   video_files    │       │    templates     │
├──────────────────┤       ├──────────────────┤       ├──────────────────┤
│ id (PK)          │──────▶│ id (PK)          │       │ id (PK)          │
│ user_id (FK)     │       │ job_id (FK)      │       │ name             │
│ template_id (FK) │◀──────│ type             │       │ description      │
│ status           │       │ storage_key      │       │ preview_url      │
│ progress         │       │ original_name    │       │ config           │
│ error_message    │       │ mime_type        │       │ category         │
│ input_file_id    │       │ size_bytes       │       │ is_premium       │
│ output_file_id   │       │ duration_seconds │       │ is_active        │
│ settings         │       │ resolution       │       │ sort_order       │
│ started_at       │       │ download_url     │       │ created_at       │
│ completed_at     │       │ expires_at       │       │ updated_at       │
│ created_at       │       │ created_at       │       └──────────────────┘
│ updated_at       │       └──────────────────┘
└──────────────────┘
        │
        │
        ▼
┌──────────────────┐       ┌──────────────────┐       ┌──────────────────┐
│     usage        │       │  notifications   │       │   audit_logs     │
├──────────────────┤       ├──────────────────┤       ├──────────────────┤
│ id (PK)          │       │ id (PK)          │       │ id (PK)          │
│ user_id (FK)     │       │ user_id (FK)     │       │ user_id (FK)     │
│ period_start     │       │ title            │       │ action           │
│ period_end       │       │ body             │       │ resource_type    │
│ videos_used      │       │ type             │       │ resource_id      │
│ minutes_used     │       │ data             │       │ ip_address       │
│ created_at       │       │ read_at          │       │ user_agent       │
│ updated_at       │       │ created_at       │       │ metadata         │
└──────────────────┘       └──────────────────┘       │ created_at       │
                                                       └──────────────────┘

┌──────────────────┐       ┌──────────────────┐       ┌──────────────────┐
│   admin_users    │       │     coupons      │       │ system_settings  │
├──────────────────┤       ├──────────────────┤       ├──────────────────┤
│ id (PK)          │       │ id (PK)          │       │ id (PK)          │
│ email            │       │ code             │       │ key              │
│ name             │       │ discount_type    │       │ value            │
│ password_hash    │       │ discount_value   │       │ description      │
│ role             │       │ max_uses         │       │ created_at       │
│ permissions      │       │ used_count       │       │ updated_at       │
│ last_login_at    │       │ valid_from       │       └──────────────────┘
│ created_at       │       │ valid_until      │
│ updated_at       │       │ is_active        │
└──────────────────┘       │ created_at       │
                           │ updated_at       │
┌──────────────────┐       └──────────────────┘
│    downloads     │
├──────────────────┤
│ id (PK)          │
│ user_id (FK)     │
│ video_file_id    │
│ downloaded_at    │
│ ip_address       │
│ user_agent       │
└──────────────────┘

┌──────────────────┐
│ refresh_tokens   │
├──────────────────┤
│ id (PK)          │
│ user_id (FK)     │
│ token_hash       │
│ device_info      │
│ ip_address       │
│ expires_at       │
│ revoked_at       │
│ created_at       │
└──────────────────┘

┌──────────────────┐
│   otp_codes      │
├──────────────────┤
│ id (PK)          │
│ email            │
│ code_hash        │
│ purpose          │
│ attempts         │
│ expires_at       │
│ verified_at      │
│ created_at       │
└──────────────────┘
```

## Table Definitions

### users

Primary user table for all registered users.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT uuid_generate_v4() | Unique identifier |
| email | VARCHAR(255) | UNIQUE, NOT NULL | User email |
| name | VARCHAR(255) | NOT NULL | Display name |
| avatar_url | TEXT | NULLABLE | Profile picture URL |
| google_id | VARCHAR(255) | UNIQUE, NULLABLE | Google OAuth ID |
| email_verified | BOOLEAN | DEFAULT false | Email verification status |
| password_hash | VARCHAR(255) | NULLABLE | Bcrypt hashed password |
| role | ENUM | DEFAULT 'user' | user, admin |
| status | ENUM | DEFAULT 'active' | active, suspended, deleted |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update timestamp |

### subscriptions

User subscription information.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| user_id | UUID | FK -> users.id, UNIQUE | User reference |
| plan_type | ENUM | NOT NULL | free_trial, premium |
| status | ENUM | NOT NULL | active, cancelled, expired, past_due |
| started_at | TIMESTAMP | NOT NULL | Subscription start |
| expires_at | TIMESTAMP | NOT NULL | Subscription expiry |
| video_limit | INTEGER | NOT NULL | Videos allowed per period |
| minutes_limit | INTEGER | NOT NULL | Minutes allowed per period |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update timestamp |

### payments

Payment transaction records.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| user_id | UUID | FK -> users.id | User reference |
| subscription_id | UUID | FK -> subscriptions.id, NULLABLE | Subscription reference |
| amount | DECIMAL(10,2) | NOT NULL | Payment amount |
| currency | VARCHAR(3) | DEFAULT 'INR' | Currency code |
| status | ENUM | NOT NULL | pending, completed, failed, refunded |
| provider | ENUM | NOT NULL | razorpay, stripe |
| provider_id | VARCHAR(255) | NULLABLE | Provider transaction ID |
| metadata | JSONB | NULLABLE | Additional payment data |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update timestamp |

### video_jobs

Video processing job tracking.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| user_id | UUID | FK -> users.id | User reference |
| template_id | UUID | FK -> templates.id, NULLABLE | Template reference |
| status | ENUM | NOT NULL | pending, queued, processing, completed, failed, cancelled |
| progress | INTEGER | DEFAULT 0 | Progress percentage (0-100) |
| current_step | VARCHAR(50) | NULLABLE | Current processing step |
| error_message | TEXT | NULLABLE | Error details if failed |
| input_file_id | UUID | FK -> video_files.id | Input video reference |
| output_file_id | UUID | FK -> video_files.id, NULLABLE | Output video reference |
| settings | JSONB | NOT NULL | Processing configuration |
| priority | INTEGER | DEFAULT 0 | Queue priority |
| started_at | TIMESTAMP | NULLABLE | Processing start time |
| completed_at | TIMESTAMP | NULLABLE | Processing completion time |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update timestamp |

### video_files

Video file metadata and storage information.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| job_id | UUID | FK -> video_jobs.id, NULLABLE | Associated job |
| type | ENUM | NOT NULL | input, output, thumbnail, preview |
| storage_key | VARCHAR(512) | NOT NULL | R2 storage key |
| original_name | VARCHAR(255) | NOT NULL | Original filename |
| mime_type | VARCHAR(100) | NOT NULL | MIME type |
| size_bytes | BIGINT | NOT NULL | File size in bytes |
| duration_seconds | DECIMAL(10,2) | NULLABLE | Video duration |
| width | INTEGER | NULLABLE | Video width |
| height | INTEGER | NULLABLE | Video height |
| frame_rate | DECIMAL(5,2) | NULLABLE | Frames per second |
| download_url | TEXT | NULLABLE | Signed download URL |
| download_url_expires_at | TIMESTAMP | NULLABLE | URL expiry time |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |

### templates

Animation template definitions.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| name | VARCHAR(255) | NOT NULL | Template name |
| description | TEXT | NULLABLE | Template description |
| preview_url | TEXT | NOT NULL | Preview image/video URL |
| thumbnail_url | TEXT | NOT NULL | Thumbnail URL |
| config | JSONB | NOT NULL | Template configuration |
| category | VARCHAR(100) | NOT NULL | Template category |
| tags | TEXT[] | DEFAULT '{}' | Searchable tags |
| is_premium | BOOLEAN | DEFAULT false | Premium-only flag |
| is_active | BOOLEAN | DEFAULT true | Active status |
| sort_order | INTEGER | DEFAULT 0 | Display order |
| usage_count | INTEGER | DEFAULT 0 | Times used |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update timestamp |

### usage

User usage tracking per billing period.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| user_id | UUID | FK -> users.id | User reference |
| period_start | DATE | NOT NULL | Period start date |
| period_end | DATE | NOT NULL | Period end date |
| videos_used | INTEGER | DEFAULT 0 | Videos processed |
| minutes_used | DECIMAL(10,2) | DEFAULT 0 | Minutes processed |
| storage_used_bytes | BIGINT | DEFAULT 0 | Storage consumed |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update timestamp |

**Unique Constraint**: (user_id, period_start, period_end)

### notifications

User notifications.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| user_id | UUID | FK -> users.id | User reference |
| title | VARCHAR(255) | NOT NULL | Notification title |
| body | TEXT | NOT NULL | Notification content |
| type | ENUM | NOT NULL | info, success, warning, error, video_complete |
| data | JSONB | NULLABLE | Additional data |
| read_at | TIMESTAMP | NULLABLE | Read timestamp |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |

### audit_logs

System audit trail.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| user_id | UUID | FK -> users.id, NULLABLE | User reference |
| admin_user_id | UUID | FK -> admin_users.id, NULLABLE | Admin reference |
| action | VARCHAR(100) | NOT NULL | Action performed |
| resource_type | VARCHAR(100) | NOT NULL | Resource type |
| resource_id | VARCHAR(255) | NULLABLE | Resource identifier |
| ip_address | INET | NULLABLE | Client IP |
| user_agent | TEXT | NULLABLE | Client user agent |
| metadata | JSONB | NULLABLE | Additional context |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |

### admin_users

Admin panel users.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| email | VARCHAR(255) | UNIQUE, NOT NULL | Admin email |
| name | VARCHAR(255) | NOT NULL | Display name |
| password_hash | VARCHAR(255) | NOT NULL | Bcrypt hashed password |
| role | ENUM | NOT NULL | super_admin, admin, moderator, support |
| permissions | TEXT[] | DEFAULT '{}' | Specific permissions |
| is_active | BOOLEAN | DEFAULT true | Active status |
| last_login_at | TIMESTAMP | NULLABLE | Last login time |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update timestamp |

### coupons

Discount coupon codes.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| code | VARCHAR(50) | UNIQUE, NOT NULL | Coupon code |
| description | TEXT | NULLABLE | Coupon description |
| discount_type | ENUM | NOT NULL | percentage, fixed |
| discount_value | DECIMAL(10,2) | NOT NULL | Discount amount |
| max_uses | INTEGER | NULLABLE | Maximum redemptions |
| used_count | INTEGER | DEFAULT 0 | Times redeemed |
| min_amount | DECIMAL(10,2) | NULLABLE | Minimum order amount |
| valid_from | TIMESTAMP | NOT NULL | Valid from date |
| valid_until | TIMESTAMP | NOT NULL | Valid until date |
| is_active | BOOLEAN | DEFAULT true | Active status |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update timestamp |

### system_settings

Platform configuration.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| key | VARCHAR(100) | UNIQUE, NOT NULL | Setting key |
| value | JSONB | NOT NULL | Setting value |
| description | TEXT | NULLABLE | Setting description |
| is_public | BOOLEAN | DEFAULT false | Visible to clients |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update timestamp |

### downloads

Download tracking.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| user_id | UUID | FK -> users.id | User reference |
| video_file_id | UUID | FK -> video_files.id | File reference |
| downloaded_at | TIMESTAMP | DEFAULT NOW() | Download timestamp |
| ip_address | INET | NULLABLE | Client IP |
| user_agent | TEXT | NULLABLE | Client user agent |

### refresh_tokens

JWT refresh token tracking.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| user_id | UUID | FK -> users.id | User reference |
| token_hash | VARCHAR(255) | NOT NULL | Hashed token |
| device_info | VARCHAR(255) | NULLABLE | Device description |
| ip_address | INET | NULLABLE | Client IP |
| expires_at | TIMESTAMP | NOT NULL | Token expiry |
| revoked_at | TIMESTAMP | NULLABLE | Revocation time |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |

### otp_codes

Email OTP verification codes.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| email | VARCHAR(255) | NOT NULL | Target email |
| code_hash | VARCHAR(255) | NOT NULL | Hashed OTP |
| purpose | ENUM | NOT NULL | login, signup, password_reset |
| attempts | INTEGER | DEFAULT 0 | Verification attempts |
| max_attempts | INTEGER | DEFAULT 3 | Maximum allowed attempts |
| expires_at | TIMESTAMP | NOT NULL | OTP expiry |
| verified_at | TIMESTAMP | NULLABLE | Verification time |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |

## Indexes

```sql
-- Users
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_google_id ON users(google_id);
CREATE INDEX idx_users_status ON users(status);

-- Subscriptions
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_expires_at ON subscriptions(expires_at);

-- Payments
CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_created_at ON payments(created_at);

-- Video Jobs
CREATE INDEX idx_video_jobs_user_id ON video_jobs(user_id);
CREATE INDEX idx_video_jobs_status ON video_jobs(status);
CREATE INDEX idx_video_jobs_created_at ON video_jobs(created_at);

-- Video Files
CREATE INDEX idx_video_files_job_id ON video_files(job_id);
CREATE INDEX idx_video_files_type ON video_files(type);

-- Templates
CREATE INDEX idx_templates_category ON templates(category);
CREATE INDEX idx_templates_is_active ON templates(is_active);
CREATE INDEX idx_templates_is_premium ON templates(is_premium);

-- Usage
CREATE INDEX idx_usage_user_id ON usage(user_id);
CREATE INDEX idx_usage_period ON usage(period_start, period_end);

-- Notifications
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_read_at ON notifications(read_at);

-- Audit Logs
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- Refresh Tokens
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);

-- OTP Codes
CREATE INDEX idx_otp_codes_email ON otp_codes(email);
CREATE INDEX idx_otp_codes_expires_at ON otp_codes(expires_at);
```

## Enums

```sql
CREATE TYPE user_role AS ENUM ('user', 'admin');
CREATE TYPE user_status AS ENUM ('active', 'suspended', 'deleted');
CREATE TYPE plan_type AS ENUM ('free_trial', 'premium');
CREATE TYPE subscription_status AS ENUM ('active', 'cancelled', 'expired', 'past_due');
CREATE TYPE payment_status AS ENUM ('pending', 'completed', 'failed', 'refunded');
CREATE TYPE payment_provider AS ENUM ('razorpay', 'stripe');
CREATE TYPE job_status AS ENUM ('pending', 'queued', 'processing', 'completed', 'failed', 'cancelled');
CREATE TYPE file_type AS ENUM ('input', 'output', 'thumbnail', 'preview');
CREATE TYPE notification_type AS ENUM ('info', 'success', 'warning', 'error', 'video_complete');
CREATE TYPE admin_role AS ENUM ('super_admin', 'admin', 'moderator', 'support');
CREATE TYPE discount_type AS ENUM ('percentage', 'fixed');
CREATE TYPE otp_purpose AS ENUM ('login', 'signup', 'password_reset');
```
