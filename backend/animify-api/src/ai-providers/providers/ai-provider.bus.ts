import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiProvider, AiSubmitInput } from './ai-provider.interface';
import { OssWorkerProvider } from './oss-worker.provider';
import { FalProvider } from './fal.provider';
import { ReplicateProvider } from './replicate.provider';
import { OpenAiProvider } from './openai.provider';
import { GeminiProvider } from './gemini.provider';
import { HuggingFaceProvider } from './huggingface.provider';

@Injectable()
export class AiProviderBus {
  private readonly logger = new Logger(AiProviderBus.name);
  private readonly providers: AiProvider[];

  constructor(
    private readonly config: ConfigService,
    private readonly oss: OssWorkerProvider,
    private readonly fal: FalProvider,
    private readonly replicate: ReplicateProvider,
    private readonly openai: OpenAiProvider,
    private readonly gemini: GeminiProvider,
    private readonly huggingface: HuggingFaceProvider,
  ) {
    this.providers = [
      this.oss,
      this.fal,
      this.replicate,
      this.openai,
      this.gemini,
      this.huggingface,
    ];
  }

  listConfigured() {
    return this.providers
      .filter((p) => p.isConfigured())
      .map((p) => ({
        name: p.name,
        configured: true,
        capabilities: this.capabilities(p.name),
      }));
  }

  private capabilities(name: string): string[] {
    switch (name) {
      case 'openai':
        return ['image', 'script', 'voice'];
      case 'gemini':
        return ['script'];
      case 'fal':
        return ['text_to_video', 'image_to_video', 'image'];
      case 'replicate':
        return ['text_to_video', 'image_to_video'];
      case 'huggingface':
        return ['image'];
      case 'oss':
        return ['stylize', 'edit'];
      default:
        return [];
    }
  }

  resolve(preferred?: string): AiProvider {
    const name = (
      preferred ||
      this.config.get<string>('ai.provider') ||
      'oss'
    ).toLowerCase();
    const match = this.providers.find((p) => p.name === name && p.isConfigured());
    if (match) return match;
    const fallback = this.providers.find((p) => p.isConfigured());
    if (!fallback) {
      this.logger.warn('No AI providers configured; using OSS stub');
      return this.oss;
    }
    return fallback;
  }

  forJobType(jobType: string): AiProvider {
    if (jobType === 'SCRIPT') {
      if (this.openai.isConfigured()) return this.openai;
      if (this.gemini.isConfigured()) return this.gemini;
    }
    if (jobType === 'IMAGE_GEN') {
      if (this.openai.isConfigured()) return this.openai;
      if (this.fal.isConfigured()) return this.fal;
      if (this.huggingface.isConfigured()) return this.huggingface;
    }
    if (
      jobType === 'TEXT_TO_VIDEO' ||
      jobType === 'IMAGE_TO_VIDEO' ||
      jobType === 'STORY_REEL'
    ) {
      if (this.fal.isConfigured()) return this.fal;
      if (this.replicate.isConfigured()) return this.replicate;
    }
    if (jobType === 'STYLIZE' || String(jobType).startsWith('EDIT_')) {
      return this.oss;
    }
    return this.resolve();
  }

  estimate(jobType: string, settings?: Record<string, unknown>) {
    return this.forJobType(jobType).estimateCredits(jobType, settings);
  }

  async submit(input: AiSubmitInput) {
    const provider = this.forJobType(input.jobType);
    this.logger.log(`Submitting ${input.jobType} via ${provider.name}`);
    return provider.submit(input);
  }
}
