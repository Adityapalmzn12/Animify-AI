# Animify Admin (Next.js)

Web admin panel for API health, buy links, live consumption, users, and subscriptions.

## Run locally

```bash
cd admin
cp .env.example .env.local   # edit API URL if needed
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Sign in with a user whose `role` is `ADMIN`.

Promote yourself (Postgres):

```sql
UPDATE users SET role = 'ADMIN' WHERE email = 'you@example.com';
```

## Pages

| Route | Purpose |
|-------|---------|
| `/login` | Admin login |
| `/dashboard` | Ops board — buy APIs, live jobs, top consumers |
| `/providers` | Provider health + billing links |
| `/users` | List users + grant credits |
| `/subscriptions` | Premium / free trial list |

API base: `NEXT_PUBLIC_API_URL` (defaults to Railway production `/api/v1`).
