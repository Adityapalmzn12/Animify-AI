export default () => ({
  port: parseInt(process.env.API_PORT || process.env.PORT || '3000', 10),
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

  apple: {
    clientId: process.env.APPLE_CLIENT_ID,
    teamId: process.env.APPLE_TEAM_ID,
    keyId: process.env.APPLE_KEY_ID,
  },

  otp: {
    expiryMinutes: parseInt(process.env.OTP_EXPIRY_MINUTES ?? '5', 10),
    maxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS ?? '3', 10),
  },

  storage: {
    provider: process.env.STORAGE_PROVIDER || 'supabase',
    supabaseUrl:
      process.env.SUPABASE_URL ||
      'https://gybemqrhlptwmnfugjkm.supabase.co',
    supabaseAnonKey:
      process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY,
    supabaseServiceRoleKey:
      process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
    jwksUrl: process.env.SUPABASE_JWKS_URL,
    bucketName: process.env.SUPABASE_STORAGE_BUCKET || 'animify-videos',
    uploadUrlExpiry: parseInt(
      process.env.SUPABASE_UPLOAD_URL_EXPIRY ?? '7200',
      10,
    ),
    downloadUrlExpiry: parseInt(
      process.env.SUPABASE_DOWNLOAD_URL_EXPIRY ?? '86400',
      10,
    ),
    s3: {
      region: process.env.AWS_REGION || 'us-east-1',
      bucket: process.env.S3_BUCKET,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      cloudFrontUrl: process.env.CLOUDFRONT_URL,
    },
  },

  email: {
    provider: process.env.EMAIL_PROVIDER || 'resend',
    resendApiKey: process.env.RESEND_API_KEY,
    from: process.env.EMAIL_FROM || 'Animify AI <noreply@animify.ai>',
  },

  payment: {
    provider: process.env.PAYMENT_PROVIDER || 'stripe',
    razorpay: {
      keyId: process.env.RAZORPAY_KEY_ID,
      keySecret: process.env.RAZORPAY_KEY_SECRET,
      webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
    },
    stripe: {
      secretKey: process.env.STRIPE_SECRET_KEY,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
      priceId: process.env.STRIPE_PRICE_ID,
      successUrl: process.env.STRIPE_SUCCESS_URL || 'https://animify.ai/billing/success',
      cancelUrl: process.env.STRIPE_CANCEL_URL || 'https://animify.ai/billing/cancel',
      portalReturnUrl: process.env.STRIPE_PORTAL_RETURN_URL || 'https://animify.ai/billing',
    },
  },

  credits: {
    signupGrant: parseInt(process.env.CREDITS_SIGNUP_GRANT ?? '50', 10),
    stylizeCost: parseInt(process.env.CREDITS_STYLIZE_COST ?? '5', 10),
    textToVideoCost: parseInt(process.env.CREDITS_T2V_COST ?? '20', 10),
    imageToVideoCost: parseInt(process.env.CREDITS_I2V_COST ?? '15', 10),
    avatarCost: parseInt(process.env.CREDITS_AVATAR_COST ?? '25', 10),
    dubCost: parseInt(process.env.CREDITS_DUB_COST ?? '15', 10),
    subtitleCost: parseInt(process.env.CREDITS_SUBTITLE_COST ?? '5', 10),
    voiceCost: parseInt(process.env.CREDITS_VOICE_COST ?? '3', 10),
    scriptCost: parseInt(process.env.CREDITS_SCRIPT_COST ?? '2', 10),
    imageGenCost: parseInt(process.env.CREDITS_IMAGE_GEN_COST ?? '4', 10),
    bgRemoveCost: parseInt(process.env.CREDITS_BG_REMOVE_COST ?? '3', 10),
    editCost: parseInt(process.env.CREDITS_EDIT_COST ?? '2', 10),
    premiumMonthlyGrant: parseInt(process.env.CREDITS_PREMIUM_MONTHLY ?? '500', 10),
  },

  ai: {
    provider: process.env.AI_PROVIDER || 'oss',
    workerUrl:
      process.env.AI_WORKER_URL !== undefined
        ? process.env.AI_WORKER_URL
        : 'http://127.0.0.1:8000',
    fal: {
      apiKey: process.env.FAL_API_KEY,
      // Off by default — Fal account is exhausted; set FAL_ENABLED=true after top-up
      enabled: (process.env.FAL_ENABLED || 'false').toLowerCase() === 'true',
    },
    replicate: {
      apiToken: process.env.REPLICATE_API_TOKEN,
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      imageModel: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1',
    },
    gemini: {
      apiKey: process.env.GEMINI_API_KEY,
    },
    huggingface: {
      apiKey: process.env.HUGGINGFACE_API_KEY,
    },
    elevenlabs: {
      apiKey: process.env.ELEVENLABS_API_KEY,
    },
  },

  fcm: {
    serverKey: process.env.FCM_SERVER_KEY,
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
