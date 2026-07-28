# Animify AI - Architecture Documentation

## Overview

Animify AI follows a modern, scalable microservices-inspired architecture with clear separation of concerns between the mobile client, backend API, and video processing workers.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │                    FLUTTER MOBILE APP                               │     │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐           │     │
│  │  │Presentati│  │Application│  │  Domain  │  │   Data   │           │     │
│  │  │   on     │─▶│  Layer   │─▶│  Layer   │─▶│  Layer   │           │     │
│  │  │  Layer   │  │          │  │          │  │          │           │     │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘           │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                    │                                         │
└────────────────────────────────────┼─────────────────────────────────────────┘
                                     │ REST API
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              API GATEWAY                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  Rate Limiting │ JWT Validation │ Request Logging │ CORS │ Compression      │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            BACKEND LAYER                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                      NESTJS APPLICATION                              │    │
│  │                                                                      │    │
│  │  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐            │    │
│  │  │  Controllers │   │   Services   │   │ Repositories │            │    │
│  │  │              │──▶│              │──▶│              │            │    │
│  │  │  - Auth      │   │  - Auth      │   │  - User      │            │    │
│  │  │  - Users     │   │  - User      │   │  - Video     │            │    │
│  │  │  - Videos    │   │  - Video     │   │  - Payment   │            │    │
│  │  │  - Templates │   │  - Template  │   │  - Template  │            │    │
│  │  │  - Payments  │   │  - Payment   │   │              │            │    │
│  │  │  - Admin     │   │  - Admin     │   │              │            │    │
│  │  └──────────────┘   └──────────────┘   └──────────────┘            │    │
│  │                            │                   │                    │    │
│  │                            ▼                   ▼                    │    │
│  │                     ┌──────────────┐   ┌──────────────┐            │    │
│  │                     │    Prisma    │   │    Redis     │            │    │
│  │                     │     ORM      │   │   (Cache)    │            │    │
│  │                     └──────────────┘   └──────────────┘            │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                          │                              │
                          ▼                              ▼
┌──────────────────────────────────┐   ┌──────────────────────────────────────┐
│         DATA LAYER               │   │           QUEUE LAYER                 │
├──────────────────────────────────┤   ├──────────────────────────────────────┤
│  ┌──────────────────────────┐    │   │  ┌──────────────────────────────┐    │
│  │      PostgreSQL          │    │   │  │        Redis + BullMQ        │    │
│  │                          │    │   │  │                              │    │
│  │  • users                 │    │   │  │  Queues:                     │    │
│  │  • subscriptions         │    │   │  │  • video-upload              │    │
│  │  • payments              │    │   │  │  • video-processing          │    │
│  │  • video_jobs            │    │   │  │  • background-removal        │    │
│  │  • video_files           │    │   │  │  • animation                 │    │
│  │  • templates             │    │   │  │  • face-enhancement          │    │
│  │  • downloads             │    │   │  │  • audio-enhancement         │    │
│  │  • usage                 │    │   │  │  • subtitle-generation       │    │
│  │  • notifications         │    │   │  │  • rendering                 │    │
│  │  • audit_logs            │    │   │  │  • notification              │    │
│  │  • admin_users           │    │   │  └──────────────────────────────┘    │
│  │  • coupons               │    │   │                                      │
│  │  • system_settings       │    │   │                                      │
│  └──────────────────────────┘    │   │                                      │
└──────────────────────────────────┘   └──────────────────────────────────────┘
                                                        │
                                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           WORKER LAYER                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │                    VIDEO PROCESSING WORKERS                         │     │
│  │                                                                     │     │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  │     │
│  │  │ Upload  │─▶│ BG Rem  │─▶│Animation│─▶│  Face   │─▶│  Audio  │  │     │
│  │  │ Worker  │  │ Worker  │  │ Worker  │  │ Worker  │  │ Worker  │  │     │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘  └─────────┘  │     │
│  │                                                           │        │     │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐                   │        │     │
│  │  │Subtitle │─▶│ Render  │─▶│Compress │◀──────────────────┘        │     │
│  │  │ Worker  │  │ Worker  │  │ Worker  │                            │     │
│  │  └─────────┘  └─────────┘  └─────────┘                            │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                    │                                         │
└────────────────────────────────────┼─────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          EXTERNAL SERVICES                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ Cloudflare   │  │   AI APIs    │  │   Payment    │  │    Email     │    │
│  │ R2 Storage   │  │  (Adapters)  │  │   Gateway    │  │   Service    │    │
│  │              │  │              │  │              │  │              │    │
│  │  • Videos    │  │  • Fal AI    │  │  • Razorpay  │  │  • SendGrid  │    │
│  │  • Thumbnails│  │  • Replicate │  │  • Stripe    │  │  • Resend    │    │
│  │  • Assets    │  │  • Runway    │  │              │  │              │    │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Flutter Architecture (Clean Architecture)

### Layer Responsibilities

```
┌─────────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                            │
│  • Widgets (UI Components)                                       │
│  • Pages (Screens)                                               │
│  • Riverpod Providers (State Management)                         │
│  • GoRouter (Navigation)                                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    APPLICATION LAYER                             │
│  • Use Cases (Business Operations)                               │
│  • State Notifiers                                               │
│  • Event Handlers                                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      DOMAIN LAYER                                │
│  • Entities (Business Objects)                                   │
│  • Repository Interfaces                                         │
│  • Value Objects                                                 │
│  • Domain Exceptions                                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       DATA LAYER                                 │
│  • Repository Implementations                                    │
│  • Data Sources (Remote/Local)                                   │
│  • Models (DTOs)                                                 │
│  • API Client                                                    │
└─────────────────────────────────────────────────────────────────┘
```

### Feature Module Structure

Each feature follows this structure:
```
feature/
├── data/
│   ├── datasources/
│   │   ├── feature_remote_datasource.dart
│   │   └── feature_local_datasource.dart
│   ├── models/
│   │   └── feature_model.dart
│   └── repositories/
│       └── feature_repository_impl.dart
├── domain/
│   ├── entities/
│   │   └── feature_entity.dart
│   ├── repositories/
│   │   └── feature_repository.dart
│   └── usecases/
│       └── get_feature_usecase.dart
└── presentation/
    ├── pages/
    │   └── feature_page.dart
    ├── widgets/
    │   └── feature_widget.dart
    └── providers/
        └── feature_provider.dart
```

## Backend Architecture (NestJS)

### Module Structure

```
┌─────────────────────────────────────────────────────────────────┐
│                      NestJS APPLICATION                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    CORE MODULE                           │    │
│  │  • Configuration                                         │    │
│  │  • Database (Prisma)                                     │    │
│  │  • Cache (Redis)                                         │    │
│  │  • Queue (BullMQ)                                        │    │
│  │  • Storage (R2)                                          │    │
│  │  • Guards                                                │    │
│  │  • Interceptors                                          │    │
│  │  • Filters                                               │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                  FEATURE MODULES                         │    │
│  │                                                          │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │    │
│  │  │   Auth   │ │  Users   │ │  Videos  │ │Templates │   │    │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │    │
│  │                                                          │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │    │
│  │  │ Payments │ │Subscript │ │  Admin   │ │Notificat │   │    │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                  WORKER MODULES                          │    │
│  │                                                          │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │    │
│  │  │  Upload  │ │Processing│ │ Rendering│ │  Export  │   │    │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Video Processing Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                    VIDEO PROCESSING PIPELINE                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────┐                                                      │
│  │ UPLOAD │                                                      │
│  └────┬───┘                                                      │
│       │                                                          │
│       ▼                                                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 1. VALIDATION                                            │    │
│  │    • File type check (mp4, mov, avi, webm)              │    │
│  │    • Size check (max 50MB)                               │    │
│  │    • Duration check (max 3 minutes)                      │    │
│  │    • Virus scan                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│       │                                                          │
│       ▼                                                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 2. METADATA EXTRACTION                                   │    │
│  │    • Resolution                                          │    │
│  │    • Duration                                            │    │
│  │    • Frame rate                                          │    │
│  │    • Codec info                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│       │                                                          │
│       ▼                                                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 3. STORAGE (Cloudflare R2)                              │    │
│  │    • Generate signed upload URL                          │    │
│  │    • Upload original video                               │    │
│  │    • Generate thumbnail                                  │    │
│  └─────────────────────────────────────────────────────────┘    │
│       │                                                          │
│       ▼                                                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 4. QUEUE JOB                                             │    │
│  │    • Create video_job record                             │    │
│  │    • Add to BullMQ processing queue                      │    │
│  └─────────────────────────────────────────────────────────┘    │
│       │                                                          │
│       ▼                                                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 5. BACKGROUND REMOVAL (AI Adapter)                       │    │
│  │    • Extract frames                                      │    │
│  │    • Process via AI API (Fal/Replicate/Runway)          │    │
│  │    • Store processed frames                              │    │
│  └─────────────────────────────────────────────────────────┘    │
│       │                                                          │
│       ▼                                                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 6. ANIMATION CONVERSION                                  │    │
│  │    • Apply animation template                            │    │
│  │    • Style transfer                                      │    │
│  │    • Character conversion                                │    │
│  └─────────────────────────────────────────────────────────┘    │
│       │                                                          │
│       ▼                                                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 7. FACE ENHANCEMENT                                      │    │
│  │    • Face detection (MediaPipe)                          │    │
│  │    • Enhancement processing                              │    │
│  │    • Expression preservation                             │    │
│  └─────────────────────────────────────────────────────────┘    │
│       │                                                          │
│       ▼                                                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 8. AUDIO ENHANCEMENT                                     │    │
│  │    • Noise reduction                                     │    │
│  │    • Voice enhancement                                   │    │
│  │    • Audio normalization                                 │    │
│  └─────────────────────────────────────────────────────────┘    │
│       │                                                          │
│       ▼                                                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 9. SUBTITLE GENERATION                                   │    │
│  │    • Speech-to-text (Whisper)                           │    │
│  │    • Timestamp alignment                                 │    │
│  │    • SRT/VTT generation                                  │    │
│  └─────────────────────────────────────────────────────────┘    │
│       │                                                          │
│       ▼                                                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 10. RENDERING (Remotion/FFmpeg)                         │    │
│  │    • Composite all layers                                │    │
│  │    • Apply effects                                       │    │
│  │    • Render final video                                  │    │
│  └─────────────────────────────────────────────────────────┘    │
│       │                                                          │
│       ▼                                                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 11. COMPRESSION                                          │    │
│  │    • H.264/H.265 encoding                               │    │
│  │    • Bitrate optimization                                │    │
│  │    • Quality settings                                    │    │
│  └─────────────────────────────────────────────────────────┘    │
│       │                                                          │
│       ▼                                                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 12. CDN UPLOAD                                           │    │
│  │    • Upload to R2                                        │    │
│  │    • Generate download URL                               │    │
│  │    • Update job status                                   │    │
│  └─────────────────────────────────────────────────────────┘    │
│       │                                                          │
│       ▼                                                          │
│  ┌────────────┐                                                  │
│  │ DOWNLOAD   │                                                  │
│  └────────────┘                                                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## AI Provider Adapter Pattern

```typescript
// Abstract adapter interface
interface AIProviderAdapter {
  removeBackground(input: VideoInput): Promise<ProcessedVideo>;
  animateVideo(input: VideoInput, style: AnimationStyle): Promise<ProcessedVideo>;
  enhanceFace(input: VideoInput): Promise<ProcessedVideo>;
  enhanceAudio(input: AudioInput): Promise<ProcessedAudio>;
  generateSubtitles(input: AudioInput): Promise<Subtitles>;
}

// Concrete implementations
class FalAIAdapter implements AIProviderAdapter { ... }
class ReplicateAdapter implements AIProviderAdapter { ... }
class RunwayAdapter implements AIProviderAdapter { ... }

// Factory for provider selection
class AIProviderFactory {
  create(provider: AIProvider): AIProviderAdapter { ... }
}
```

## Security Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     SECURITY LAYERS                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 1. TRANSPORT SECURITY                                    │    │
│  │    • HTTPS everywhere                                    │    │
│  │    • TLS 1.3                                             │    │
│  │    • Certificate pinning (mobile)                        │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 2. AUTHENTICATION                                        │    │
│  │    • JWT tokens (15 min expiry)                         │    │
│  │    • Refresh tokens (7 days)                            │    │
│  │    • Google OAuth 2.0                                    │    │
│  │    • Email OTP verification                              │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 3. AUTHORIZATION                                         │    │
│  │    • Role-Based Access Control (RBAC)                   │    │
│  │    • Resource ownership validation                       │    │
│  │    • Admin permission levels                             │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 4. INPUT VALIDATION                                      │    │
│  │    • Request validation (class-validator)               │    │
│  │    • File type validation                                │    │
│  │    • Size limits                                         │    │
│  │    • Sanitization                                        │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 5. RATE LIMITING                                         │    │
│  │    • Per-user limits                                     │    │
│  │    • Per-endpoint limits                                 │    │
│  │    • Upload throttling                                   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 6. AUDIT LOGGING                                         │    │
│  │    • All admin actions                                   │    │
│  │    • Payment events                                      │    │
│  │    • Security events                                     │    │
│  │    • User activity                                       │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    DEPLOYMENT (Railway/Coolify)                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    LOAD BALANCER                         │    │
│  └─────────────────────────────────────────────────────────┘    │
│                         │                                        │
│           ┌─────────────┼─────────────┐                         │
│           ▼             ▼             ▼                         │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│  │   API Pod    │ │   API Pod    │ │   API Pod    │            │
│  │   (NestJS)   │ │   (NestJS)   │ │   (NestJS)   │            │
│  └──────────────┘ └──────────────┘ └──────────────┘            │
│           │             │             │                         │
│           └─────────────┼─────────────┘                         │
│                         ▼                                        │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                   MANAGED SERVICES                       │    │
│  │                                                          │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │    │
│  │  │  PostgreSQL  │  │    Redis     │  │ Cloudflare   │   │    │
│  │  │  (Railway)   │  │  (Railway)   │  │     R2       │   │    │
│  │  └──────────────┘  └──────────────┘  └──────────────┘   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                   GPU WORKERS                            │    │
│  │                                                          │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │    │
│  │  │   Worker 1   │  │   Worker 2   │  │   Worker N   │   │    │
│  │  │  (Processing)│  │  (Processing)│  │  (Processing)│   │    │
│  │  └──────────────┘  └──────────────┘  └──────────────┘   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Scalability Considerations

1. **Horizontal Scaling**: API pods can scale based on load
2. **Worker Scaling**: GPU workers scale based on queue depth
3. **Database Scaling**: Read replicas for query distribution
4. **Cache Strategy**: Redis for session, rate limiting, and hot data
5. **CDN**: Cloudflare for global content delivery
6. **Queue Partitioning**: Separate queues for different processing stages
