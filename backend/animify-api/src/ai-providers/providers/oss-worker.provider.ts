import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AiProvider,
  AiPollResult,
  AiSubmitInput,
  AiSubmitResult,
} from './ai-provider.interface';
import { AiStylizeService } from '../ai-stylize.service';

@Injectable()
export class OssWorkerProvider implements AiProvider {
  readonly name = 'oss';
  private readonly logger = new Logger(OssWorkerProvider.name);

  constructor(
    private readonly config: ConfigService,
    private readonly stylize: AiStylizeService,
  ) {}

  isConfigured(): boolean {
    return !!(this.config.get<string>('ai.workerUrl') || '').trim();
  }

  estimateCredits(jobType: string): number {
    const map: Record<string, string> = {
      STYLIZE: 'credits.stylizeCost',
      TEXT_TO_VIDEO: 'credits.textToVideoCost',
      IMAGE_TO_VIDEO: 'credits.imageToVideoCost',
    };
    return this.config.get<number>(map[jobType] || 'credits.stylizeCost') ?? 5;
  }

  async submit(input: AiSubmitInput): Promise<AiSubmitResult> {
    if (!input.inputUrl) {
      return {
        externalId: input.jobId,
        provider: this.name,
        status: 'failed',
        metadata: { error: 'inputUrl required for OSS provider' },
      };
    }
    const result = await this.stylize.stylizeVideo({
      jobId: input.jobId,
      videoUrl: input.inputUrl,
      style: input.style || 'anime',
      originalName: 'input.mp4',
      settings: input.settings || {},
    });
    // Upload handled by caller/processor; return buffer metadata via temp path
    return {
      externalId: input.jobId,
      provider: result.provider || this.name,
      status: 'completed',
      metadata: {
        buffer: result.buffer,
        mimeType: result.mimeType,
        fileName: result.fileName,
        engine: result.engine,
      },
    };
  }

  async poll(externalId: string): Promise<AiPollResult> {
    return { status: 'completed', progress: 100, metadata: { externalId } };
  }
}
