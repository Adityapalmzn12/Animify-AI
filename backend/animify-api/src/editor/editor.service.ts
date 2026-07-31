import { BadRequestException, Injectable } from '@nestjs/common';
import { JobType } from '@prisma/client';
import { VideosService } from '../videos/videos.service';
import { EditorOpDto } from './dto/editor.dto';

type EditOp = 'trim' | 'merge' | 'crop' | 'filter' | 'export';

const OP_TO_JOB: Record<EditOp, JobType> = {
  trim: JobType.EDIT_TRIM,
  merge: JobType.EDIT_MERGE,
  crop: JobType.EDIT_CROP,
  filter: JobType.EDIT_FILTER,
  export: JobType.EDIT_EXPORT,
};

@Injectable()
export class EditorService {
  constructor(private readonly videos: VideosService) {}

  run(userId: string, op: EditOp, dto: EditorOpDto) {
    const jobType = OP_TO_JOB[op];
    if (!jobType) {
      throw new BadRequestException(`Unknown editor operation: ${op}`);
    }

    if (op !== 'merge' && !dto.inputFileId) {
      throw new BadRequestException('inputFileId is required for this operation');
    }

    return this.videos.createVideoJob(userId, {
      jobType,
      inputFileId: dto.inputFileId,
      prompt: dto.prompt,
      projectId: dto.projectId,
      settings: {
        ...(dto.settings || {}),
        op,
      },
    });
  }
}
