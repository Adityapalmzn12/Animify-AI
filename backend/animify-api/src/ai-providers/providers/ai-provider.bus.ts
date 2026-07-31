import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiProvider, AiSubmitInput } from './ai-provider.interface';
import { OssWorkerProvider } from './oss-worker.provider';
import { FalProvider } from './fal.provider';
import { ReplicateProvider } from './replicate.provider';
import { OpenAiProvider } from './openai.provider';
import { GeminiProvider } from './gemini.provider';
import { HuggingFaceProvider } from './huggingface.provider';

function isRecoverableProviderError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const code = (error as Error & { code?: string }).code;
  if (code === 'PROVIDER_BILLING') return true;
  const msg = error.message.toLowerCase();
  return (
    msg.includes('exhausted balance') ||
    msg.includes('user is locked') ||
    msg.includes('billing') ||
    msg.includes('hard limit') ||
    msg.includes('quota') ||
    msg.includes('insufficient') ||
    msg.includes('does not exist') ||
    msg.includes('invalid_value') ||
    msg.includes('402') ||
    msg.includes('403') ||
    msg.includes('429') ||
    msg.includes('503') ||
    msg.includes('timeout') ||
    msg.includes('econnrefused') ||
    msg.includes('fetch failed')
  );
}

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
        return ['text_to_video', 'image_to_video', 'image'];
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

  /** Ordered candidates for a job type (preferred first). */
  candidatesFor(jobType: string): AiProvider[] {
    const preferred = (this.config.get<string>('ai.provider') || '').toLowerCase();
    let ordered: AiProvider[] = [];

    if (jobType === 'SCRIPT') {
      ordered = [this.openai, this.gemini];
    } else     if (jobType === 'IMAGE_GEN') {
      // Replicate Flux is reliable when OpenAI/Fal billing is blocked
      ordered = [this.replicate, this.openai, this.huggingface, this.fal];
    } else if (
      jobType === 'TEXT_TO_VIDEO' ||
      jobType === 'IMAGE_TO_VIDEO' ||
      jobType === 'STORY_REEL'
    ) {
      // Prefer Replicate — Fal account is currently exhausted
      ordered = [this.replicate, this.fal];
    } else if (jobType === 'STYLIZE' || String(jobType).startsWith('EDIT_')) {
      ordered = [this.oss];
    } else {
      ordered = [...this.providers];
    }

    const configured = ordered.filter((p) => p.isConfigured());
    if (preferred) {
      const pref = configured.find((p) => p.name === preferred);
      if (pref) {
        return [pref, ...configured.filter((p) => p !== pref)];
      }
    }
    return configured.length ? configured : [this.oss];
  }

  forJobType(jobType: string): AiProvider {
    return this.candidatesFor(jobType)[0] || this.resolve();
  }

  estimate(jobType: string, settings?: Record<string, unknown>) {
    return this.forJobType(jobType).estimateCredits(jobType, settings);
  }

  async submit(input: AiSubmitInput) {
    const candidates = this.candidatesFor(input.jobType);
    let lastError: unknown;
    for (const provider of candidates) {
      this.logger.log(`Submitting ${input.jobType} via ${provider.name}`);
      try {
        const submitted = await provider.submit(input);
        if (
          input.jobType === 'IMAGE_GEN' &&
          submitted.status !== 'completed' &&
          !submitted.resultUrl
        ) {
          let polls = 0;
          while (polls < 60) {
            polls += 1;
            await new Promise((r) => setTimeout(r, 2000));
            const polled = await provider.poll(submitted.externalId);
            if (polled.status === 'completed' && polled.resultUrl) {
              return {
                ...submitted,
                status: 'completed' as const,
                resultUrl: polled.resultUrl,
              };
            }
            if (polled.status === 'failed') {
              throw new Error(polled.error || `${provider.name} image failed`);
            }
          }
          throw new Error(`${provider.name} image timed out`);
        }
        return submitted;
      } catch (error) {
        lastError = error;
        if (!isRecoverableProviderError(error) || candidates.length === 1) {
          throw error;
        }
        this.logger.warn(
          `${provider.name} failed (${error instanceof Error ? error.message : error}); trying next provider`,
        );
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error('All AI providers failed');
  }
}
