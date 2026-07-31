import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AiProvider,
  AiPollResult,
  AiSubmitInput,
  AiSubmitResult,
} from './ai-provider.interface';

@Injectable()
export class ReplicateProvider implements AiProvider {
  readonly name = 'replicate';
  private readonly logger = new Logger(ReplicateProvider.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return !!this.config.get<string>('ai.replicate.apiToken');
  }

  estimateCredits(): number {
    return this.config.get<number>('credits.textToVideoCost') ?? 20;
  }

  async submit(input: AiSubmitInput): Promise<AiSubmitResult> {
    const token = this.config.get<string>('ai.replicate.apiToken');
    if (!token) throw new Error('REPLICATE_API_TOKEN not configured');

    const res = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        Authorization: `Token ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: 'minimax/video-01',
        input: {
          prompt: input.prompt || 'cinematic video',
          ...(input.inputUrl ? { first_frame_image: input.inputUrl } : {}),
        },
      }),
    });
    if (!res.ok) throw new Error(`Replicate submit failed: ${await res.text()}`);
    const data = (await res.json()) as { id: string; status: string };
    return {
      externalId: data.id,
      provider: this.name,
      status: data.status === 'succeeded' ? 'completed' : 'queued',
    };
  }

  async poll(externalId: string): Promise<AiPollResult> {
    const token = this.config.get<string>('ai.replicate.apiToken');
    const res = await fetch(`https://api.replicate.com/v1/predictions/${externalId}`, {
      headers: { Authorization: `Token ${token}` },
    });
    if (!res.ok) return { status: 'failed', error: await res.text() };
    const data = (await res.json()) as {
      status: string;
      output?: string | string[];
      error?: string;
    };
    if (data.status === 'succeeded') {
      const url = Array.isArray(data.output) ? data.output[0] : data.output;
      return { status: 'completed', progress: 100, resultUrl: url };
    }
    if (data.status === 'failed' || data.status === 'canceled') {
      return { status: 'failed', error: data.error || data.status };
    }
    return { status: 'processing', progress: 40 };
  }

  async cancel(externalId: string): Promise<void> {
    const token = this.config.get<string>('ai.replicate.apiToken');
    await fetch(`https://api.replicate.com/v1/predictions/${externalId}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Token ${token}` },
    });
  }
}
