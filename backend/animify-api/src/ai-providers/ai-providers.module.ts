import { Module } from '@nestjs/common';
import { AiStylizeService } from './ai-stylize.service';
import { OssWorkerProvider } from './providers/oss-worker.provider';
import { FalProvider } from './providers/fal.provider';
import { ReplicateProvider } from './providers/replicate.provider';
import { OpenAiProvider } from './providers/openai.provider';
import { GeminiProvider } from './providers/gemini.provider';
import { HuggingFaceProvider } from './providers/huggingface.provider';
import { AiProviderBus } from './providers/ai-provider.bus';
import { StoryPipelineService } from './story-pipeline.service';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [PrismaModule, StorageModule],
  providers: [
    AiStylizeService,
    OssWorkerProvider,
    FalProvider,
    ReplicateProvider,
    OpenAiProvider,
    GeminiProvider,
    HuggingFaceProvider,
    AiProviderBus,
    StoryPipelineService,
  ],
  exports: [
    AiStylizeService,
    AiProviderBus,
    FalProvider,
    ReplicateProvider,
    OpenAiProvider,
    GeminiProvider,
    HuggingFaceProvider,
    StoryPipelineService,
  ],
})
export class AiProvidersModule {}
