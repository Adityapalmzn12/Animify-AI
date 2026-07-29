# Animify AI - Environment Variables

## Overview

This document describes all environment variables required for the Animify AI platform.

## Backend Environment Variables

Create a `.env` file in the `backend/animify-api` directory:

```env
# =============================================================================
# APPLICATION
# =============================================================================
NODE_ENV=development
PORT=3000
API_VERSION=v1
APP_NAME=Animify AI
APP_URL=http://localhost:3000

# =============================================================================
# DATABASE
# =============================================================================
DATABASE_URL=postgresql://postgres:password@localhost:5432/animify_dev?schema=public

# Connection Pool
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10

# =============================================================================
# REDIS
# =============================================================================
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# =============================================================================
# JWT & AUTHENTICATION
# =============================================================================
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret

# OTP Settings
OTP_EXPIRY_MINUTES=5
OTP_MAX_ATTEMPTS=3

# =============================================================================
# STORAGE (Supabase Storage - free tier)
# =============================================================================
STORAGE_PROVIDER=supabase
SUPABASE_URL=https://gybemqrhlptwmnfugjkm.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxx
SUPABASE_SECRET_KEY=sb_secret_xxxxx
SUPABASE_JWKS_URL=https://gybemqrhlptwmnfugjkm.supabase.co/auth/v1/.well-known/jwks.json
SUPABASE_STORAGE_BUCKET=animify-videos

# Signed URL Expiry (seconds)
SUPABASE_UPLOAD_URL_EXPIRY=7200
SUPABASE_DOWNLOAD_URL_EXPIRY=86400

# =============================================================================
# EMAIL
# =============================================================================
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_your-resend-api-key
EMAIL_FROM=Animify AI <noreply@animify.ai>

# Alternative: SendGrid
# SENDGRID_API_KEY=SG.your-sendgrid-api-key

# =============================================================================
# PAYMENT
# =============================================================================
PAYMENT_PROVIDER=razorpay

# Razorpay
RAZORPAY_KEY_ID=rzp_test_your-key-id
RAZORPAY_KEY_SECRET=your-razorpay-secret
RAZORPAY_WEBHOOK_SECRET=your-webhook-secret

# Alternative: Stripe
# STRIPE_SECRET_KEY=sk_test_your-stripe-key
# STRIPE_WEBHOOK_SECRET=whsec_your-webhook-secret
# STRIPE_PUBLISHABLE_KEY=pk_test_your-publishable-key

# =============================================================================
# AI (OPEN SOURCE WORKER)
# =============================================================================
# oss = self-hosted FastAPI + Celery worker (no paid cloud AI)
AI_PROVIDER=oss
AI_WORKER_URL=http://localhost:8000

# Optional legacy / unused
REPLICATE_API_TOKEN=
OPENAI_API_KEY=

# =============================================================================
# VIDEO PROCESSING
# =============================================================================
# FFmpeg
FFMPEG_PATH=/usr/bin/ffmpeg
FFPROBE_PATH=/usr/bin/ffprobe

# Processing Limits
MAX_UPLOAD_SIZE_BYTES=52428800
MAX_VIDEO_DURATION_SECONDS=180
ALLOWED_VIDEO_FORMATS=mp4,mov,avi,webm,mkv

# Worker Settings
WORKER_CONCURRENCY=3
WORKER_MAX_RETRIES=3
WORKER_RETRY_DELAY_MS=5000

# =============================================================================
# QUEUE (BullMQ)
# =============================================================================
QUEUE_PREFIX=animify
QUEUE_DEFAULT_ATTEMPTS=3
QUEUE_DEFAULT_BACKOFF=exponential

# =============================================================================
# RATE LIMITING
# =============================================================================
RATE_LIMIT_TTL=60000
RATE_LIMIT_MAX=100
RATE_LIMIT_AUTH_MAX=10
RATE_LIMIT_UPLOAD_MAX=5

# =============================================================================
# CORS
# =============================================================================
CORS_ORIGINS=http://localhost:3000,http://localhost:8080
CORS_CREDENTIALS=true

# =============================================================================
# LOGGING
# =============================================================================
LOG_LEVEL=debug
LOG_FORMAT=pretty

# =============================================================================
# SECURITY
# =============================================================================
BCRYPT_ROUNDS=12
ENCRYPTION_KEY=your-32-byte-encryption-key-here

# =============================================================================
# SUBSCRIPTION LIMITS
# =============================================================================
FREE_TRIAL_VIDEO_LIMIT=3
PREMIUM_VIDEO_LIMIT=45
PREMIUM_MINUTES_LIMIT=450
PREMIUM_PRICE_INR=49

# =============================================================================
# ADMIN
# =============================================================================
ADMIN_DEFAULT_EMAIL=admin@animify.ai
ADMIN_DEFAULT_PASSWORD=change-this-in-production!
```

## Flutter Environment Variables

Create environment configuration files in `mobile/animify_ai/lib/core/config/`:

### Development (`env_dev.dart`)

```dart
class EnvDev {
  static const String apiBaseUrl = 'http://localhost:3000/api/v1';
  static const String wsBaseUrl = 'ws://localhost:3000';
  static const String googleClientId = 'your-google-client-id.apps.googleusercontent.com';
  static const String razorpayKeyId = 'rzp_test_your-key-id';
  static const bool enableLogging = true;
  static const bool enableCrashlytics = false;
}
```

### Staging (`env_staging.dart`)

```dart
class EnvStaging {
  static const String apiBaseUrl = 'https://staging-api.animify.ai/api/v1';
  static const String wsBaseUrl = 'wss://staging-api.animify.ai';
  static const String googleClientId = 'your-google-client-id.apps.googleusercontent.com';
  static const String razorpayKeyId = 'rzp_test_your-key-id';
  static const bool enableLogging = true;
  static const bool enableCrashlytics = true;
}
```

### Production (`env_prod.dart`)

```dart
class EnvProd {
  static const String apiBaseUrl = 'https://api.animify.ai/api/v1';
  static const String wsBaseUrl = 'wss://api.animify.ai';
  static const String googleClientId = 'your-google-client-id.apps.googleusercontent.com';
  static const String razorpayKeyId = 'rzp_live_your-key-id';
  static const bool enableLogging = false;
  static const bool enableCrashlytics = true;
}
```

## Docker Environment Variables

Create a `.env.docker` file for Docker Compose:

```env
# PostgreSQL
POSTGRES_USER=animify
POSTGRES_PASSWORD=your-secure-db-password
POSTGRES_DB=animify

# Redis
REDIS_PASSWORD=your-secure-redis-password

# Backend
NODE_ENV=production
DATABASE_URL=postgresql://animify:your-secure-db-password@postgres:5432/animify?schema=public
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=your-secure-redis-password
```

## Production Secrets Management

For production, use a secrets manager:

### Railway
- Set secrets in the Railway dashboard
- Use Railway's built-in PostgreSQL and Redis

### Coolify
- Set secrets in the Coolify dashboard
- Configure environment variables per service

### Docker Swarm / Kubernetes
- Use Docker secrets or Kubernetes secrets
- Mount secrets as environment variables

## Security Notes

1. **Never commit `.env` files** to version control
2. **Use strong, unique secrets** for each environment
3. **Rotate secrets regularly** in production
4. **Use different credentials** for development and production
5. **Encrypt sensitive data** at rest and in transit
6. **Limit secret access** to necessary services only

## Validation

The backend validates required environment variables on startup. Missing required variables will prevent the application from starting.

```typescript
// config/env.validation.ts
import { plainToInstance } from 'class-transformer';
import { IsString, IsNumber, validateSync } from 'class-validator';

class EnvironmentVariables {
  @IsString()
  DATABASE_URL: string;

  @IsString()
  JWT_SECRET: string;

  @IsString()
  R2_ACCESS_KEY_ID: string;

  // ... other validations
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config);
  const errors = validateSync(validatedConfig);
  if (errors.length > 0) {
    throw new Error(errors.toString());
  }
  return validatedConfig;
}
```
