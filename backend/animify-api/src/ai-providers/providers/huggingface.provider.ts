import { Injectable } from '@nestjs/common';
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
    const res = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputs: input.prompt || 'anime scene' }),
    });
    if (!res.ok) throw new Error(`HuggingFace failed: ${await res.text()}`);
    // Binary image — caller should upload; we mark completed with note
    return {
      externalId: input.jobId,
      provider: this.name,
      status: 'completed',
      metadata: { contentType: res.headers.get('content-type') || 'image/jpeg' },
    };
  }

  async poll(externalId: string): Promise<AiPollResult> {
    return { status: 'completed', progress: 100, metadata: { externalId } };
  }
}
