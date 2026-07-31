# Animify AI — Environment matrix

| Variable | Required | Default | Notes |
|----------|----------|---------|-------|
| `DATABASE_URL` | yes | — | Postgres connection string |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` | yes (prod) | localhost:6379 | BullMQ + readiness |
| `JWT_SECRET` | yes | — | Access/refresh signing |
| `JWT_ACCESS_EXPIRY` | no | `15m` | |
| `JWT_REFRESH_EXPIRY` | no | `7d` | |
| `API_PORT` | no | `3000` | Prefer over `PORT` (Redis may set PORT=6379) |
| `AI_PROVIDER` | no | `oss` | `oss` \| `fal` \| `replicate` \| `openai` |
| `AI_WORKER_URL` | prod OSS | `http://127.0.0.1:8000` | Bundled worker on Railway |
| `SUPABASE_URL` | yes* | — | *unless `STORAGE_PROVIDER=s3` |
| `SUPABASE_SECRET_KEY` | yes* | — | Service role / secret |
| `SUPABASE_STORAGE_BUCKET` | no | `animify-videos` | |
| `STORAGE_PROVIDER` | no | `supabase` | `supabase` \| `s3` |
| `AWS_REGION` / `S3_BUCKET` / `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | S3 | — | Phase 6 adapter |
| `CLOUDFRONT_URL` | no | — | Optional CDN for S3 downloads |
| `APPLE_CLIENT_ID` | Apple Sign-In | — | |
| `GOOGLE_CLIENT_ID` | Google auth | — | |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `STRIPE_PRICE_ID` | payments | — | |
| `STRIPE_SUCCESS_URL` / `STRIPE_CANCEL_URL` | no | animify.ai billing URLs | |
| `FAL_API_KEY` | T2V/I2V paid | — | Activates Fal provider |
| `REPLICATE_API_TOKEN` | T2V/I2V paid | — | |
| `OPENAI_API_KEY` | scripts/images/TTS | — | |
| `GEMINI_API_KEY` | scripts | — | |
| `HUGGINGFACE_API_KEY` | images | — | |
| `ELEVENLABS_API_KEY` | voice | — | |
| `RESEND_API_KEY` | email | — | |
| `FCM_SERVER_KEY` | push | — | |
| `CREDITS_SIGNUP_GRANT` | no | `50` | |
| `CREDITS_*_COST` | no | see `configuration.ts` | Per job-type costs |
| `CORS_ORIGINS` | no | localhost | Comma-separated |

## Feature activation rule

Paid AI integrations only activate when their env keys exist. Default path is **OSS worker** (`AI_PROVIDER=oss`).
