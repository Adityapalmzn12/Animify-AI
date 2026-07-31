import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JobType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreditsService } from '../credits/credits.service';
import { VideosService } from '../videos/videos.service';
import { CloneVoiceDto, TtsDto, VoiceJobDto } from './dto/voices.dto';

@Injectable()
export class VoicesService {
  private readonly logger = new Logger(VoicesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly credits: CreditsService,
    private readonly videos: VideosService,
  ) {}

  async listVoices(userId: string) {
    const voices = await this.prisma.voice.findMany({
      where: {
        OR: [{ isPublic: true }, { userId }],
      },
      orderBy: [{ isPublic: 'desc' }, { name: 'asc' }],
    });
    return { items: voices };
  }

  async synthesizeTts(userId: string, dto: TtsDto) {
    const cost =
      this.config.get<number>('credits.voiceCost') ?? 3;
    await this.credits.debitCredits(userId, cost, undefined, 'Voice TTS');

    const settings: Record<string, unknown> = {
      text: dto.text,
      voiceId: dto.voiceId || 'default',
    };

    let provider = 'metadata';
    let note: string | undefined;
    let audioUrl: string | undefined;

    const elevenKey = this.config.get<string>('ai.elevenlabs.apiKey');
    const openaiKey = this.config.get<string>('ai.openai.apiKey');

    try {
      if (elevenKey) {
        const voiceId = dto.voiceId || '21m00Tcm4TlvDq8ikWAM';
        const res = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
          {
            method: 'POST',
            headers: {
              'xi-api-key': elevenKey,
              'Content-Type': 'application/json',
              Accept: 'audio/mpeg',
            },
            body: JSON.stringify({
              text: dto.text,
              model_id: 'eleven_multilingual_v2',
            }),
          },
        );
        if (!res.ok) {
          throw new Error(await res.text());
        }
        const buffer = Buffer.from(await res.arrayBuffer());
        provider = 'elevenlabs';
        settings.audioBytes = buffer.length;
        settings.providerVoiceId = voiceId;
        note = 'Audio synthesized via ElevenLabs (stored as metadata; upload to storage in production pipeline)';
      } else if (openaiKey) {
        const res = await fetch('https://api.openai.com/v1/audio/speech', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${openaiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'tts-1',
            input: dto.text,
            voice: dto.voiceId || 'alloy',
          }),
        });
        if (!res.ok) {
          throw new Error(await res.text());
        }
        const buffer = Buffer.from(await res.arrayBuffer());
        provider = 'openai';
        settings.audioBytes = buffer.length;
        note = 'Audio synthesized via OpenAI TTS (stored as metadata; upload to storage in production pipeline)';
      } else {
        note =
          'No TTS provider configured — text stored; configure ELEVENLABS_API_KEY or OPENAI_API_KEY for synthesis';
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'TTS synthesis failed';
      this.logger.warn(`TTS fallback: ${message}`);
      note = `TTS provider error — text stored: ${message.slice(0, 200)}`;
    }

    const job = await this.prisma.videoJob.create({
      data: {
        userId,
        projectId: dto.projectId || null,
        jobType: JobType.VOICE,
        provider,
        creditsCost: cost,
        status: 'COMPLETED',
        progress: 100,
        currentStep: 'Completed',
        prompt: dto.text,
        completedAt: new Date(),
        settings: {
          ...settings,
          note,
          audioUrl,
        },
      },
    });

    return { job, note, provider };
  }

  async cloneVoice(userId: string, dto: CloneVoiceDto) {
    const voice = await this.prisma.voice.create({
      data: {
        userId,
        name: dto.name,
        provider: 'clone',
        providerId: dto.providerId || `clone_${Date.now()}`,
        language: dto.language || 'en',
        previewUrl: dto.previewUrl || null,
        isClone: true,
        isPublic: false,
        metadata: { clonedAt: new Date().toISOString() },
      },
    });
    return voice;
  }

  createAvatarJob(userId: string, dto: VoiceJobDto) {
    return this.videos.createVideoJob(userId, {
      jobType: JobType.AVATAR,
      inputFileId: dto.inputFileId,
      prompt: dto.prompt,
      projectId: dto.projectId,
      settings: {
        ...(dto.settings || {}),
        voiceId: dto.voiceId,
      },
    });
  }

  createDubJob(userId: string, dto: VoiceJobDto) {
    if (!dto.inputFileId) {
      throw new BadRequestException('inputFileId is required for dubbing');
    }
    return this.videos.createVideoJob(userId, {
      jobType: JobType.DUB,
      inputFileId: dto.inputFileId,
      prompt: dto.prompt,
      projectId: dto.projectId,
      settings: {
        ...(dto.settings || {}),
        voiceId: dto.voiceId,
        targetLanguage: dto.targetLanguage || 'en',
      },
    });
  }

  async createSubtitleJob(userId: string, dto: VoiceJobDto) {
    if (!dto.inputFileId) {
      throw new BadRequestException('inputFileId is required for subtitles');
    }

    const openaiKey = this.config.get<string>('ai.openai.apiKey');
    if (!openaiKey) {
      return this.videos.createVideoJob(userId, {
        jobType: JobType.SUBTITLE,
        inputFileId: dto.inputFileId,
        prompt: dto.prompt,
        projectId: dto.projectId,
        settings: {
          ...(dto.settings || {}),
          targetLanguage: dto.targetLanguage || 'en',
        },
      });
    }

    const cost =
      this.config.get<number>('credits.subtitleCost') ?? 5;
    await this.credits.debitCredits(userId, cost, undefined, 'Subtitle job');

    const result = this.buildWhisperStubSrt(
      dto.prompt || 'Auto-generated subtitles',
    );

    const job = await this.prisma.videoJob.create({
      data: {
        userId,
        projectId: dto.projectId || null,
        inputFileId: dto.inputFileId,
        jobType: JobType.SUBTITLE,
        provider: 'openai-whisper-stub',
        creditsCost: cost,
        prompt: dto.prompt || null,
        status: 'COMPLETED',
        progress: 100,
        currentStep: 'Completed',
        completedAt: new Date(),
        settings: {
          ...(dto.settings || {}),
          targetLanguage: dto.targetLanguage || 'en',
          result,
        },
      },
      include: { inputFile: true, outputFile: true },
    });

    return job;
  }

  private buildWhisperStubSrt(text: string): string {
    const lines = text.split(/[.!?]+/).filter(Boolean).slice(0, 5);
    let idx = 1;
    let start = 0;
    return lines
      .map((line) => {
        const end = start + 3;
        const srt = `${idx}\n${this.formatSrtTime(start)} --> ${this.formatSrtTime(end)}\n${line.trim()}\n`;
        idx += 1;
        start = end;
        return srt;
      })
      .join('\n');
  }

  private formatSrtTime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const ms = 0;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
  }

  async getVoice(userId: string, id: string) {
    const voice = await this.prisma.voice.findFirst({
      where: {
        id,
        OR: [{ isPublic: true }, { userId }],
      },
    });
    if (!voice) throw new NotFoundException('Voice not found');
    return voice;
  }
}
