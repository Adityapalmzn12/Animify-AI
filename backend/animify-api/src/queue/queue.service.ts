import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { AI_JOBS_QUEUE } from './queue.constants';

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(@InjectQueue(AI_JOBS_QUEUE) private readonly aiQueue: Queue) {}

  async enqueueAiJob(jobId: string, data: Record<string, unknown> = {}) {
    const job = await this.aiQueue.add(
      'process',
      { jobId, ...data },
      {
        jobId,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    );
    this.logger.log(`Enqueued AI job ${jobId} bull=${job.id}`);
    return job;
  }

  async cancelJob(jobId: string) {
    const job = await this.aiQueue.getJob(jobId);
    if (job) {
      await job.remove();
    }
  }
}
