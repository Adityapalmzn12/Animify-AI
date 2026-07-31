import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AiProvider,
  AiPollResult,
  AiSubmitInput,
  AiSubmitResult,
} from './ai-provider.interface';

@Injectable()
export class HuggingFaceProvider implements AiProvider {
  readonly name = 'huggingface';
  private readonly logger = new Logger(HuggingFaceProvider.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return !!this.config.get<string>('ai.huggingface.apiKey');
  }

  estimateCredits(): number {
    return this.config.get<number>('credits.imageGenCost') ?? 4;
  }

  async submit(input: AiSubmitInput): Promise<AiSubmitResult> {
    const key = this.config.get<string>('ai.huggingface.apiKey');
    if (!key) throw new Error('HUGGINGFACE_API_KEY not configured');
    const model = 'black-forest-labs/FLUX.1-schnell';
    const res = await fetch(
      `https://api-inference.huggingface.co/models/${model}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          Accept: 'image/png',
        },
        body: JSON.stringify({ inputs: input.prompt || 'anime scene' }),
      },
    );
    if (!res.ok) {
      const text = await res.text();
      this.logger.error(`HuggingFace failed: ${text}`);
      throw new Error(`HuggingFace failed: ${res.status} ${text}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const mime = res.headers.get('content-type') || 'image/png';
    return {
      externalId: input.jobId,
      provider: this.name,
      status: 'completed',
      resultUrl: `data:${mime};base64,${buf.toString('base64')}`,
    };
  }

  async poll(externalId: string): Promise<AiPollResult> {
    return { status: 'completed', progress: 100, metadata: { externalId } };
  }
}
