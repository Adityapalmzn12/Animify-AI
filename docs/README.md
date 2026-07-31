# Animify AI Platform

CapCut/Runway-class AI video platform built on NestJS + Flutter + OSS worker.

## Quick links

- [Environment matrix](./ENV_MATRIX.md)
- [Deployment guide](./DEPLOYMENT.md)
- [OpenAPI / Postman](./OPENAPI.md)
- [Postman collection](./postman_collection.json)

## Stack

| Layer | Tech |
|-------|------|
| API | NestJS, Prisma, BullMQ, Socket.IO, Stripe, Helmet |
| Mobile | Flutter (Riverpod, Dio, go_router) |
| AI | Hybrid provider bus — OSS default; Fal/Replicate/OpenAI/Gemini/HF/ElevenLabs when keyed |
| Storage | Supabase or S3+CloudFront (`STORAGE_PROVIDER`) |
| Worker | FastAPI + Celery + FFmpeg / Wan |

## Phases shipped

0 Foundation (BullMQ, schema, WS, Flutter shells)  
1 Auth (Apple, refresh rotation, roles, password reset)  
2 Projects / history / credits  
3 AI bus + Text/Image→Video  
4 Voice / avatar / dub / subtitles  
5 Scripts / image gen / BG remove  
6 Editor jobs + S3 adapter  
7 Stripe subscriptions / coupons / wallet  
8 Notifications / profile / i18n  
9 Admin APIs + Flutter admin  
10 CI/CD, security, tests, docs
