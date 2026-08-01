import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JobType } from '@prisma/client';
import { VideosService } from '../videos/videos.service';
import { AiProviderBus } from '../ai-providers/providers/ai-provider.bus';
import { StoryPipelineService } from '../ai-providers/story-pipeline.service';
import { CreateGeneratorJobDto } from './dto/create-generator-job.dto';

@Injectable()
export class GeneratorService {
  constructor(
    private readonly videos: VideosService,
    private readonly bus: AiProviderBus,
    private readonly config: ConfigService,
  ) {}

  providers() {
    return this.bus.listConfigured();
  }

  estimate(jobType: string, settings?: Record<string, unknown>) {
    return { credits: this.bus.estimate(jobType, settings) };
  }

  async create(userId: string, dto: CreateGeneratorJobDto) {
    const jobType = dto.jobType || JobType.TEXT_TO_VIDEO;
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
        },
      });
    }

    const targetDuration = StoryPipelineService.normalizeDuration(dto.duration);
    const segments = StoryPipelineService.segmentPlan(targetDuration).length;
    const perClip =
      this.config.get<number>('credits.imageToVideoCost') ?? 15;
    const voiceCost = this.config.get<number>('credits.voiceCost') ?? 3;
    const prepaidCredits = segments * perClip + voiceCost;
    const characterFileIds = dto.inputFileId ? [dto.inputFileId] : [];

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
      },
    });
  }
}
