import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AiProvider,
  AiPollResult,
  AiSubmitInput,
  AiSubmitResult,
} from './ai-provider.interface';
import {
  DEFAULT_QUALITY_TIERS,
  normalizeQualityTier,
} from '../../credits/quality-tiers';

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

  private authHeaders(): Record<string, string> {
    const token = this.config.get<string>('ai.replicate.apiToken');
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'wait=0',
    };
  }

  private resolveModel(input: AiSubmitInput): string {
    const settings = (input.settings || {}) as Record<string, unknown>;
    if (typeof settings.videoModel === 'string' && settings.videoModel) {
      return settings.videoModel;
    }
    if (typeof settings.imageModel === 'string' && input.jobType === 'IMAGE_GEN') {
      return settings.imageModel;
    }
    const tierId = normalizeQualityTier(
      (settings.qualityTier as string) || 'economy',
    );
    const tier =
      DEFAULT_QUALITY_TIERS.find((t) => t.id === tierId) ||
      DEFAULT_QUALITY_TIERS[0];

    if (input.jobType === 'IMAGE_GEN') {
      return tier.imageModel;
    }
    if (input.inputUrl || input.jobType === 'IMAGE_TO_VIDEO') {
      return tier.videoModelI2v;
    }
    return tier.videoModelT2v;
  }

  private buildBody(model: string, input: AiSubmitInput) {
    const prompt = input.prompt || 'cinematic video';
    if (input.jobType === 'IMAGE_GEN') {
      return {
        input: {
          prompt: input.prompt || 'beautiful illustration',
          go_fast: model.includes('schnell'),
          output_format: 'png',
        },
      };
    }

    // LTX
    if (model.includes('ltx-video')) {
      return {
        input: {
          prompt,
          ...(input.inputUrl ? { image: input.inputUrl } : {}),
        },
      };
    }

    // Wan family
    if (model.includes('wan')) {
      return {
        input: {
          prompt,
          ...(input.inputUrl ? { image: input.inputUrl } : {}),
        },
      };
    }

    // MiniMax / default
    return {
      input: {
        prompt,
        ...(input.inputUrl ? { first_frame_image: input.inputUrl } : {}),
      },
    };
  }

  async submit(input: AiSubmitInput): Promise<AiSubmitResult> {
    if (!this.isConfigured()) throw new Error('REPLICATE_API_TOKEN not configured');

    const model = this.resolveModel(input);
    const body = this.buildBody(model, input);
    this.logger.log(`Replicate model=${model} job=${input.jobType}`);

    const res = await fetch(
      `https://api.replicate.com/v1/models/${model}/predictions`,
      {
        method: 'POST',
        headers: this.authHeaders(),
        body: JSON.stringify(body),
      },
    );
    if (!res.ok) {
      const text = await res.text();
      this.logger.error(`Replicate submit failed: ${text}`);
      throw new Error(`Replicate submit failed: ${res.status} ${text}`);
    }
    const data = (await res.json()) as {
      id: string;
      status: string;
      output?: string | string[];
    };
    const url = Array.isArray(data.output) ? data.output[0] : data.output;
    return {
      externalId: data.id,
      provider: this.name,
      status: data.status === 'succeeded' ? 'completed' : 'queued',
      resultUrl: typeof url === 'string' ? url : undefined,
      metadata: { model },
    };
  }

  async poll(externalId: string): Promise<AiPollResult> {
    const res = await fetch(
      `https://api.replicate.com/v1/predictions/${externalId}`,
      { headers: this.authHeaders() },
    );
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
    await fetch(
      `https://api.replicate.com/v1/predictions/${externalId}/cancel`,
      {
        method: 'POST',
        headers: this.authHeaders(),
      },
    );
  }
}
