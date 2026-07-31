import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AiProvider,
  AiPollResult,
  AiSubmitInput,
  AiSubmitResult,
} from './ai-provider.interface';

@Injectable()
export class OpenAiProvider implements AiProvider {
  readonly name = 'openai';
  private readonly logger = new Logger(OpenAiProvider.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    const key = this.config.get<string>('ai.openai.apiKey');
    return !!key && key.trim().length > 10;
  }

  estimateCredits(jobType: string): number {
    if (jobType === 'SCRIPT') return this.config.get<number>('credits.scriptCost') ?? 2;
    if (jobType === 'IMAGE_GEN') return this.config.get<number>('credits.imageGenCost') ?? 4;
    if (jobType === 'VOICE') return this.config.get<number>('credits.voiceCost') ?? 3;
    return 5;
  }

  private imageModel(): string {
    return (
      this.config.get<string>('ai.openai.imageModel') ||
      process.env.OPENAI_IMAGE_MODEL ||
      'gpt-image-1'
    );
  }

  private sizeFor(aspect?: string, model?: string): string {
    const m = model || this.imageModel();
    // gpt-image-* supported sizes
    if (m.startsWith('gpt-image')) {
      if (aspect === '16:9') return '1536x1024';
      if (aspect === '9:16') return '1024x1536';
      return '1024x1024';
    }
    // dall-e-2 / legacy
    if (aspect === '16:9' || aspect === '9:16') return '1024x1024';
    return '1024x1024';
  }

  async submit(input: AiSubmitInput): Promise<AiSubmitResult> {
    const key = this.config.get<string>('ai.openai.apiKey');
    if (!key) throw new Error('OPENAI_API_KEY not configured');

    if (input.jobType === 'SCRIPT' || input.jobType === 'VOICE') {
      return {
        externalId: input.jobId,
        provider: this.name,
        status: 'completed',
        metadata: { prompt: input.prompt },
      };
    }

    if (input.jobType === 'IMAGE_GEN') {
      const preferred = this.imageModel();
      const attempts = [preferred, 'gpt-image-1', 'dall-e-2'].filter(
        (v, i, a) => a.indexOf(v) === i,
      );
      let lastError = '';

      for (const model of attempts) {
        const size = this.sizeFor(input.settings?.aspect as string, model);
        const body: Record<string, unknown> = {
          model,
          prompt: (input.prompt || 'beautiful illustration').slice(0, 3900),
          n: 1,
          size,
        };
        if (model.startsWith('gpt-image')) {
          body.quality = 'high';
        } else if (model === 'dall-e-2') {
          // dall-e-2: no quality/hd
        }

        const res = await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          lastError = await res.text();
          this.logger.warn(`OpenAI image model ${model} failed: ${lastError}`);
          continue;
        }

        const data = (await res.json()) as {
          data: { url?: string; b64_json?: string }[];
        };
        const item = data.data?.[0];
        let resultUrl = item?.url;
        if (!resultUrl && item?.b64_json) {
          resultUrl = `data:image/png;base64,${item.b64_json}`;
        }
        if (!resultUrl) {
          lastError = 'OpenAI returned empty image';
          continue;
        }

        return {
          externalId: input.jobId,
          provider: this.name,
          status: 'completed',
          resultUrl,
          metadata: { model },
        };
      }

      this.logger.error(`OpenAI image error: ${lastError}`);
      throw new Error(`OpenAI image failed: ${lastError}`);
    }

    throw new Error(`OpenAI provider does not support job type ${input.jobType}`);
  }

  async poll(externalId: string): Promise<AiPollResult> {
    return { status: 'completed', progress: 100, metadata: { externalId } };
  }
}
