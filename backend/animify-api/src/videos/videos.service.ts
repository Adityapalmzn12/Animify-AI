import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { AiStylizeService } from '../ai-providers/ai-stylize.service';
import { resolveStyleProfile } from '../ai-providers/styles.config';
import { CreateVideoJobDto } from './dto/create-video-job.dto';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class VideosService {
  private readonly logger = new Logger(VideosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly storageService: StorageService,
    private readonly aiStylizeService: AiStylizeService,
  ) {}

  async createVideoJob(userId: string, dto: CreateVideoJobDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { subscription: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const inputFile = await this.prisma.videoFile.findUnique({
      where: { id: dto.inputFileId },
    });

    if (!inputFile) {
      throw new NotFoundException('Input file not found');
    }

    // templateId from the app may be a style slug (anime/cartoon), not a UUID.
    let templateId: string | null = null;
    const styleSlug = dto.templateId || (dto.settings as any)?.style || 'anime';
    if (dto.templateId && this.isUuid(dto.templateId)) {
      const template = await this.prisma.template.findUnique({
        where: { id: dto.templateId },
      });
      templateId = template?.id ?? null;
    }

    const profile = resolveStyleProfile(styleSlug);
    const settings = {
      ...(dto.settings || {}),
      style: profile.id,
      styleName: profile.name,
    };

    const videoJob = await this.prisma.videoJob.create({
      data: {
        userId,
        inputFileId: dto.inputFileId,
        templateId,
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

    void this.runProcessingPipeline(videoJob.id);

    return this.formatVideoJob(videoJob);
  }

  private isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    );
  }

  private async updateJobProgress(
    jobId: string,
    data: {
      status?: 'PENDING' | 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
      progress?: number;
      currentStep?: string;
      startedAt?: Date;
    },
  ) {
    const current = await this.prisma.videoJob.findUnique({ where: { id: jobId } });
    if (!current || current.status === 'CANCELLED') {
      return false;
    }
    await this.prisma.videoJob.update({
      where: { id: jobId },
      data: {
        ...data,
        startedAt: data.startedAt ?? current.startedAt ?? new Date(),
      },
    });
    return true;
  }

  private async runProcessingPipeline(jobId: string) {
    try {
      const job = await this.prisma.videoJob.findUnique({
        where: { id: jobId },
        include: { inputFile: true },
      });

      if (!job || !job.inputFile) {
        return;
      }

      const settings = (job.settings || {}) as Record<string, any>;
      const profile = resolveStyleProfile(settings.style);

      if (!(await this.updateJobProgress(jobId, {
        status: 'QUEUED',
        progress: 5,
        currentStep: `Queued — ${profile.name}`,
      }))) {
        return;
      }

      if (!(await this.updateJobProgress(jobId, {
        status: 'PROCESSING',
        progress: 15,
        currentStep: 'Preparing source video',
      }))) {
        return;
      }

      const { downloadUrl: inputUrl } =
        await this.storageService.getDownloadUrl(job.inputFile.storageKey);

      if (!(await this.updateJobProgress(jobId, {
        status: 'PROCESSING',
        progress: 25,
        currentStep: settings.removeBackground
          ? 'BG remove'
          : `Style Wan — ${profile.name}`,
      }))) {
        return;
      }

      const stylized = await this.aiStylizeService.stylizeVideo({
        jobId,
        videoUrl: inputUrl,
        style: profile.id,
        originalName: job.inputFile.originalName,
        settings,
        onProgress: async (progress, step) => {
          await this.updateJobProgress(jobId, {
            status: 'PROCESSING',
            progress,
            currentStep: step,
          });
        },
      });

      if (!(await this.updateJobProgress(jobId, {
        status: 'PROCESSING',
        progress: 90,
        currentStep: 'Finalize',
      }))) {
        return;
      }

      const outputKey = this.storageService.buildStorageKey(
        job.userId,
        `out_${Date.now()}`,
        stylized.fileName,
      );

      await this.storageService.uploadBuffer(
        outputKey,
        stylized.buffer,
        stylized.mimeType,
      );

      if (!(await this.updateJobProgress(jobId, {
        status: 'PROCESSING',
        progress: 95,
        currentStep: 'Saving animated video',
      }))) {
        return;
      }

      const { downloadUrl, expiresAt } =
        await this.storageService.getDownloadUrl(outputKey);

      const outputFile = await this.prisma.videoFile.create({
        data: {
          type: 'OUTPUT',
          originalName: stylized.fileName,
          mimeType: stylized.mimeType,
          sizeBytes: BigInt(stylized.buffer.length),
          storageKey: outputKey,
          downloadUrl,
          downloadUrlExpiresAt: expiresAt,
          durationSeconds: job.inputFile.durationSeconds,
          width: job.inputFile.width,
          height: job.inputFile.height,
        },
      });

      await this.prisma.videoJob.update({
        where: { id: jobId },
        data: {
          status: 'COMPLETED',
          progress: 100,
          currentStep: `Completed — ${profile.name} (${stylized.engine || stylized.provider})`,
          outputFileId: outputFile.id,
          completedAt: new Date(),
          settings: {
            ...settings,
            style: profile.id,
            styleName: profile.name,
            provider: stylized.provider,
            engine: stylized.engine,
          },
        },
      });

      this.logger.log(
        `Video job ${jobId} completed with style=${profile.id} provider=${stylized.provider} engine=${stylized.engine}`,
      );
    } catch (error) {
      this.logger.error(`Video job ${jobId} failed`, error);
      await this.prisma.videoJob.update({
        where: { id: jobId },
        data: {
          status: 'FAILED',
          currentStep: 'Failed',
          errorMessage:
            error instanceof Error ? error.message : 'Processing failed',
        },
      });
    }
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

    const updated = await this.prisma.videoJob.update({
      where: { id: jobId },
      data: { status: 'CANCELLED', currentStep: 'Cancelled' },
      include: {
        template: true,
        inputFile: true,
        outputFile: true,
      },
    });

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
      status: String(job.status).toLowerCase(),
      progress: job.progress || 0,
      currentStep: job.currentStep,
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
        provider: settings.provider,
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
