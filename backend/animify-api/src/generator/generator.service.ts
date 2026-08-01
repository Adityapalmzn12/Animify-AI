import { Injectable } from '@nestjs/common';
import { JobType } from '@prisma/client';
import { VideosService } from '../videos/videos.service';
import { AiProviderBus } from '../ai-providers/providers/ai-provider.bus';
import { StoryPipelineService } from '../ai-providers/story-pipeline.service';
import { PricingService } from '../credits/pricing.service';
import { normalizeQualityTier } from '../credits/quality-tiers';
import { CreateGeneratorJobDto } from './dto/create-generator-job.dto';

@Injectable()
export class GeneratorService {
  constructor(
    private readonly videos: VideosService,
    private readonly bus: AiProviderBus,
    private readonly pricing: PricingService,
  ) {}

  providers() {
    return this.bus.listConfigured();
  }

  async estimate(jobType: string, settings?: Record<string, unknown>) {
    const duration = StoryPipelineService.normalizeDuration(
      Number(settings?.duration) || undefined,
    );
    const tier = normalizeQualityTier(
      (settings?.qualityTier as string) || 'economy',
    );
    if (
      jobType === JobType.TEXT_TO_VIDEO ||
      jobType === JobType.IMAGE_TO_VIDEO
    ) {
      return {
        credits: await this.pricing.storyCredits(duration, tier),
        qualityTier: tier,
        duration,
      };
    }
    return {
      credits: await this.pricing.imageCredits(tier),
      qualityTier: tier,
    };
  }

  async create(userId: string, dto: CreateGeneratorJobDto) {
    const jobType = dto.jobType || JobType.TEXT_TO_VIDEO;
    const qualityTier = normalizeQualityTier(dto.qualityTier || 'economy');
    const tier = await this.pricing.getTier(qualityTier);
    const isVideo =
      jobType === JobType.TEXT_TO_VIDEO || jobType === JobType.IMAGE_TO_VIDEO;

    if (!isVideo) {
      return this.videos.createVideoJob(userId, {
        jobType,
        prompt: dto.prompt,
        inputFileId: dto.inputFileId,
        projectId: dto.projectId,
        templateId: dto.style,
        settings: {
          ...(dto.settings || {}),
          aspect: dto.aspect || '9:16',
          style: dto.style || 'anime',
          qualityTier,
          imageModel: tier.imageModel,
        },
      });
    }

    const targetDuration = StoryPipelineService.normalizeDuration(dto.duration);
    const prepaidCredits = await this.pricing.storyCredits(
      targetDuration,
      qualityTier,
    );
    const characterFileIds = dto.inputFileId ? [dto.inputFileId] : [];
    const videoModel =
      characterFileIds.length > 0 ? tier.videoModelI2v : tier.videoModelT2v;

    return this.videos.createVideoJob(userId, {
      jobType,
      prompt: dto.prompt,
      inputFileId: dto.inputFileId,
      projectId: dto.projectId,
      templateId: dto.style,
      settings: {
        ...(dto.settings || {}),
        aspect: dto.aspect || '9:16',
        style: dto.style || 'anime',
        pipeline: 'scripted_story',
        duration: targetDuration,
        targetDuration,
        addAudio: dto.addAudio !== false,
        characterFileIds,
        prepaidCredits,
        hidePipelineDetails: true,
        qualityTier,
        videoModel,
        imageModel: tier.imageModel,
        engine: tier.engine,
      },
    });
  }
}
