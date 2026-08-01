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
import { StoryPipelineService } from '../ai-providers/story-pipeline.service';
import { PptxService } from './pptx.service';

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
    private readonly pptx: PptxService,
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
    const isScriptedVideo =
      mode === CreativeMode.PROMPT_TO_VIDEO || mode === CreativeMode.STORY_REEL;
    const targetDuration =
      isScriptedVideo || willAnimate
        ? StoryPipelineService.normalizeDuration(dto.duration)
        : undefined;
    const segmentCount = targetDuration
      ? StoryPipelineService.segmentPlan(targetDuration).length
      : 1;
    const perClip =
      this.config.get<number>('credits.imageToVideoCost') ?? 15;
    const voiceCost = this.config.get<number>('credits.voiceCost') ?? 3;
    const videoBundleCost =
      isScriptedVideo || willAnimate
        ? segmentCount * perClip + voiceCost
        : 0;
    const totalCost = isScriptedVideo
      ? videoBundleCost
      : imageCost + (willAnimate ? videoBundleCost : 0);

    await this.credits.debitCredits(
      userId,
      totalCost,
      undefined,
      `Studio ${mode}${willAnimate ? '+animate' : ''}`,
    );

    const enhanced = this.buildPrompt(mode, dto);

    try {
      if (isScriptedVideo) {
        return this.createScriptedVideoJob(
          userId,
          dto,
          enhanced,
          totalCost,
          mode,
          targetDuration!,
        );
      }

      if (mode === CreativeMode.PPT) {
        return this.createPptJob(userId, dto, totalCost);
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

      // Optional: animate still → timed video + voice (credits already included)
      if (willAnimate && image.fileId && targetDuration) {
        const videoJob = await this.createScriptedVideoJob(
          userId,
          {
            ...dto,
            characterImageFileIds: [
              image.fileId,
              ...(dto.characterImageFileIds || []),
            ],
            addAudio: true,
            duration: targetDuration,
          },
          enhanced,
          videoBundleCost,
          mode,
          targetDuration,
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

  /** Long-form scripted video: segments + required voice, billed once up front. */
  private createScriptedVideoJob(
    userId: string,
    dto: CreateStudioDto,
    enhanced: string,
    cost: number,
    mode: CreativeMode,
    targetDuration: 15 | 30 | 59,
  ) {
    const characterFileIds = [...(dto.characterImageFileIds || [])];
    return this.videos.createVideoJob(userId, {
      jobType: characterFileIds.length
        ? JobType.IMAGE_TO_VIDEO
        : JobType.TEXT_TO_VIDEO,
      prompt: dto.prompt,
      projectId: dto.projectId,
      inputFileId: characterFileIds[0],
      skipCreditDebit: true,
      settings: {
        mode,
        pipeline: 'scripted_story',
        enhancedPrompt: enhanced,
        aspect: dto.aspect || '9:16',
        style: dto.style || 'cinematic',
        duration: targetDuration,
        targetDuration,
        characterFileIds,
        addAudio: true,
        creditsPrepaid: true,
        prepaidCredits: cost,
        hidePipelineDetails: true,
      },
    });
  }

  private async createPptJob(
    userId: string,
    dto: CreateStudioDto,
    cost: number,
  ) {
    const outline = await this.pptx.buildOutline(dto.prompt, dto.brandName);
    const buffer = await this.pptx.renderPptx(outline.title, outline.slides);
    const fileName = `${(outline.title || 'presentation')
      .replace(/[^a-z0-9]+/gi, '_')
      .slice(0, 40)}.pptx`;
    const storageKey = this.storage.buildStorageKey(
      userId,
      `ppt_${Date.now()}`,
      fileName,
    );
    await this.storage.uploadBuffer(
      storageKey,
      buffer,
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    );
    const { downloadUrl, expiresAt } =
      await this.storage.getDownloadUrl(storageKey);
    const file = await this.prisma.videoFile.create({
      data: {
        type: 'OUTPUT',
        originalName: fileName,
        mimeType:
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        sizeBytes: BigInt(buffer.length),
        storageKey,
        downloadUrl,
        downloadUrlExpiresAt: expiresAt,
      },
    });
    const job = await this.prisma.videoJob.create({
      data: {
        userId,
        projectId: dto.projectId || null,
        jobType: JobType.SCRIPT,
        provider: 'pptxgenjs',
        creditsCost: cost,
        prompt: dto.prompt,
        status: 'COMPLETED',
        progress: 100,
        currentStep: 'Completed',
        completedAt: new Date(),
        outputFileId: file.id,
        settings: {
          mode: CreativeMode.PPT,
          brandName: dto.brandName,
          resultUrl: downloadUrl,
          slideCount: outline.slides.length,
          title: outline.title,
        },
      },
      include: { outputFile: true },
    });
    return this.format(job);
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
      // Default quote for 30s scripted story (~3 clips)
      const perClip =
        this.config.get<number>('credits.imageToVideoCost') ?? 15;
      return perClip * 3 + (this.config.get<number>('credits.voiceCost') ?? 3);
    }
    if (mode === CreativeMode.BRAND_KIT) {
      return (this.config.get<number>('credits.imageGenCost') ?? 4) * 2;
    }
    if (mode === CreativeMode.PPT) {
      return this.config.get<number>('credits.scriptCost') ?? 8;
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
      [CreativeMode.PPT]: {
        title: 'PPT Maker',
        subtitle: 'AI PowerPoint decks (.pptx)',
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
