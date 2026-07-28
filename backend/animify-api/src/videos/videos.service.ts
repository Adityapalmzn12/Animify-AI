import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVideoJobDto } from './dto/create-video-job.dto';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class VideosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async createVideoJob(userId: string, dto: CreateVideoJobDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { subscription: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify input file exists
    const inputFile = await this.prisma.videoFile.findUnique({
      where: { id: dto.inputFileId },
    });

    if (!inputFile) {
      throw new NotFoundException('Input file not found');
    }

    const videoJob = await this.prisma.videoJob.create({
      data: {
        userId,
        inputFileId: dto.inputFileId,
        templateId: dto.templateId || null,
        status: 'PENDING',
        settings: dto.settings || {},
      },
      include: {
        template: true,
        inputFile: true,
        outputFile: true,
      },
    });

    return this.formatVideoJob(videoJob);
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

    return {
      data: jobs.map((job) => this.formatVideoJob(job)),
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

    return this.formatVideoJob(job);
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

    return jobs.map((job) => this.formatVideoJob(job));
  }

  async cancelVideoJob(userId: string, jobId: string) {
    const job = await this.prisma.videoJob.findFirst({
      where: { id: jobId, userId },
    });

    if (!job) {
      throw new NotFoundException('Video job not found');
    }

    if (!['PENDING', 'PROCESSING'].includes(job.status)) {
      throw new BadRequestException('Cannot cancel job in current status');
    }

    const updated = await this.prisma.videoJob.update({
      where: { id: jobId },
      data: { status: 'CANCELLED' },
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
    
    return {
      uploadUrl: `https://storage.example.com/upload/${fileId}`,
      fileId,
      expiresIn: this.configService.get<number>('storage.uploadUrlExpiry') ?? 3600,
    };
  }

  async confirmUpload(userId: string, fileId: string, fileName: string, fileSize: number, mimeType: string) {
    const videoFile = await this.prisma.videoFile.create({
      data: {
        type: 'INPUT',
        originalName: fileName,
        mimeType,
        sizeBytes: BigInt(fileSize),
        storageKey: fileId,
        downloadUrl: `https://storage.example.com/files/${fileId}`,
      },
    });

    return {
      id: videoFile.id,
      fileName: videoFile.originalName,
      fileSize: Number(videoFile.sizeBytes),
    };
  }

  private formatVideoJob(job: any) {
    return {
      id: job.id,
      status: job.status.toLowerCase(),
      progress: job.progress || 0,
      errorMessage: job.errorMessage,
      settings: job.settings || {},
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
      startedAt: job.startedAt?.toISOString(),
      completedAt: job.completedAt?.toISOString(),
      template: job.template ? {
        id: job.template.id,
        name: job.template.name,
        thumbnailUrl: job.template.thumbnailUrl,
      } : null,
      inputFile: job.inputFile ? {
        id: job.inputFile.id,
        fileName: job.inputFile.originalName,
        fileSize: Number(job.inputFile.sizeBytes),
        url: job.inputFile.downloadUrl,
        thumbnailUrl: null,
      } : null,
      outputFile: job.outputFile ? {
        id: job.outputFile.id,
        fileName: job.outputFile.originalName,
        fileSize: Number(job.outputFile.sizeBytes),
        url: job.outputFile.downloadUrl,
        thumbnailUrl: null,
      } : null,
    };
  }
}
