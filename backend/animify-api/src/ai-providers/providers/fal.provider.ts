import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AiProvider,
  AiPollResult,
  AiSubmitInput,
  AiSubmitResult,
} from './ai-provider.interface';

@Injectable()
export class FalProvider implements AiProvider {
  readonly name = 'fal';
  private readonly logger = new Logger(FalProvider.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    const key = this.config.get<string>('ai.fal.apiKey');
    return !!key && key.trim().length > 5;
  }

  estimateCredits(): number {
    return this.config.get<number>('credits.textToVideoCost') ?? 20;
  }

  private modelFor(jobType: string): string {
    if (jobType === 'IMAGE_TO_VIDEO') {
      return 'fal-ai/minimax/video-01/image-to-video';
    }
    if (jobType === 'IMAGE_GEN') {
      return 'fal-ai/flux/schnell';
    }
    // Text to video
    return 'fal-ai/minimax/video-01-live';
  }

  async submit(input: AiSubmitInput): Promise<AiSubmitResult> {
    const key = this.config.get<string>('ai.fal.apiKey');
    if (!key) throw new Error('FAL_API_KEY not configured');

    const model = this.modelFor(input.jobType);
    const body: Record<string, unknown> = {
      prompt: input.prompt || 'cinematic video',
    };
    if (input.inputUrl) {
      body.image_url = input.inputUrl;
    }

    const res = await fetch(`https://queue.fal.run/${model}`, {
      method: 'POST',
      headers: {
        Authorization: `Key ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      this.logger.error(`Fal submit failed: ${text}`);
      if (
        res.status === 402 ||
        res.status === 403 ||
        /exhausted balance|locked|billing/i.test(text)
      ) {
        const err = new Error(
          'Fal balance exhausted — top up at fal.ai/dashboard/billing',
        );
        (err as Error & { code?: string }).code = 'PROVIDER_BILLING';
        throw err;
      }
      throw new Error(`Fal submit failed: ${res.status} ${text}`);
    }

    const data = (await res.json()) as {
      request_id?: string;
      status?: string;
      // sync responses
      video?: { url?: string };
      images?: { url?: string }[];
    };

    if (data.video?.url || data.images?.[0]?.url) {
      return {
        externalId: data.request_id || input.jobId,
        provider: this.name,
        status: 'completed',
        resultUrl: data.video?.url || data.images?.[0]?.url,
        metadata: data as Record<string, unknown>,
      };
    }

    return {
      externalId: data.request_id || input.jobId,
      provider: this.name,
      status: 'queued',
      metadata: data as Record<string, unknown>,
    };
  }

  async poll(externalId: string): Promise<AiPollResult> {
    const key = this.config.get<string>('ai.fal.apiKey');
    if (!key) throw new Error('FAL_API_KEY not configured');

    const statusRes = await fetch(
      `https://queue.fal.run/requests/${externalId}/status`,
      { headers: { Authorization: `Key ${key}` } },
    );

    if (!statusRes.ok) {
      return { status: 'failed', error: await statusRes.text() };
    }

    const statusData = (await statusRes.json()) as {
      status?: string;
      response_url?: string;
    };
    const status = (statusData.status || '').toUpperCase();

    if (status === 'COMPLETED' || status === 'COMPLETED'.toUpperCase()) {
      const resultRes = await fetch(
        statusData.response_url ||
          `https://queue.fal.run/requests/${externalId}`,
        { headers: { Authorization: `Key ${key}` } },
      );
      const result = (await resultRes.json()) as {
        video?: { url?: string };
        images?: { url?: string }[];
        image?: { url?: string };
      };
      const url =
        result.video?.url || result.images?.[0]?.url || result.image?.url;
      return { status: 'completed', progress: 100, resultUrl: url };
    }

    if (status.includes('FAIL')) {
      return { status: 'failed', error: 'Fal job failed' };
    }

    return { status: 'processing', progress: 50 };
  }
}
