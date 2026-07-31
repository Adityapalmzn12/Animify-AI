import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JobType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreditsService } from '../credits/credits.service';
import { StorageService } from '../storage/storage.service';
import { AiProviderBus } from '../ai-providers/providers/ai-provider.bus';
import { VideosService } from '../videos/videos.service';
import {
  CreativeMode,
  CreateStudioDto,
  STYLE_PROMPTS,
} from './dto/studio.dto';

@Injectable()
export class StudioService {
  private readonly logger = new Logger(StudioService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly credits: CreditsService,
    private readonly storage: StorageService,
    private readonly bus: AiProviderBus,
    private readonly videos: VideosService,
  ) {}

  modes() {
    return Object.values(CreativeMode).map((mode) => ({
      mode,
      ...this.modeMeta(mode),
      credits: this.costFor(mode),
    }));
  }

  async create(userId: string, dto: CreateStudioDto) {
    const mode = dto.mode;
    // Auto-top-up for empty wallets so launch users can generate immediately
    await this.ensureLaunchCredits(userId);

    const imageCost = this.costFor(mode);
    const willAnimate =
      !!dto.animate &&
      mode !== CreativeMode.PROMPT_TO_VIDEO &&
      mode !== CreativeMode.STORY_REEL;
    const animateCost = willAnimate
      ? this.config.get<number>('credits.imageToVideoCost') ?? 15
      : 0;
    const totalCost =
      mode === CreativeMode.PROMPT_TO_VIDEO || mode === CreativeMode.STORY_REEL
        ? imageCost
        : imageCost + animateCost;

    await this.credits.debitCredits(
      userId,
      totalCost,
      undefined,
      `Studio ${mode}${willAnimate ? '+animate' : ''}`,
    );

    const enhanced = this.buildPrompt(mode, dto);

    try {
      if (mode === CreativeMode.PROMPT_TO_VIDEO || mode === CreativeMode.STORY_REEL) {
        return this.createVideoJob(userId, dto, enhanced, totalCost, mode);
      }

      // Image-first creative tools
      const image = await this.generateAndStoreImage(userId, enhanced, mode);
      const job = await this.prisma.videoJob.create({
        data: {
          userId,
          projectId: dto.projectId || null,
          jobType: JobType.IMAGE_GEN,
          provider: image.provider,
          creditsCost: imageCost,
          prompt: dto.prompt,
          status: 'COMPLETED',
          progress: 100,
          currentStep: 'Completed',
          completedAt: new Date(),
          outputFileId: image.fileId,
          settings: {
            mode,
            brandName: dto.brandName,
            style: dto.style || mode,
            resultUrl: image.url,
            enhancedPrompt: enhanced,
          },
        },
        include: { outputFile: true },
      });

      // Optional: animate still → video (credits already included above)
      if (willAnimate && image.fileId) {
        const videoJob = await this.createAnimateJob(
          userId,
          image.fileId,
          enhanced,
          dto,
          mode,
          animateCost,
        );
        return { imageJob: this.format(job), videoJob, mode };
      }

      return this.format(job);
    } catch (error) {
      await this.credits.refundCredits(
        userId,
        totalCost,
        undefined,
        'Studio failed refund',
      );
      const message = error instanceof Error ? error.message : 'Studio generation failed';
      this.logger.error(message);
      throw new BadRequestException(message);
    }
  }

  private async ensureLaunchCredits(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return;
    if (user.creditBalance > 0) return;
    const grant = this.config.get<number>('credits.signupGrant') ?? 50;
    const topUp = Math.max(grant, 200);
    await this.credits.grantCredits(
      userId,
      topUp,
      'Welcome credits (auto top-up)',
    );
  }

  /** Create I2V job without a second debit (studio already charged). */
  private createAnimateJob(
    userId: string,
    inputFileId: string,
    prompt: string,
    dto: CreateStudioDto,
    mode: CreativeMode,
    _creditsCost: number,
  ) {
    return this.videos.createVideoJob(userId, {
      jobType: JobType.IMAGE_TO_VIDEO,
      inputFileId,
      prompt,
      projectId: dto.projectId,
      skipCreditDebit: true,
      settings: {
        style: dto.style || 'anime',
        aspect: dto.aspect || '9:16',
        fromStudioMode: mode,
        creditsPrepaid: true,
      },
    });
  }

  private async createVideoJob(
    userId: string,
    dto: CreateStudioDto,
    enhanced: string,
    cost: number,
    mode: CreativeMode,
  ) {
    // VideosService will debit again — refund our studio debit and let videos own billing
    await this.credits.refundCredits(userId, cost, undefined, 'Studio video handoff');
    return this.videos.createVideoJob(userId, {
      jobType: JobType.TEXT_TO_VIDEO,
      prompt: enhanced,
      projectId: dto.projectId,
      settings: {
        mode,
        aspect: dto.aspect || '9:16',
        style: dto.style || 'cinematic',
        duration: dto.duration || 5,
      },
    });
  }

  private async generateAndStoreImage(
    userId: string,
    prompt: string,
    mode: CreativeMode,
  ) {
    const result = await this.bus.submit({
      jobId: `studio_${Date.now()}`,
      jobType: 'IMAGE_GEN',
      prompt,
      settings: { mode },
    });

    if (result.status !== 'completed' || !result.resultUrl) {
      throw new Error(
        result.metadata?.error
          ? String(result.metadata.error)
          : 'Image provider returned no result. Check OPENAI_API_KEY / FAL_API_KEY.',
      );
    }

    let buffer: Buffer;
    let mimeType = 'image/png';
    if (result.resultUrl.startsWith('data:')) {
      const match = /^data:([^;]+);base64,(.+)$/.exec(result.resultUrl);
      if (!match) throw new Error('Invalid base64 image from provider');
      mimeType = match[1];
      buffer = Buffer.from(match[2], 'base64');
    } else {
      const imgRes = await fetch(result.resultUrl);
      if (!imgRes.ok) throw new Error('Failed to download generated image');
      buffer = Buffer.from(await imgRes.arrayBuffer());
      mimeType = imgRes.headers.get('content-type') || 'image/png';
    }
    const ext =
      mimeType.includes('jpeg') || mimeType.includes('jpg') ? 'jpg' : 'png';
    const fileName = `${mode}_${Date.now()}.${ext}`;
    const storageKey = this.storage.buildStorageKey(
      userId,
      `studio_${Date.now()}`,
      fileName,
    );
    await this.storage.uploadBuffer(storageKey, buffer, mimeType);
    const { downloadUrl, expiresAt } =
      await this.storage.getDownloadUrl(storageKey);

    const file = await this.prisma.videoFile.create({
      data: {
        type: 'IMAGE',
        originalName: fileName,
        mimeType,
        sizeBytes: BigInt(buffer.length),
        storageKey,
        downloadUrl,
        downloadUrlExpiresAt: expiresAt,
      },
    });

    return {
      fileId: file.id,
      url: downloadUrl,
      provider: result.provider,
    };
  }

  private buildPrompt(mode: CreativeMode, dto: CreateStudioDto): string {
    const base = STYLE_PROMPTS[mode] || '';
    const brand = dto.brandName ? ` Brand: ${dto.brandName}.` : '';
    const colors = dto.colors?.length ? ` Colors: ${dto.colors.join(', ')}.` : '';
    const extra = dto.style ? ` Extra style: ${dto.style}.` : '';
    return `${base} ${dto.prompt}.${brand}${colors}${extra} High quality, commercial-ready, sharp details.`.trim();
  }

  private costFor(mode: CreativeMode): number {
    if (mode === CreativeMode.PROMPT_TO_VIDEO || mode === CreativeMode.STORY_REEL) {
      return this.config.get<number>('credits.textToVideoCost') ?? 20;
    }
    if (mode === CreativeMode.BRAND_KIT) {
      return (this.config.get<number>('credits.imageGenCost') ?? 4) * 2;
    }
    return this.config.get<number>('credits.imageGenCost') ?? 4;
  }

  private modeMeta(mode: CreativeMode) {
    const map: Record<CreativeMode, { title: string; subtitle: string }> = {
      [CreativeMode.LOGO]: {
        title: 'Logo Maker',
        subtitle: 'Company & startup logos',
      },
      [CreativeMode.FASHION]: {
        title: 'Fashion Designer',
        subtitle: 'Designer clothing concepts',
      },
      [CreativeMode.GHIBLI]: {
        title: 'Ghibli Studio',
        subtitle: 'Studio Ghibli–style art',
      },
      [CreativeMode.ANIME]: {
        title: 'Anime Art',
        subtitle: 'Anime character & scenes',
      },
      [CreativeMode.PRODUCT]: {
        title: 'Product Shot',
        subtitle: 'E‑commerce product visuals',
      },
      [CreativeMode.THUMBNAIL]: {
        title: 'Thumbnail Pro',
        subtitle: 'YouTube / Reel thumbnails',
      },
      [CreativeMode.BRAND_KIT]: {
        title: 'Brand Kit',
        subtitle: 'Logo-ready brand visual',
      },
      [CreativeMode.POSTER]: {
        title: 'Poster / Ad',
        subtitle: 'Marketing posters & ads',
      },
      [CreativeMode.PROMPT_TO_VIDEO]: {
        title: 'Prompt → Video',
        subtitle: 'AI text to video',
      },
      [CreativeMode.STORY_REEL]: {
        title: 'Story Reel',
        subtitle: 'Cinematic short from prompt',
      },
      [CreativeMode.CHARACTER]: {
        title: 'Character IP',
        subtitle: 'Mascot & character design',
      },
      [CreativeMode.INTERIOR]: {
        title: 'Space Designer',
        subtitle: 'Interior / room concepts',
      },
    };
    return map[mode];
  }

  private format(job: any) {
    return {
      id: job.id,
      mode: job.settings?.mode,
      status: String(job.status).toLowerCase(),
      prompt: job.prompt,
      resultUrl: job.outputFile?.downloadUrl || job.settings?.resultUrl,
      provider: job.provider,
      creditsCost: job.creditsCost,
      createdAt: job.createdAt,
    };
  }
}
