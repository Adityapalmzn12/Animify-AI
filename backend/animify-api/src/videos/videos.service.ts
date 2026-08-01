import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  Optional,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { resolveStyleProfile } from '../ai-providers/styles.config';
import { CreateVideoJobDto } from './dto/create-video-job.dto';
import { ConfigService } from '@nestjs/config';
import { CreditsService } from '../credits/credits.service';
import { QueueService } from '../queue/queue.service';
import { JobType } from '@prisma/client';

@Injectable()
export class VideosService {
  private readonly logger = new Logger(VideosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly storageService: StorageService,
    private readonly creditsService: CreditsService,
    @Optional() @Inject(forwardRef(() => QueueService))
    private readonly queueService?: QueueService,
  ) {}

  private creditCostFor(jobType: JobType): number {
    const map: Record<string, string> = {
      STYLIZE: 'credits.stylizeCost',
      TEXT_TO_VIDEO: 'credits.textToVideoCost',
      IMAGE_TO_VIDEO: 'credits.imageToVideoCost',
      AVATAR: 'credits.avatarCost',
      DUB: 'credits.dubCost',
      SUBTITLE: 'credits.subtitleCost',
      VOICE: 'credits.voiceCost',
      SCRIPT: 'credits.scriptCost',
      IMAGE_GEN: 'credits.imageGenCost',
      BG_REMOVE: 'credits.bgRemoveCost',
      EDIT_TRIM: 'credits.editCost',
      EDIT_MERGE: 'credits.editCost',
      EDIT_CROP: 'credits.editCost',
      EDIT_FILTER: 'credits.editCost',
      EDIT_EXPORT: 'credits.editCost',
    };
    return this.configService.get<number>(map[jobType] || 'credits.stylizeCost') ?? 5;
  }

  async createVideoJob(userId: string, dto: CreateVideoJobDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { subscription: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const jobType = dto.jobType || JobType.STYLIZE;
    if (
      (jobType === JobType.STYLIZE ||
        jobType === JobType.IMAGE_TO_VIDEO ||
        jobType === JobType.BG_REMOVE) &&
      !dto.inputFileId
    ) {
      throw new BadRequestException('inputFileId is required for this job type');
    }

    if (dto.inputFileId) {
      const inputFile = await this.prisma.videoFile.findUnique({
        where: { id: dto.inputFileId },
      });
      if (!inputFile) throw new NotFoundException('Input file not found');
    }

    if (dto.projectId) {
      const project = await this.prisma.project.findFirst({
        where: { id: dto.projectId, userId },
      });
      if (!project) throw new NotFoundException('Project not found');
    }

    let templateId: string | null = null;
    const styleSlug = dto.templateId || (dto.settings as any)?.style || 'anime';
    if (dto.templateId && this.isUuid(dto.templateId)) {
      const template = await this.prisma.template.findUnique({
        where: { id: dto.templateId },
      });
      templateId = template?.id ?? null;
    }

    const profile = resolveStyleProfile(styleSlug);
    const settings: Record<string, any> = {
      ...(dto.settings || {}),
      style: profile.id,
      styleName: profile.name,
      aspect: dto.settings?.aspect || '9:16',
      duration: dto.settings?.duration || 5,
    };

    const prepaid =
      dto.skipCreditDebit === true || settings.creditsPrepaid === true;
    const scriptedCredits = Number(settings.prepaidCredits) || 0;
    const creditsCost =
      settings.pipeline === 'scripted_story' && scriptedCredits > 0
        ? scriptedCredits
        : this.creditCostFor(jobType);
    if (!prepaid) {
      await this.creditsService.debitCredits(
        userId,
        creditsCost,
        undefined,
        `${jobType} job`,
      );
    }

    const provider = this.configService.get<string>('ai.provider') || 'oss';

    try {
      const videoJob = await this.prisma.videoJob.create({
        data: {
          userId,
          inputFileId: dto.inputFileId || null,
          templateId,
          projectId: dto.projectId || null,
          prompt: dto.prompt || null,
          jobType,
          provider,
          creditsCost,
          status: 'PENDING',
          progress: 0,
          currentStep: `Queued — ${profile.name}`,
          settings,
        },
        include: {
          template: true,
          inputFile: true,
          outputFile: true,
        },
      });

      // Attach jobId to ledger entry via a follow-up debit note is skipped;
      // re-link by updating last debit is optional. Enqueue:
      if (this.queueService) {
        const bullJob = await this.queueService.enqueueAiJob(videoJob.id);
        await this.prisma.videoJob.update({
          where: { id: videoJob.id },
          data: { bullJobId: String(bullJob.id), status: 'QUEUED' },
        });
      } else {
        this.logger.warn('QueueService unavailable — job left PENDING');
      }

      return this.formatVideoJob({ ...videoJob, status: 'QUEUED' });
    } catch (error) {
      await this.creditsService.refundCredits(
        userId,
        creditsCost,
        undefined,
        'Job create failed refund',
      );
      throw error;
    }
  }

  private isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    );
  }

  async getVideoJobs(userId: string, page = 1, limit = 10, status?: string) {
    const where: any = { userId };
    if (status) {
      where.status = status.toUpperCase();
    }

    const [jobs, total] = await Promise.all([
      this.prisma.videoJob.findMany({
        where,
        include: {
          template: true,
          inputFile: true,
          outputFile: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.videoJob.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);
    const data = await Promise.all(
      jobs.map((job) => this.formatVideoJobWithFreshUrls(job)),
    );

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    };
  }

  async getVideoJob(userId: string, jobId: string) {
    const job = await this.prisma.videoJob.findFirst({
      where: { id: jobId, userId },
      include: {
        template: true,
        inputFile: true,
        outputFile: true,
      },
    });

    if (!job) {
      throw new NotFoundException('Video job not found');
    }

    return this.formatVideoJobWithFreshUrls(job);
  }

  async getRecentVideos(userId: string, limit = 5) {
    const jobs = await this.prisma.videoJob.findMany({
      where: { userId },
      include: {
        template: true,
        inputFile: true,
        outputFile: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return Promise.all(jobs.map((job) => this.formatVideoJobWithFreshUrls(job)));
  }

  async cancelVideoJob(userId: string, jobId: string) {
    const job = await this.prisma.videoJob.findFirst({
      where: { id: jobId, userId },
    });

    if (!job) {
      throw new NotFoundException('Video job not found');
    }

    if (!['PENDING', 'QUEUED', 'PROCESSING'].includes(job.status)) {
      throw new BadRequestException('Cannot cancel job in current status');
    }

    await this.queueService?.cancelJob(jobId).catch(() => undefined);

    const updated = await this.prisma.videoJob.update({
      where: { id: jobId },
      data: { status: 'CANCELLED', currentStep: 'Cancelled' },
      include: {
        template: true,
        inputFile: true,
        outputFile: true,
      },
    });

    if (job.creditsCost > 0) {
      await this.creditsService.refundCredits(
        userId,
        job.creditsCost,
        jobId,
        'Job cancelled refund',
      );
    }

    return this.formatVideoJob(updated);
  }

  async deleteVideoJob(userId: string, jobId: string) {
    const job = await this.prisma.videoJob.findFirst({
      where: { id: jobId, userId },
    });

    if (!job) {
      throw new NotFoundException('Video job not found');
    }

    await this.prisma.videoJob.delete({ where: { id: jobId } });

    return { message: 'Video job deleted successfully' };
  }

  async getUploadUrl(userId: string, fileName: string, mimeType: string) {
    const fileId = `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const storageKey = this.storageService.buildStorageKey(
      userId,
      fileId,
      fileName,
    );

    const { uploadUrl, token, expiresIn } =
      await this.storageService.getUploadUrl(storageKey, mimeType);

    return {
      uploadUrl,
      token,
      fileId,
      storageKey,
      expiresIn,
    };
  }

  async confirmUpload(
    userId: string,
    fileId: string,
    fileName: string,
    fileSize: number,
    mimeType: string,
  ) {
    const storageKey = this.storageService.buildStorageKey(
      userId,
      fileId,
      fileName,
    );

    const exists = await this.storageService.fileExists(storageKey);
    if (!exists) {
      throw new BadRequestException(
        'File not found in storage. Upload the file before confirming.',
      );
    }

    const { downloadUrl, expiresAt } =
      await this.storageService.getDownloadUrl(storageKey);

    const videoFile = await this.prisma.videoFile.create({
      data: {
        type: 'INPUT',
        originalName: fileName,
        mimeType,
        sizeBytes: BigInt(fileSize),
        storageKey,
        downloadUrl,
        downloadUrlExpiresAt: expiresAt,
      },
    });

    return {
      id: videoFile.id,
      fileName: videoFile.originalName,
      fileSize: Number(videoFile.sizeBytes),
    };
  }

  private async formatVideoJobWithFreshUrls(job: any) {
    const refreshFile = async (file: any) => {
      if (!file?.storageKey) return file;
      const expired =
        !file.downloadUrlExpiresAt ||
        new Date(file.downloadUrlExpiresAt).getTime() < Date.now() + 60_000;
      if (!expired && file.downloadUrl) return file;

      try {
        const { downloadUrl, expiresAt } =
          await this.storageService.getDownloadUrl(file.storageKey);
        const updated = await this.prisma.videoFile.update({
          where: { id: file.id },
          data: {
            downloadUrl,
            downloadUrlExpiresAt: expiresAt,
          },
        });
        return updated;
      } catch (error) {
        this.logger.warn(`Failed to refresh download URL for ${file.id}`, error);
        return file;
      }
    };

    const [inputFile, outputFile] = await Promise.all([
      refreshFile(job.inputFile),
      refreshFile(job.outputFile),
    ]);

    return this.formatVideoJob({ ...job, inputFile, outputFile });
  }

  private formatVideoJob(job: any) {
    const settings = (job.settings || {}) as Record<string, any>;
    const profile = resolveStyleProfile(settings.style);
    const styleName = settings.styleName || profile.name;

    return {
      id: job.id,
      jobType: job.jobType || 'STYLIZE',
      provider: job.provider || 'oss',
      creditsCost: job.creditsCost || 0,
      projectId: job.projectId || null,
      prompt: job.prompt || null,
      status: String(job.status).toLowerCase(),
      progress: job.progress || 0,
      // Never expose segment/stitch details for scripted story jobs
      currentStep:
        settings.hidePipelineDetails || settings.pipeline === 'scripted_story'
          ? job.status === 'COMPLETED'
            ? 'Completed'
            : job.status === 'FAILED'
              ? 'Failed'
              : 'Processing'
          : job.currentStep,
      errorMessage: job.errorMessage,
      settings: {
        removeBackground: settings.removeBackground ?? true,
        backgroundType: settings.backgroundType ?? 'transparent',
        backgroundValue: settings.backgroundValue,
        enhanceFace: settings.enhanceFace ?? true,
        enhanceAudio: settings.enhanceAudio ?? true,
        generateSubtitles: settings.generateSubtitles ?? true,
        outputQuality: settings.outputQuality ?? 'hd',
        style: profile.id,
        styleName,
        aspect: settings.aspect,
        duration: settings.duration || settings.targetDuration,
        provider: settings.provider || job.provider,
      },
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt?.toISOString?.() ?? job.updatedAt,
      startedAt: job.startedAt?.toISOString?.() ?? job.startedAt,
      completedAt: job.completedAt?.toISOString?.() ?? job.completedAt,
      template: job.template
        ? {
            id: job.template.id,
            name: job.template.name,
            thumbnailUrl: job.template.thumbnailUrl,
          }
        : {
            id: profile.id,
            name: styleName,
            thumbnailUrl: null,
          },
      inputFile: job.inputFile
        ? {
            id: job.inputFile.id,
            fileName: job.inputFile.originalName,
            fileSize: Number(job.inputFile.sizeBytes),
            url: job.inputFile.downloadUrl,
            thumbnailUrl: null,
            durationSeconds: job.inputFile.durationSeconds
              ? Number(job.inputFile.durationSeconds)
              : null,
          }
        : null,
      outputFile: job.outputFile
        ? {
            id: job.outputFile.id,
            fileName: job.outputFile.originalName,
            fileSize: Number(job.outputFile.sizeBytes),
            url: job.outputFile.downloadUrl,
            thumbnailUrl: null,
            durationSeconds: job.outputFile.durationSeconds
              ? Number(job.outputFile.durationSeconds)
              : null,
          }
        : null,
    };
  }
}
