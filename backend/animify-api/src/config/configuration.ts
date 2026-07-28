export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  database: {
    url: process.env.DATABASE_URL,
  },
  
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB ?? '0', 10),
  },
  
  jwt: {
    secret: process.env.JWT_SECRET || 'default-secret-change-in-production',
    accessExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
  },
  
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  },
  
  otp: {
    expiryMinutes: parseInt(process.env.OTP_EXPIRY_MINUTES ?? '5', 10),
    maxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS ?? '3', 10),
  },
  
  storage: {
    accountId: process.env.R2_ACCOUNT_ID,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    bucketName: process.env.R2_BUCKET_NAME,
    publicUrl: process.env.R2_PUBLIC_URL,
    uploadUrlExpiry: parseInt(process.env.R2_UPLOAD_URL_EXPIRY ?? '3600', 10),
    downloadUrlExpiry: parseInt(process.env.R2_DOWNLOAD_URL_EXPIRY ?? '86400', 10),
  },
  
  email: {
    provider: process.env.EMAIL_PROVIDER || 'resend',
    resendApiKey: process.env.RESEND_API_KEY,
    from: process.env.EMAIL_FROM || 'Animify AI <noreply@animify.ai>',
  },
  
  payment: {
    provider: process.env.PAYMENT_PROVIDER || 'razorpay',
    razorpay: {
      keyId: process.env.RAZORPAY_KEY_ID,
      keySecret: process.env.RAZORPAY_KEY_SECRET,
      webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
    },
  },
  
  ai: {
    provider: process.env.AI_PROVIDER || 'fal',
    fal: {
      apiKey: process.env.FAL_API_KEY,
    },
    replicate: {
      apiToken: process.env.REPLICATE_API_TOKEN,
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
    },
  },
  
  limits: {
    maxUploadSizeBytes: parseInt(process.env.MAX_UPLOAD_SIZE_BYTES ?? '52428800', 10),
    maxVideoDurationSeconds: parseInt(process.env.MAX_VIDEO_DURATION_SECONDS ?? '180', 10),
    freeTrialVideoLimit: parseInt(process.env.FREE_TRIAL_VIDEO_LIMIT ?? '3', 10),
    premiumVideoLimit: parseInt(process.env.PREMIUM_VIDEO_LIMIT ?? '45', 10),
    premiumMinutesLimit: parseInt(process.env.PREMIUM_MINUTES_LIMIT ?? '450', 10),
    premiumPriceInr: parseInt(process.env.PREMIUM_PRICE_INR ?? '49', 10),
  },
  
  rateLimit: {
    ttl: parseInt(process.env.RATE_LIMIT_TTL ?? '60000', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX ?? '100', 10),
    authMax: parseInt(process.env.RATE_LIMIT_AUTH_MAX ?? '10', 10),
    uploadMax: parseInt(process.env.RATE_LIMIT_UPLOAD_MAX ?? '5', 10),
  },
  
  cors: {
    origins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: process.env.CORS_CREDENTIALS === 'true',
  },
});
