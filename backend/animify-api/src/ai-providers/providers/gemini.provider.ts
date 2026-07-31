import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AiProvider,
  AiPollResult,
  AiSubmitInput,
  AiSubmitResult,
} from './ai-provider.interface';

@Injectable()
export class GeminiProvider implements AiProvider {
  readonly name = 'gemini';

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return !!this.config.get<string>('ai.gemini.apiKey');
  }

  estimateCredits(): number {
    return this.config.get<number>('credits.scriptCost') ?? 2;
  }

  async submit(input: AiSubmitInput): Promise<AiSubmitResult> {
    const key = this.config.get<string>('ai.gemini.apiKey');
    if (!key) throw new Error('GEMINI_API_KEY not configured');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: input.prompt || 'Write a short video script' }] }],
      }),
    });
    if (!res.ok) throw new Error(`Gemini failed: ${await res.text()}`);
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return {
      externalId: input.jobId,
      provider: this.name,
      status: 'completed',
      metadata: { text },
    };
  }

  async poll(externalId: string): Promise<AiPollResult> {
    return { status: 'completed', progress: 100, metadata: { externalId } };
  }
}
