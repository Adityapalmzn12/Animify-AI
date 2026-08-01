# Billing, credits & which APIs to buy

## Product model (how money flows)

```
You buy AI APIs (Replicate / OpenAI / Fal…)
        ↓
Animify API debits user credits per job
        ↓
Users get credits from:
  1) Signup grant
  2) Premium subscription (monthly grant → wallet)
  3) Wallet top-up (Stripe one-time)
  4) Promo codes / Admin grants
```

Users never call AI providers directly. **You** hold the API keys; **users** spend wallet credits.

When credits hit 0 → generation returns `Insufficient credits` → user opens **Wallet → Buy credits** or **Subscription → Premium**.

---

## What you need to buy / configure

| Service | Why | Where | Env vars (Railway) |
|--------|-----|--------|---------------------|
| **Stripe** | Subscriptions + credit top-ups | https://dashboard.stripe.com | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID` (Premium monthly price), success/cancel URLs |
| **Replicate** | Video + image (primary after Fal lock) | https://replicate.com/account/billing | `REPLICATE_API_TOKEN` |
| **OpenAI** | Images (`gpt-image-1`), scripts, TTS voice | https://platform.openai.com/account/billing | `OPENAI_API_KEY`, optional `OPENAI_IMAGE_MODEL=gpt-image-1` |
| **Fal** (optional) | Extra video/image capacity | https://fal.ai/dashboard/billing | `FAL_API_KEY` |
| **ElevenLabs** (optional) | Higher-quality TTS | https://elevenlabs.io | `ELEVENLABS_API_KEY` |
| **Supabase** | File storage for outputs | https://supabase.com | already used for storage |
| **Redis** | Job queue (Bull) | Railway Redis | `REDIS_*` |
| **Postgres** | Users, ledger, subs | Railway Postgres | `DATABASE_URL` |

Minimum to sell the app: **Stripe + Replicate + Postgres + Redis + Supabase**.  
OpenAI strongly recommended for PPT outlines + voice.

### Stripe setup checklist

1. Create Product **Animify Premium** → recurring monthly Price → copy Price ID → `STRIPE_PRICE_ID`.
2. Developers → Webhooks → endpoint  
   `https://<your-api>/api/v1/payments/webhook/stripe`  
   Events: `checkout.session.completed`, `invoice.paid`, `customer.subscription.deleted`.
3. Customer Portal enabled (Billing → Customer portal).
4. Test with Stripe test keys first, then live keys.

### Credit pricing (current defaults)

- Wallet top-up: **₹1 / credit** (Stripe `unit_amount = credits * 100` paise).
- Premium grant: **500 credits / month** (`CREDITS_PREMIUM_MONTHLY`).
- Example costs: image ~4, short I2V clip ~15, voice ~3, PPT ~8, 30s story ≈ 3×15 + 3.

Tune in Railway env / `configuration.ts`.

---

## App surfaces

| Screen | Action |
|--------|--------|
| **Subscription** | Stripe Checkout → Premium; Portal to cancel/manage |
| **Wallet** | Balance + ledger + Buy credits packs + Promo |
| **Admin → Users** | Grant credits; see plan + balance |
| **Creative Studio** | Includes **PPT Maker** (`.pptx` download) |

Credits update in Wallet after Stripe webhook completes (pull-to-refresh).

---

## Admin ops

1. Promote a user: set `role = ADMIN` in DB (or via `PATCH /admin/users/:id`).
2. Grant credits: Admin app → Users → + card, or  
   `POST /admin/users/:id/credits` `{ "amount": 200, "reason": "Support" }`.
3. Coupons: `POST /admin/coupons` with `creditGrant`.
4. Metrics: `GET /admin/metrics` (users, jobs, revenue, credits in circulation).

---

## PPT

Creative Studio mode **`ppt`** → AI outline → `.pptx` uploaded to storage → `resultUrl` download. Costs script credits.
