import { Injectable } from '@nestjs/common';
import { VideosService } from '../videos/videos.service';
import { AiProviderBus } from '../ai-providers/providers/ai-provider.bus';
import { CreateGeneratorJobDto } from './dto/create-generator-job.dto';
import { JobType } from '@prisma/client';

@Injectable()
export class GeneratorService {
  constructor(
    private readonly videos: VideosService,
    private readonly bus: AiProviderBus,
  ) {}

  providers() {
    return this.bus.listConfigured();
  }

  estimate(jobType: string, settings?: Record<string, unknown>) {
    return { credits: this.bus.estimate(jobType, settings) };
  }

  async create(userId: string, dto: CreateGeneratorJobDto) {
    return this.videos.createVideoJob(userId, {
      jobType: dto.jobType || JobType.TEXT_TO_VIDEO,
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
}
