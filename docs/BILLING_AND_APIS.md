# Billing, credits & API consumption (transparent)

## Money flow

```
You buy AI APIs (Replicate / OpenAI / Fal…)
        ↓
Animify debits user wallet credits per module (rates below)
        ↓
Users get credits from:
  1) Signup grant
  2) Subscription pack (Stripe → Premium + wallet grant)
  3) Wallet top-up
  4) Promo / Admin grant / Admin adjust
```

**Customers and Admin UI never see margin math.**  
Internal cost cut is fixed at **55%** (`BILLING_MARGIN_PERCENT=55`) when resetting default rates.

---

## Quality tiers (cheap default + expensive optional)

| Tier | Default | Models | 10s | 30s | 60s |
|------|---------|--------|-----|-----|-----|
| **Economy** | ✅ yes | LTX Video (cheap) | **15** | **29** | **55** |
| **Standard** | | Wan 2.1 | **45** | **119** | **229** |
| **Premium** | | MiniMax video-01 | **249** | **699** | **1299** |

App: user picks **Quality** chips before generate.  
Admin: **Quality & credits** page edits rates + Replicate model slugs.  
API field: `qualityTier: "economy" | "standard" | "premium"`.

---

## Module credit usage (transparent)

| Module | Key | Credits (default) | Who uses it |
|--------|-----|-------------------|-------------|
| Video 10s | STORY_10 | 25 | T2V / I2V / Studio story |
| Video 30s | STORY_30 | 49 | same |
| Video 60s | STORY_60 | 94 | same |
| Image generation | IMAGE_GEN | 4 | Logo, fashion, Ghibli, anime, product… |
| Brand kit | BRAND_KIT | 8 | Two branded images |
| PPT maker | PPT | 5 | `.pptx` export |
| Image → short clip | IMAGE_TO_VIDEO | 14 | Single clip path |
| Text → short clip | TEXT_TO_VIDEO | 18 | Single clip path |
| Script | SCRIPT | 2 | Script writing |
| Voice | VOICE | 3 | Standalone TTS (usually in video bundle) |
| Stylize | STYLIZE | 5 | Style tools |
| BG remove | BG_REMOVE | 3 | Cutout |
| Edit tools | EDIT | 2 | Trim / merge / crop |

Live rates: `GET /credits/pricing` (no margin fields).  
Admin edit: Next.js → **Credit usage** → `PATCH /admin/pricing` `{ "costs": { "STORY_30": 55 } }`.

---

## Customer end

| Surface | What they see |
|---------|----------------|
| **Wallet** | Balance + **Credit usage guide** (10/30/60s + module list) |
| **Duration chips** | `30s · 49 cr` before generate |
| **Studio modes** | Credits per mode from API |
| **Ledger** | Every debit/credit with reason |

They do **not** see margin %, provider ₹, or COGS.

---

## Admin end

| Surface | What they manage |
|---------|------------------|
| **Credit usage** | Edit credits per module (same numbers customers see) |
| **Users** | Grant / Adjust ± / Set balance (fix mistakes) |
| **Subscriptions** | Who is Premium |
| **Ops / Buy APIs** | Which provider wallet to top up |

They edit **credit rates**, not margin. Reset defaults rebuilds rates with the internal 55% cut.

---

## Subscription packs

| Pack | Price | Credits granted |
|------|-------|-----------------|
| Creator | ₹499/mo | 499 |
| Pro | ₹999/mo | 999 |
| Studio | ₹2499/mo | 2499 |

`POST /payments/checkout` `{ "planId": "pro" }` → webhook updates Premium + wallet.

---

## APIs to buy

| Service | Why |
|--------|-----|
| Stripe | Subs + top-ups |
| Replicate | Video + image |
| OpenAI | Scripts + voice |
| Fal / ElevenLabs | Optional capacity / TTS |
| Supabase + Redis + Postgres | Storage, queue, DB |

Webhook: `https://<api>/api/v1/payments/webhook/stripe`

---

## Env

```
BILLING_MARGIN_PERCENT=55
CREDIT_INR=1
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
REPLICATE_API_TOKEN=
OPENAI_API_KEY=
AI_PROVIDER=replicate
```
