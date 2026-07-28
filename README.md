# Animify AI

> Turn Any Video Into Animated Magic

Animify AI is a production-grade AI SaaS platform that converts normal videos into animated videos with automatic background removal, face enhancement, voice improvement, and subtitle generation.

## Features

- **Video Animation**: Convert real videos into stunning animated content
- **Background Removal/Replacement**: AI-powered background manipulation
- **Face Enhancement**: Improve facial features in videos
- **Voice Enhancement**: Clean and improve audio quality
- **Auto Subtitles**: AI-generated subtitles
- **HD Export**: High-quality MP4 exports

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        ANIMIFY AI                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │   Flutter    │    │   NestJS     │    │   Workers    │       │
│  │   Mobile     │───▶│   Backend    │───▶│   (BullMQ)   │       │
│  │   App        │    │   API        │    │              │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
│         │                   │                   │                │
│         │                   ▼                   ▼                │
│         │            ┌──────────────┐    ┌──────────────┐       │
│         │            │  PostgreSQL  │    │ Cloudflare   │       │
│         │            │  Database    │    │ R2 Storage   │       │
│         │            └──────────────┘    └──────────────┘       │
│         │                   │                   │                │
│         │                   ▼                   ▼                │
│         │            ┌──────────────┐    ┌──────────────┐       │
│         └───────────▶│    Redis     │    │   AI APIs    │       │
│                      │   (Queue)    │    │  (Adapters)  │       │
│                      └──────────────┘    └──────────────┘       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Tech Stack

### Mobile
- **Framework**: Flutter 3.x
- **State Management**: Riverpod
- **Navigation**: GoRouter
- **Architecture**: Clean Architecture (Feature-first)

### Backend
- **Framework**: NestJS
- **Language**: TypeScript
- **ORM**: Prisma
- **Database**: PostgreSQL
- **Queue**: Redis + BullMQ
- **Storage**: Cloudflare R2

### Video Processing
- FFmpeg
- OpenCV
- MediaPipe
- ONNX Runtime

### AI Services (via Adapters)
- Fal AI
- Replicate
- Runway
- Custom ONNX models

## Project Structure

```
animify-ai/
├── mobile/
│   └── animify_ai/          # Flutter mobile app
├── backend/
│   └── animify-api/         # NestJS backend
├── docs/                    # Documentation
├── docker/                  # Docker configurations
└── .github/                 # CI/CD workflows
```

## Subscription Plans

| Plan | Price | Videos | Minutes/Month | Max Upload | Max Duration |
|------|-------|--------|---------------|------------|--------------|
| Free Trial | ₹0 | 3 videos | - | 50 MB | 3 min |
| Premium | ₹49/month | 45 videos | 450 min | 50 MB | 3 min |

## Getting Started

### Prerequisites

- Flutter SDK 3.x
- Node.js 20+
- Docker & Docker Compose
- PostgreSQL 15+
- Redis 7+

### Mobile App

```bash
cd mobile/animify_ai
flutter pub get
flutter run
```

### Backend

```bash
cd backend/animify-api
npm install
npx prisma generate
npx prisma migrate dev
npm run start:dev
```

### Docker (Full Stack)

```bash
docker-compose up -d
```

## Documentation

- [Architecture](docs/Architecture.md)
- [API Documentation](docs/API.md)
- [Database Schema](docs/Database.md)
- [Deployment Guide](docs/Deployment.md)
- [Environment Variables](docs/Environment.md)
- [Folder Structure](docs/FolderStructure.md)
- [Contributing](docs/Contributing.md)

## License

Proprietary - All Rights Reserved

## Support

For support, email support@animify.ai
