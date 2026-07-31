import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { VideosService } from '../videos/videos.service';

@Injectable()
export class FavoritesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly videos: VideosService,
  ) {}

  async list(userId: string) {
    const favorites = await this.prisma.favorite.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        job: {
          include: { template: true, inputFile: true, outputFile: true },
        },
      },
    });
    return {
      items: await Promise.all(
        favorites.map(async (f) => ({
          id: f.id,
          videoJobId: f.jobId,
          createdAt: f.createdAt,
          job: await this.videos.getVideoJob(userId, f.jobId).catch(() => f.job),
        })),
      ),
    };
  }

  async add(userId: string, videoJobId: string) {
    const job = await this.prisma.videoJob.findFirst({
      where: { id: videoJobId, userId },
    });
    if (!job) throw new NotFoundException('Video job not found');

    const existing = await this.prisma.favorite.findUnique({
      where: { userId_jobId: { userId, jobId: videoJobId } },
    });
    if (existing) return existing;

    return this.prisma.favorite.create({
      data: { userId, jobId: videoJobId },
    });
  }

  async remove(userId: string, videoJobId: string) {
    const favorite = await this.prisma.favorite.findUnique({
      where: { userId_jobId: { userId, jobId: videoJobId } },
    });
    if (!favorite) throw new NotFoundException('Favorite not found');
    await this.prisma.favorite.delete({ where: { id: favorite.id } });
    return { ok: true };
  }

  async history(userId: string, page = 1, limit = 20) {
    const result = await this.videos.getVideoJobs(userId, page, limit);
    const jobIds = result.data.map((j: { id: string }) => j.id);
    const downloadCounts = await this.prisma.download.groupBy({
      by: ['videoFileId'],
      _count: { id: true },
      where: {
        userId,
        videoFile: {
          OR: [
            { inputJobs: { some: { id: { in: jobIds } } } },
            { outputJobs: { some: { id: { in: jobIds } } } },
          ],
        },
      },
    });

    const countByFile = new Map(
      downloadCounts.map((d) => [d.videoFileId, d._count.id]),
    );

    const data = result.data.map((job: any) => ({
      ...job,
      downloadsCount:
        (job.outputFile?.id ? countByFile.get(job.outputFile.id) : 0) || 0,
    }));

    return { ...result, data };
  }

  async recordDownload(
    userId: string,
    jobId: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const job = await this.prisma.videoJob.findFirst({
      where: { id: jobId, userId },
      include: { outputFile: true },
    });
    if (!job?.outputFile) {
      throw new NotFoundException('Output file not available for this job');
    }

    return this.prisma.download.create({
      data: {
        userId,
        videoFileId: job.outputFile.id,
        ipAddress,
        userAgent,
      },
    });
  }
}
