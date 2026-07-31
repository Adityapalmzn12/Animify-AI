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
      const size =
        (input.settings?.aspect as string) === '16:9'
          ? '1792x1024'
          : (input.settings?.aspect as string) === '9:16'
            ? '1024x1792'
            : '1024x1024';

      const res = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'dall-e-3',
          prompt: (input.prompt || 'beautiful illustration').slice(0, 3900),
          n: 1,
          size,
          quality: 'hd',
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        this.logger.error(`OpenAI image error: ${errText}`);
        throw new Error(`OpenAI image failed: ${errText}`);
      }

      const data = (await res.json()) as {
        data: { url?: string; b64_json?: string }[];
      };
      const item = data.data?.[0];
      let resultUrl = item?.url;
      if (!resultUrl && item?.b64_json) {
        resultUrl = `data:image/png;base64,${item.b64_json}`;
      }
      if (!resultUrl) throw new Error('OpenAI returned empty image');

      return {
        externalId: input.jobId,
        provider: this.name,
        status: 'completed',
        resultUrl,
      };
    }

    throw new Error(`OpenAI provider does not support job type ${input.jobType}`);
  }

  async poll(externalId: string): Promise<AiPollResult> {
    return { status: 'completed', progress: 100, metadata: { externalId } };
  }
}
