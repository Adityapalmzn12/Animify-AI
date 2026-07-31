import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { PrismaService } from '../prisma/prisma.service';
import { AiStylizeService } from '../ai-providers/ai-stylize.service';
import { StorageService } from '../storage/storage.service';
import { JobsGateway } from '../jobs/jobs.gateway';
import { CreditsService } from '../credits/credits.service';
import { AI_JOBS_QUEUE } from './queue.constants';
import { ConfigService } from '@nestjs/config';
import { FalProvider } from '../ai-providers/providers/fal.provider';
import { ReplicateProvider } from '../ai-providers/providers/replicate.provider';
import type { AiProvider } from '../ai-providers/providers/ai-provider.interface';

@Processor(AI_JOBS_QUEUE)
export class AiJobProcessor {
  private readonly logger = new Logger(AiJobProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stylize: AiStylizeService,
    private readonly storage: StorageService,
    private readonly gateway: JobsGateway,
    private readonly credits: CreditsService,
    private readonly config: ConfigService,
    private readonly fal: FalProvider,
    private readonly replicate: ReplicateProvider,
  ) {}

  /** Prefer Replicate — Fal is often balance-locked. */
  private videoProviders(): AiProvider[] {
    const list: AiProvider[] = [];
    if (this.replicate.isConfigured()) list.push(this.replicate);
    if (this.fal.isConfigured()) list.push(this.fal);
    return list;
  }

  private isRecoverable(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    const code = (error as Error & { code?: string }).code;
    if (code === 'PROVIDER_BILLING') return true;
    const msg = error.message.toLowerCase();
    return (
      msg.includes('exhausted balance') ||
      msg.includes('user is locked') ||
      msg.includes('billing') ||
      msg.includes('402') ||
      msg.includes('403') ||
      msg.includes('429') ||
      msg.includes('503')
    );
  }

  @Process('process')
  async handle(job: Job<{ jobId: string }>) {
    const { jobId } = job.data;
    const videoJob = await this.prisma.videoJob.findUnique({
      where: { id: jobId },
      include: { inputFile: true },
    });
    if (!videoJob) {
      this.logger.warn(`Job ${jobId} not found`);
      return;
    }
    if (videoJob.status === 'CANCELLED') return;

    const emit = async (progress: number, step: string, status = 'PROCESSING') => {
      await this.prisma.videoJob.update({
        where: { id: jobId },
        data: { progress, currentStep: step, status: status as any, startedAt: videoJob.startedAt || new Date() },
      });
      this.gateway.emitJobUpdate(videoJob.userId, {
        jobId,
        progress,
        step,
        status,
      });
    };

    try {
      await emit(5, 'Queued', 'QUEUED');
      await emit(10, 'Preparing', 'PROCESSING');

      const settings = (videoJob.settings || {}) as Record<string, any>;
      const style = settings.style || 'anime';

      // Paid video providers for T2V / I2V (Replicate first, Fal fallback)
      if (
        videoJob.jobType === 'TEXT_TO_VIDEO' ||
        videoJob.jobType === 'IMAGE_TO_VIDEO'
      ) {
        const providers = this.videoProviders();
        if (providers.length) {
          let inputUrl: string | undefined;
          if (videoJob.inputFile) {
            const signed = await this.storage.getDownloadUrl(
              videoJob.inputFile.storageKey,
            );
            inputUrl = signed.downloadUrl;
          }

          let lastError: unknown;
          for (const provider of providers) {
            try {
              await emit(30, `Submitting to ${provider.name}`);
              const submitted = await provider.submit({
                jobId,
                jobType: videoJob.jobType,
                prompt:
                  videoJob.prompt ||
                  `cinematic ${style} scene with smooth motion`,
                inputUrl,
                style,
                settings,
              });

              if (submitted.status === 'completed' && submitted.resultUrl) {
                await this.saveRemoteVideo(
                  videoJob.userId,
                  jobId,
                  submitted.resultUrl,
                  provider.name,
                  emit,
                );
                return;
              }

              let polls = 0;
              while (polls < 90) {
                polls += 1;
                await new Promise((r) => setTimeout(r, 4000));
                const polled = await provider.poll(submitted.externalId);
                await emit(
                  Math.min(88, 35 + polls),
                  `${provider.name}: ${polled.status}`,
                );
                if (polled.status === 'completed' && polled.resultUrl) {
                  await this.saveRemoteVideo(
                    videoJob.userId,
                    jobId,
                    polled.resultUrl,
                    provider.name,
                    emit,
                  );
                  return;
                }
                if (polled.status === 'failed') {
                  throw new Error(
                    polled.error || `${provider.name} video failed`,
                  );
                }
              }
              throw new Error(`${provider.name} video generation timed out`);
            } catch (error) {
              lastError = error;
              this.logger.warn(
                `${provider.name} failed for ${jobId}: ${
                  error instanceof Error ? error.message : error
                }`,
              );
              if (!this.isRecoverable(error)) break;
              // try next provider
            }
          }
          throw lastError instanceof Error
            ? lastError
            : new Error('All video providers failed');
        }

        // I2V without paid keys: fall through to OSS stylize if we have input
        if (videoJob.jobType === 'TEXT_TO_VIDEO') {
          throw new Error(
            'Text-to-video needs REPLICATE_API_TOKEN or FAL_API_KEY',
          );
        }
      }

      if (videoJob.jobType === 'STYLIZE' || videoJob.jobType === 'IMAGE_TO_VIDEO') {
        if (!videoJob.inputFile) throw new Error('Input file required');
        const { downloadUrl } = await this.storage.getDownloadUrl(
          videoJob.inputFile.storageKey,
        );
        const stylized = await this.stylize.stylizeVideo({
          jobId,
          videoUrl: downloadUrl,
          style,
          originalName: videoJob.inputFile.originalName,
          settings,
          onProgress: async (p, step) => emit(p, step),
        });

        await emit(90, 'Saving output');
        const outputKey = this.storage.buildStorageKey(
          videoJob.userId,
          `out_${Date.now()}`,
          stylized.fileName,
        );
        await this.storage.uploadBuffer(
          outputKey,
          stylized.buffer,
          stylized.mimeType,
        );
        const { downloadUrl: outUrl, expiresAt } =
          await this.storage.getDownloadUrl(outputKey);

        const outputFile = await this.prisma.videoFile.create({
          data: {
            type: 'OUTPUT',
            originalName: stylized.fileName,
            mimeType: stylized.mimeType,
            sizeBytes: BigInt(stylized.buffer.length),
            storageKey: outputKey,
            downloadUrl: outUrl,
            downloadUrlExpiresAt: expiresAt,
          },
        });

        await this.prisma.videoJob.update({
          where: { id: jobId },
          data: {
            status: 'COMPLETED',
            progress: 100,
            currentStep: 'Completed',
            outputFileId: outputFile.id,
            completedAt: new Date(),
            provider: stylized.provider || videoJob.provider,
          },
        });
        this.gateway.emitJobUpdate(videoJob.userId, {
          jobId,
          progress: 100,
          step: 'Completed',
          status: 'COMPLETED',
        });
        return;
      }

      // EDIT_* and BG_REMOVE: reuse stylize path when input exists
      if (
        String(videoJob.jobType).startsWith('EDIT_') ||
        videoJob.jobType === 'BG_REMOVE' ||
        videoJob.jobType === 'AVATAR' ||
        videoJob.jobType === 'DUB' ||
        videoJob.jobType === 'SUBTITLE'
      ) {
        if (videoJob.inputFile) {
          const { downloadUrl } = await this.storage.getDownloadUrl(
            videoJob.inputFile.storageKey,
          );
          await emit(40, `Processing ${videoJob.jobType}`);
          const stylized = await this.stylize.stylizeVideo({
            jobId,
            videoUrl: downloadUrl,
            style: style,
            originalName: videoJob.inputFile.originalName,
            settings: { ...settings, op: videoJob.jobType },
            onProgress: async (p, step) => emit(p, step),
          });
          await emit(90, 'Saving output');
          const outputKey = this.storage.buildStorageKey(
            videoJob.userId,
            `out_${Date.now()}`,
            stylized.fileName,
          );
          await this.storage.uploadBuffer(
            outputKey,
            stylized.buffer,
            stylized.mimeType,
          );
          const { downloadUrl: outUrl, expiresAt } =
            await this.storage.getDownloadUrl(outputKey);
          const outputFile = await this.prisma.videoFile.create({
            data: {
              type: 'OUTPUT',
              originalName: stylized.fileName,
              mimeType: stylized.mimeType,
              sizeBytes: BigInt(stylized.buffer.length),
              storageKey: outputKey,
              downloadUrl: outUrl,
              downloadUrlExpiresAt: expiresAt,
            },
          });
          await this.prisma.videoJob.update({
            where: { id: jobId },
            data: {
              status: 'COMPLETED',
              progress: 100,
              currentStep: 'Completed',
              outputFileId: outputFile.id,
              completedAt: new Date(),
            },
          });
          this.gateway.emitJobUpdate(videoJob.userId, {
            jobId,
            progress: 100,
            step: 'Completed',
            status: 'COMPLETED',
          });
          return;
        }
      }

      // Generic completion path for script/image metadata jobs handled in their services
      await emit(100, 'Completed', 'COMPLETED');
      await this.prisma.videoJob.update({
        where: { id: jobId },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Processing failed';
      this.logger.error(`Job ${jobId} failed: ${message}`);
      await this.prisma.videoJob.update({
        where: { id: jobId },
        data: {
          status: 'FAILED',
          currentStep: 'Failed',
          errorMessage: message.slice(0, 2000),
        },
      });
      this.gateway.emitJobUpdate(videoJob.userId, {
        jobId,
        status: 'FAILED',
        step: 'Failed',
        progress: 0,
        error: message,
      });
      if (videoJob.creditsCost > 0) {
        await this.credits.refundCredits(videoJob.userId, videoJob.creditsCost, jobId, 'Job failed refund').catch(() => undefined);
      }
      throw error;
    }
  }

  private async saveRemoteVideo(
    userId: string,
    jobId: string,
    resultUrl: string,
    providerName: string,
    emit: (progress: number, step: string, status?: string) => Promise<void>,
  ) {
    await emit(92, 'Downloading result');
    const videoRes = await fetch(resultUrl);
    if (!videoRes.ok) throw new Error('Failed to download provider video');
    const buf = Buffer.from(await videoRes.arrayBuffer());
    const outputKey = this.storage.buildStorageKey(
      userId,
      `out_${Date.now()}`,
      'ai_video.mp4',
    );
    await this.storage.uploadBuffer(outputKey, buf, 'video/mp4');
    const { downloadUrl: outUrl, expiresAt } =
      await this.storage.getDownloadUrl(outputKey);
    const outputFile = await this.prisma.videoFile.create({
      data: {
        type: 'OUTPUT',
        originalName: 'ai_video.mp4',
        mimeType: 'video/mp4',
        sizeBytes: BigInt(buf.length),
        storageKey: outputKey,
        downloadUrl: outUrl,
        downloadUrlExpiresAt: expiresAt,
      },
    });
    await this.prisma.videoJob.update({
      where: { id: jobId },
      data: {
        status: 'COMPLETED',
        progress: 100,
        currentStep: 'Completed',
        outputFileId: outputFile.id,
        completedAt: new Date(),
        provider: providerName,
      },
    });
    this.gateway.emitJobUpdate(userId, {
      jobId,
      progress: 100,
      step: 'Completed',
      status: 'COMPLETED',
    });
  }
}
