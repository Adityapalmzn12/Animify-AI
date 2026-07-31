# Animify AI — OpenAPI / Postman

## Swagger

With the API running:

- Interactive docs: `http://localhost:3000/api/docs`
- JSON: Nest Swagger document is served from the same app (`SwaggerModule`)

Export for Postman:

1. Open `/api/docs-json` if exposed, or copy from Swagger UI → Export
2. Or regenerate:

```bash
cd backend/animify-api
npm run start:dev
# then curl http://localhost:3000/api/docs-json -o ../../docs/openapi.json
```

## Core endpoint groups

| Tag | Base path | Notes |
|-----|-----------|-------|
| auth | `/api/v1/auth` | login, register, google, apple, OTP, refresh, reset-password |
| users | `/api/v1/users` | profile, delete account |
| videos | `/api/v1/videos` | upload, stylize jobs, cancel |
| projects | `/api/v1/projects` | CRUD |
| credits | `/api/v1/credits` | balance, ledger |
| generator | `/api/v1/generator` | T2V / I2V |
| voices | `/api/v1/voices` | TTS, clone, avatar, dub, subtitles |
| scripts | `/api/v1/scripts` | LLM script writer |
| images | `/api/v1/images` | image gen, BG remove |
| editor | `/api/v1/editor` | trim/merge/crop/filter/export |
| payments | `/api/v1/payments` | Stripe checkout, portal, webhook, promo |
| notifications | `/api/v1/notifications` | inbox, FCM token |
| favorites | `/api/v1/favorites` | favorites, history, downloads |
| admin | `/api/v1/admin` | metrics, users, jobs, flags, coupons |
| health | `/health`, `/ready` | no JWT |

## WebSocket

- Namespace: `/jobs`
- Auth: `handshake.auth.token` or `Authorization: Bearer`
- Event: `job.update`
