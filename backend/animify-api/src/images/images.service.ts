import {
  Injectable,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JobType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreditsService } from '../credits/credits.service';
import { PricingService } from '../credits/pricing.service';
import { VideosService } from '../videos/videos.service';
import { AiProviderBus } from '../ai-providers/providers/ai-provider.bus';
import { StorageService } from '../storage/storage.service';
import { BgRemoveDto, GenerateImageDto, ImageStyle } from './dto/images.dto';

const STYLE_HINTS: Record<ImageStyle, string> = {
  [ImageStyle.REALISTIC]: 'photorealistic, natural lighting, ultra detailed',
  [ImageStyle.ANIME]: 'premium anime illustration, vibrant, detailed eyes',
  [ImageStyle.CARTOON]: 'modern cartoon style, bold shapes, clean lines',
  [ImageStyle.PIXAR]: 'Pixar 3D animation style, soft subsurface lighting',
  [ImageStyle.GHIBLI]:
    'Studio Ghibli inspired, soft watercolor, whimsical Miyazaki aesthetic',
  [ImageStyle.THREE_D]: 'cinematic 3D render, octane style, sharp materials',
};

@Injectable()
export class ImagesService {
  private readonly logger = new Logger(ImagesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly credits: CreditsService,
    private readonly pricing: PricingService,
    private readonly videos: VideosService,
    private readonly bus: AiProviderBus,
    private readonly storage: StorageService,
  ) {}

  async generate(userId: string, dto: GenerateImageDto) {
    const cost = await this.pricing.costFor('IMAGE_GEN', 4);
    await this.credits.debitCredits(userId, cost, undefined, 'Image generation');

    const stylePrompt = `${dto.prompt}, ${STYLE_HINTS[dto.style] || dto.style}, high quality, commercial ready`;

    try {
      const result = await this.bus.submit({
        jobId: `img_${Date.now()}`,
        jobType: 'IMAGE_GEN',
        prompt: stylePrompt,
        settings: { style: dto.style },
      });

      if (result.status !== 'completed' || !result.resultUrl) {
        throw new Error('Provider returned no image URL');
      }

      let buffer: Buffer;
      let mimeType = 'image/png';
      if (result.resultUrl.startsWith('data:')) {
        const match = /^data:([^;]+);base64,(.+)$/.exec(result.resultUrl);
        if (!match) throw new Error('Invalid base64 image');
        mimeType = match[1];
        buffer = Buffer.from(match[2], 'base64');
      } else {
        const imgRes = await fetch(result.resultUrl);
        if (!imgRes.ok) throw new Error('Failed to download image');
        buffer = Buffer.from(await imgRes.arrayBuffer());
        mimeType = imgRes.headers.get('content-type') || 'image/png';
      }

      const ext = mimeType.includes('jpeg') ? 'jpg' : 'png';
      const fileName = `${dto.style}_${Date.now()}.${ext}`;
      const storageKey = this.storage.buildStorageKey(
        userId,
        `img_${Date.now()}`,
        fileName,
      );
      await this.storage.uploadBuffer(storageKey, buffer, mimeType);
      const { downloadUrl, expiresAt } =
        await this.storage.getDownloadUrl(storageKey);

      const outputFile = await this.prisma.videoFile.create({
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

      const job = await this.prisma.videoJob.create({
        data: {
          userId,
          projectId: dto.projectId || null,
          jobType: JobType.IMAGE_GEN,
          provider: result.provider,
          creditsCost: cost,
          prompt: dto.prompt,
          status: 'COMPLETED',
          progress: 100,
          currentStep: 'Completed',
          completedAt: new Date(),
          outputFileId: outputFile.id,
          settings: {
            style: dto.style,
            resultUrl: downloadUrl,
          },
        },
        include: { outputFile: true },
      });

      return {
        id: job.id,
        status: 'completed',
        style: dto.style,
        resultUrl: downloadUrl,
        provider: result.provider,
        creditsCost: cost,
      };
    } catch (error) {
      await this.credits.refundCredits(
        userId,
        cost,
        undefined,
        'Image gen failed refund',
      );
      const message =
        error instanceof Error ? error.message : 'Image generation failed';
      this.logger.error(message);
      throw new BadRequestException(message);
    }
  }

  bgRemove(userId: string, dto: BgRemoveDto) {
    return this.videos.createVideoJob(userId, {
      jobType: JobType.BG_REMOVE,
      inputFileId: dto.inputFileId,
      projectId: dto.projectId,
      settings: { removeBackground: true },
    });
  }

  async list(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where = { userId, jobType: JobType.IMAGE_GEN };
    const [items, total] = await Promise.all([
      this.prisma.videoJob.findMany({
        where,
        include: { outputFile: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.videoJob.count({ where }),
    ]);
    return {
      items: items.map((j) => ({
        id: j.id,
        prompt: j.prompt,
        style: (j.settings as any)?.style,
        resultUrl: j.outputFile?.downloadUrl || (j.settings as any)?.resultUrl,
        status: String(j.status).toLowerCase(),
        createdAt: j.createdAt,
      })),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }
}
