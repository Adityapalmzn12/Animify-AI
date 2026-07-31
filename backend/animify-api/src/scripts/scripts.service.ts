import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JobType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreditsService } from '../credits/credits.service';
import { GenerateScriptDto, ScriptType } from './dto/scripts.dto';

@Injectable()
export class ScriptsService {
  private readonly logger = new Logger(ScriptsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly credits: CreditsService,
  ) {}

  async generate(userId: string, dto: GenerateScriptDto) {
    const cost = this.config.get<number>('credits.scriptCost') ?? 2;
    await this.credits.debitCredits(userId, cost, undefined, 'Script generation');

    const systemPrompt = this.buildSystemPrompt(dto);
    const userPrompt = dto.prompt;

    let scriptText: string;
    let provider: string;

    const openaiKey = this.config.get<string>('ai.openai.apiKey');
    const geminiKey = this.config.get<string>('ai.gemini.apiKey');

    try {
      if (openaiKey) {
        scriptText = await this.generateWithOpenAi(systemPrompt, userPrompt, openaiKey);
        provider = 'openai';
      } else if (geminiKey) {
        scriptText = await this.generateWithGemini(systemPrompt, userPrompt, geminiKey);
        provider = 'gemini';
      } else {
        scriptText = this.generateLocalTemplate(dto);
        provider = 'local-template';
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Generation failed';
      this.logger.warn(`Script generation fallback: ${message}`);
      scriptText = this.generateLocalTemplate(dto);
      provider = 'local-template';
    }

    const job = await this.prisma.videoJob.create({
      data: {
        userId,
        jobType: JobType.SCRIPT,
        provider,
        creditsCost: cost,
        status: 'COMPLETED',
        progress: 100,
        currentStep: 'Completed',
        prompt: dto.prompt,
        completedAt: new Date(),
        settings: {
          scriptText,
          type: dto.type,
          tone: dto.tone,
          length: dto.length,
        },
      },
    });

    return { job, scriptText };
  }

  async list(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where = { userId, jobType: JobType.SCRIPT };
    const [items, total] = await Promise.all([
      this.prisma.videoJob.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.videoJob.count({ where }),
    ]);
    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  private buildSystemPrompt(dto: GenerateScriptDto): string {
    const tone = dto.tone || 'engaging';
    const length = dto.length || 'medium';
    return `You are a professional video script writer. Write a ${length} ${dto.type} script in a ${tone} tone. Output only the script text.`;
  }

  private async generateWithOpenAi(
    system: string,
    user: string,
    apiKey: string,
  ): Promise<string> {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 0.8,
      }),
    });
    if (!res.ok) throw new Error(await res.text());
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return data.choices?.[0]?.message?.content?.trim() || '';
  }

  private async generateWithGemini(
    system: string,
    user: string,
    apiKey: string,
  ): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: `${system}\n\nTopic: ${user}` }],
          },
        ],
      }),
    });
    if (!res.ok) throw new Error(await res.text());
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
  }

  private generateLocalTemplate(dto: GenerateScriptDto): string {
    const tone = dto.tone || 'engaging';
    const templates: Record<ScriptType, string> = {
      [ScriptType.STORY]: `[Story Script — ${tone}]\n\nOpening: ${dto.prompt}\n\nAct 1: Introduce the world and protagonist.\nAct 2: Rising conflict around "${dto.prompt}".\nAct 3: Resolution with a memorable closing line.`,
      [ScriptType.YOUTUBE]: `[YouTube Script — ${tone}]\n\nHook (0:00): Did you know about ${dto.prompt}?\n\nIntro: Welcome back! Today we're diving into ${dto.prompt}.\n\nMain points:\n1. Context\n2. Key insight\n3. Actionable takeaway\n\nOutro: Like, subscribe, and comment your thoughts!`,
      [ScriptType.ADS]: `[Ad Script — ${tone}]\n\nProblem: Struggling with ${dto.prompt}?\n\nSolution: Animify AI makes it effortless.\n\nCTA: Try free today — transform your content in minutes.`,
      [ScriptType.REEL]: `[Reel Script — ${tone}]\n\n0-3s: Bold visual + "${dto.prompt}"\n4-15s: Quick demo / transformation\n16-30s: Punchline + follow CTA`,
      [ScriptType.SCENE]: `[Scene Script — ${tone}]\n\nINT. STUDIO — DAY\n\nCharacter explores ${dto.prompt}.\n\nDIALOGUE:\n"This changes everything."\n\nFADE OUT.`,
      [ScriptType.PODCAST]: `[Podcast Script — ${tone}]\n\nHost: Welcome to the show! Today: ${dto.prompt}.\n\nGuest segment + listener question.\n\nClosing: Thanks for listening — links in description.`,
    };
    return templates[dto.type] || templates[ScriptType.STORY];
  }
}
