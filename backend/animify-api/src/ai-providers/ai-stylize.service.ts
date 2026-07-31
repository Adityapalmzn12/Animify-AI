import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawn } from 'child_process';
import { resolveStyleProfile } from './styles.config';

export interface StylizeResult {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
  provider: 'oss-worker' | 'ffmpeg';
  styleId: string;
  styleName: string;
  engine?: string;
}

export type StylizeProgressCallback = (
  progress: number,
  step: string,
) => void | Promise<void>;

@Injectable()
export class AiStylizeService {
  private readonly logger = new Logger(AiStylizeService.name);

  constructor(private readonly configService: ConfigService) {}

  async stylizeVideo(params: {
    jobId: string;
    videoUrl: string;
    style: string;
    originalName: string;
    settings?: Record<string, unknown>;
    onProgress?: StylizeProgressCallback;
  }): Promise<StylizeResult> {
    const profile = resolveStyleProfile(params.style);
    const workerUrl = (
      this.configService.get<string>('ai.workerUrl') || ''
    ).replace(/\/$/, '');

    if (workerUrl) {
      try {
        this.logger.log(`Stylizing via OSS worker (${profile.name}) → ${workerUrl}`);
        return await this.stylizeWithOssWorker({
          workerUrl,
          jobId: params.jobId,
          videoUrl: params.videoUrl,
          profile,
          originalName: params.originalName,
          settings: params.settings,
          onProgress: params.onProgress,
        });
      } catch (error) {
        this.logger.error(
          `OSS worker failed, falling back to ffmpeg: ${
            error instanceof Error ? error.message : error
          }`,
        );
      }
    } else {
      this.logger.warn(
        'AI_WORKER_URL not set — using local ffmpeg style filters (OSS CPU fallback).',
      );
    }

    await params.onProgress?.(45, 'Style CPU');
    return this.stylizeWithFfmpeg(
      params.videoUrl,
      profile,
      params.originalName,
    );
  }

  private async stylizeWithOssWorker(params: {
    workerUrl: string;
    jobId: string;
    videoUrl: string;
    profile: ReturnType<typeof resolveStyleProfile>;
    originalName: string;
    settings?: Record<string, unknown>;
    onProgress?: StylizeProgressCallback;
  }): Promise<StylizeResult> {
    const createRes = await fetch(`${params.workerUrl}/v1/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jobId: params.jobId,
        videoUrl: params.videoUrl,
        style: params.profile.id,
        settings: {
          removeBackground: Boolean(params.settings?.removeBackground),
          enhanceFace: Boolean(params.settings?.enhanceFace),
          quality: (params.settings?.quality as string) || 'hd',
          outputFormat: (params.settings?.outputFormat as string) || 'mp4',
          preserveAudio:
            params.settings?.preserveAudio === undefined
              ? true
              : Boolean(params.settings.preserveAudio),
        },
        outputPath: `outputs/${params.jobId}/styled.mp4`,
      }),
    });

    if (!createRes.ok) {
      const text = await createRes.text();
      throw new Error(`Worker enqueue failed: ${createRes.status} ${text}`);
    }

    const created = (await createRes.json()) as { taskId?: string; task_id?: string };
    const taskId = created.taskId || created.task_id;
    if (!taskId) {
      throw new Error('Worker returned no taskId');
    }

    const pollMs = 2000;
    const maxWaitMs = 45 * 60 * 1000;
    const started = Date.now();
    let outputUrl: string | undefined;
    let engine: string | undefined;

    while (Date.now() - started < maxWaitMs) {
      const statusRes = await fetch(`${params.workerUrl}/v1/jobs/${taskId}`);
      if (!statusRes.ok) {
        throw new Error(`Worker status failed: ${statusRes.status}`);
      }
      const status = (await statusRes.json()) as {
        status: string;
        progress?: number;
        step?: string;
        outputUrl?: string;
        output_url?: string;
        error?: string;
        meta?: { engine?: string };
      };

      if (status.step) {
        await params.onProgress?.(
          Math.min(95, Math.max(5, status.progress ?? 10)),
          status.step,
        );
      }

      if (status.status === 'completed') {
        outputUrl = status.outputUrl || status.output_url;
        engine = status.meta?.engine;
        break;
      }
      if (status.status === 'failed') {
        throw new Error(status.error || 'OSS worker job failed');
      }

      await new Promise((r) => setTimeout(r, pollMs));
    }

    if (!outputUrl) {
      throw new Error('OSS worker timed out or returned no outputUrl');
    }

    const buffer = await this.downloadToBuffer(outputUrl);
    return {
      buffer,
      mimeType: 'video/mp4',
      fileName: `${params.profile.id}_${this.baseName(params.originalName)}.mp4`,
      provider: 'oss-worker',
      styleId: params.profile.id,
      styleName: params.profile.name,
      engine,
    };
  }

  private async stylizeWithFfmpeg(
    videoUrl: string,
    profile: ReturnType<typeof resolveStyleProfile>,
    originalName: string,
  ): Promise<StylizeResult> {
    const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'animify-'));
    const inputPath = path.join(tmpDir, 'input.bin');
    const outputPath = path.join(tmpDir, `output_${profile.id}.mp4`);

    try {
      const inputBuffer = await this.downloadToBuffer(videoUrl);
      await fs.promises.writeFile(inputPath, inputBuffer);

      const sides = [480, 360, 320];
      let lastError: Error | null = null;

      for (const side of sides) {
        const scale =
          `scale='min(${side},iw)':'min(${side},ih)':force_original_aspect_ratio=decrease:flags=fast_bilinear,` +
          `scale=trunc(iw/2)*2:trunc(ih/2)*2,fps=24,format=yuv420p`;
        try {
          await this.runFfmpeg([
            '-y',
            '-hide_banner',
            '-loglevel',
            'error',
            '-threads',
            '1',
            '-filter_threads',
            '1',
            '-fflags',
            '+genpts+discardcorrupt',
            '-i',
            inputPath,
            '-map',
            '0:v:0',
            '-map',
            '0:a:0?',
            '-vf',
            `${scale},${profile.ffmpegFilter}`,
            '-c:v',
            'libx264',
            '-preset',
            'ultrafast',
            '-crf',
            '30',
            '-threads',
            '1',
            '-pix_fmt',
            'yuv420p',
            '-profile:v',
            'baseline',
            '-c:a',
            'aac',
            '-b:a',
            '64k',
            '-ac',
            '1',
            '-map_metadata',
            '-1',
            '-movflags',
            '+faststart',
            '-max_muxing_queue_size',
            '9999',
            outputPath,
          ]);
          lastError = null;
          break;
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));
          this.logger.warn(`ffmpeg fallback failed at ${side}p: ${lastError.message}`);
          await fs.promises.rm(outputPath, { force: true }).catch(() => undefined);
        }
      }

      if (lastError || !(await fs.promises.stat(outputPath).catch(() => null))) {
        throw lastError || new Error('ffmpeg stylize failed');
      }

      const buffer = await fs.promises.readFile(outputPath);
      return {
        buffer,
        mimeType: 'video/mp4',
        fileName: `${profile.id}_${this.baseName(originalName)}.mp4`,
        provider: 'ffmpeg',
        styleId: profile.id,
        styleName: profile.name,
        engine: 'cpu-ffmpeg',
      };
    } finally {
      await fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  private runFfmpeg(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
      let stderr = '';
      proc.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });
      proc.on('error', (err) => {
        reject(
          new Error(
            `ffmpeg not available (${err.message}). Start the OSS ai-worker or install ffmpeg.`,
          ),
        );
      });
      proc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-500)}`));
      });
    });
  }

  private async downloadToBuffer(url: string): Promise<Buffer> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download media: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  private baseName(name: string): string {
    return name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_') || 'video';
  }
}
