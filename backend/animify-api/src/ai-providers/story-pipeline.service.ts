import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { AiProviderBus } from './providers/ai-provider.bus';
import { FalProvider } from './providers/fal.provider';
import { ReplicateProvider } from './providers/replicate.provider';
import type { AiProvider } from './providers/ai-provider.interface';

export type StoryScene = {
  index: number;
  title: string;
  prompt: string;
  dialogue: string;
  durationSec: number;
};

@Injectable()
export class StoryPipelineService {
  private readonly logger = new Logger(StoryPipelineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly storage: StorageService,
    private readonly bus: AiProviderBus,
    private readonly fal: FalProvider,
    private readonly replicate: ReplicateProvider,
  ) {}

  static normalizeDuration(raw?: number): 10 | 30 | 60 {
    const n = Number(raw) || 30;
    // Legacy 15 → 10, 59 → 60
    if (n <= 12 || n === 15) return 10;
    if (n <= 30) return 30;
    return 60;
  }

  static segmentPlan(totalSec: number): number[] {
    const clip = 10;
    const parts: number[] = [];
    let left = totalSec;
    while (left > 0) {
      const take = Math.min(clip, left);
      parts.push(take);
      left -= take;
    }
    return parts.length ? parts : [totalSec];
  }

  parseScenes(script: string, totalSec: number): StoryScene[] {
    const plan = StoryPipelineService.segmentPlan(totalSec);
    const text = (script || '').trim();
    const blocks =
      text.match(
        /(?:^|\n)\s*(?:scene\s*\d+|part\s*\d+)[:.\-\s]+([\s\S]*?)(?=(?:\n\s*(?:scene\s*\d+|part\s*\d+)[:.\-\s])|$)/gi,
      ) || [];

    let prompts: string[] = [];
    if (blocks.length >= 2) {
      prompts = blocks.map((b) =>
        b
          .replace(/^\s*(?:scene|part)\s*\d+[:.\-\s]*/i, '')
          .trim(),
      );
    } else {
      const sentences = text
        .split(/(?<=[.!?])\s+/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (sentences.length >= plan.length) {
        const chunk = Math.ceil(sentences.length / plan.length);
        for (let i = 0; i < plan.length; i++) {
          prompts.push(
            sentences.slice(i * chunk, (i + 1) * chunk).join(' '),
          );
        }
      } else {
        prompts = plan.map((_, i) =>
          sentences[i] || text || `Cinematic scene ${i + 1}`,
        );
      }
    }

    while (prompts.length < plan.length) {
      prompts.push(prompts[prompts.length - 1] || text);
    }
    prompts = prompts.slice(0, plan.length);

    return prompts.map((p, i) => ({
      index: i + 1,
      title: `Scene ${i + 1}`,
      prompt: p.slice(0, 1200),
      dialogue: p.slice(0, 400),
      durationSec: plan[i],
    }));
  }

  private videoProviders(): AiProvider[] {
    const list: AiProvider[] = [];
    if (this.replicate.isConfigured()) list.push(this.replicate);
    if (this.fal.isConfigured()) list.push(this.fal);
    return list;
  }

  async run(params: {
    jobId: string;
    userId: string;
    script: string;
    style: string;
    aspect: string;
    targetDuration: number;
    characterFileIds?: string[];
    addAudio?: boolean;
    qualityTier?: string;
    videoModel?: string;
    imageModel?: string;
    onProgress: (progress: number, step: string) => Promise<void>;
  }): Promise<{ buffer: Buffer; mimeType: string; fileName: string }> {
    const duration = StoryPipelineService.normalizeDuration(
      params.targetDuration,
    );
    const requireAudio = params.addAudio !== false;
    const scenes = this.parseScenes(params.script, duration);
    const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'animify-story-'));
    const clipPaths: string[] = [];
    const audioPaths: string[] = [];

    try {
      await params.onProgress(8, 'Processing');
      const characterUrls = await this.resolveCharacterUrls(
        params.characterFileIds || [],
      );

      for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i];
        const pct = 10 + Math.floor((i / scenes.length) * 70);
        await params.onProgress(pct, 'Processing');

        const charUrl = characterUrls.length
          ? characterUrls[i % characterUrls.length]
          : undefined;

        let firstFrame = charUrl;
        if (!firstFrame) {
          firstFrame = await this.generateSceneStill(
            params.jobId,
            scene,
            params.style,
            params.qualityTier,
            params.imageModel,
          );
        }

        const clipBuf = await this.generateSceneClip({
          jobId: `${params.jobId}_s${scene.index}`,
          prompt: `${params.style} style. ${scene.prompt}. Smooth cinematic motion.`,
          inputUrl: firstFrame,
          durationSec: scene.durationSec,
          qualityTier: params.qualityTier,
          videoModel: params.videoModel,
        });

        const clipPath = path.join(workDir, `clip_${i}.mp4`);
        await fs.writeFile(clipPath, clipBuf);
        const timedPath = path.join(workDir, `timed_${i}.mp4`);
        await this.ffmpeg([
          '-y',
          '-stream_loop',
          '-1',
          '-i',
          clipPath,
          '-t',
          String(scene.durationSec),
          '-vf',
          'scale=720:-2:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2',
          '-an',
          '-c:v',
          'libx264',
          '-pix_fmt',
          'yuv420p',
          timedPath,
        ]);
        clipPaths.push(timedPath);

        if (requireAudio) {
          const narration = this.narrationForScene(scene);
          const audioBuf = await this.synthesizeTts(narration);
          if (!audioBuf?.length) {
            throw new Error(
              'Voice generation failed. Check OPENAI_API_KEY or ELEVENLABS_API_KEY.',
            );
          }
          const ap = path.join(workDir, `audio_${i}.mp3`);
          await fs.writeFile(ap, audioBuf);
          audioPaths.push(ap);
        }
      }

      await params.onProgress(85, 'Processing');
      const listFile = path.join(workDir, 'list.txt');
      await fs.writeFile(
        listFile,
        clipPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n'),
      );

      const silentPath = path.join(workDir, 'silent.mp4');
      await this.ffmpeg([
        '-y',
        '-f',
        'concat',
        '-safe',
        '0',
        '-i',
        listFile,
        '-c',
        'copy',
        silentPath,
      ]);

      const outPath = path.join(workDir, 'final.mp4');
      if (requireAudio) {
        if (!audioPaths.length) {
          throw new Error('Voice track missing for video');
        }
        const narrationPath = path.join(workDir, 'narration.mp3');
        if (audioPaths.length === 1) {
          await fs.copyFile(audioPaths[0], narrationPath);
        } else {
          const audioList = path.join(workDir, 'audio_list.txt');
          await fs.writeFile(
            audioList,
            audioPaths
              .map((p) => `file '${p.replace(/'/g, "'\\''")}'`)
              .join('\n'),
          );
          await this.ffmpeg([
            '-y',
            '-f',
            'concat',
            '-safe',
            '0',
            '-i',
            audioList,
            '-c',
            'copy',
            narrationPath,
          ]);
        }
        await this.ffmpeg([
          '-y',
          '-i',
          silentPath,
          '-i',
          narrationPath,
          '-c:v',
          'copy',
          '-c:a',
          'aac',
          '-b:a',
          '192k',
          '-shortest',
          outPath,
        ]);
      } else {
        await fs.copyFile(silentPath, outPath);
      }

      await params.onProgress(95, 'Processing');
      const buffer = await fs.readFile(outPath);
      return {
        buffer,
        mimeType: 'video/mp4',
        fileName: `story_${duration}s.mp4`,
      };
    } finally {
      await fs.rm(workDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  private narrationForScene(scene: StoryScene): string {
    const raw = (scene.dialogue || scene.prompt || '').trim();
    if (raw.length >= 12) return raw.slice(0, 900);
    return `Scene ${scene.index}. ${raw || 'A cinematic moment unfolds.'}`;
  }

  private async resolveCharacterUrls(fileIds: string[]): Promise<string[]> {
    const urls: string[] = [];
    for (const id of fileIds.slice(0, 6)) {
      const file = await this.prisma.videoFile.findUnique({ where: { id } });
      if (!file) continue;
      const signed = await this.storage.getDownloadUrl(file.storageKey);
      urls.push(signed.downloadUrl);
    }
    return urls;
  }

  private async generateSceneStill(
    jobId: string,
    scene: StoryScene,
    style: string,
    qualityTier?: string,
    imageModel?: string,
  ): Promise<string | undefined> {
    try {
      const result = await this.bus.submit({
        jobId: `${jobId}_img_${scene.index}`,
        jobType: 'IMAGE_GEN',
        prompt: `${style} keyframe. ${scene.prompt}. Cinematic still, character consistent.`,
        settings: {
          aspect: '9:16',
          qualityTier: qualityTier || 'economy',
          imageModel,
        },
      });
      return result.resultUrl;
    } catch (error) {
      this.logger.warn(
        `Scene still failed: ${error instanceof Error ? error.message : error}`,
      );
      return undefined;
    }
  }

  private async generateSceneClip(input: {
    jobId: string;
    prompt: string;
    inputUrl?: string;
    durationSec: number;
    qualityTier?: string;
    videoModel?: string;
  }): Promise<Buffer> {
    const providers = this.videoProviders();
    if (!providers.length) {
      throw new Error('No video provider configured (set REPLICATE_API_TOKEN)');
    }

    let lastError: unknown;
    for (const provider of providers) {
      try {
        const submitted = await provider.submit({
          jobId: input.jobId,
          jobType: input.inputUrl ? 'IMAGE_TO_VIDEO' : 'TEXT_TO_VIDEO',
          prompt: input.prompt,
          inputUrl: input.inputUrl,
          settings: {
            duration: input.durationSec,
            qualityTier: input.qualityTier || 'economy',
            videoModel: input.videoModel,
          },
        });

        let resultUrl = submitted.resultUrl;
        if (!resultUrl) {
          let polls = 0;
          while (polls < 90) {
            polls += 1;
            await new Promise((r) => setTimeout(r, 4000));
            const polled = await provider.poll(submitted.externalId);
            if (polled.status === 'completed' && polled.resultUrl) {
              resultUrl = polled.resultUrl;
              break;
            }
            if (polled.status === 'failed') {
              throw new Error(polled.error || `${provider.name} failed`);
            }
          }
        }
        if (!resultUrl) throw new Error(`${provider.name} timed out`);
        const res = await fetch(resultUrl);
        if (!res.ok) throw new Error('Failed to download scene clip');
        return Buffer.from(await res.arrayBuffer());
      } catch (error) {
        lastError = error;
        this.logger.warn(
          `Provider ${provider.name} scene failed: ${
            error instanceof Error ? error.message : error
          }`,
        );
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error('All scene providers failed');
  }

  private async synthesizeTts(text: string): Promise<Buffer | null> {
    const clean = (text || '').trim().slice(0, 900);
    if (!clean) return null;

    const openaiKey = this.config.get<string>('ai.openai.apiKey');
    if (openaiKey) {
      try {
        const res = await fetch('https://api.openai.com/v1/audio/speech', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${openaiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'tts-1',
            input: clean,
            voice: 'alloy',
          }),
        });
        if (res.ok) return Buffer.from(await res.arrayBuffer());
        this.logger.warn(`OpenAI TTS failed: ${await res.text()}`);
      } catch (error) {
        this.logger.warn(
          `OpenAI TTS error: ${error instanceof Error ? error.message : error}`,
        );
      }
    }

    const elevenKey = this.config.get<string>('ai.elevenlabs.apiKey');
    if (elevenKey) {
      try {
        const voiceId = '21m00Tcm4TlvDq8ikWAM';
        const res = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
          {
            method: 'POST',
            headers: {
              'xi-api-key': elevenKey,
              'Content-Type': 'application/json',
              Accept: 'audio/mpeg',
            },
            body: JSON.stringify({
              text: clean,
              model_id: 'eleven_multilingual_v2',
            }),
          },
        );
        if (res.ok) return Buffer.from(await res.arrayBuffer());
        this.logger.warn(`ElevenLabs TTS failed: ${await res.text()}`);
      } catch (error) {
        this.logger.warn(
          `ElevenLabs TTS error: ${
            error instanceof Error ? error.message : error
          }`,
        );
      }
    }

    // Local OSS fallback so voice is never skipped when cloud TTS is billed out
    try {
      const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const wavPath = path.join(os.tmpdir(), `tts_${id}.wav`);
      const mp3Path = path.join(os.tmpdir(), `tts_${id}.mp3`);
      await new Promise<void>((resolve, reject) => {
        const proc = spawn(
          'espeak-ng',
          ['-w', wavPath, '-s', '150', clean],
          { stdio: ['ignore', 'ignore', 'pipe'] },
        );
        let err = '';
        proc.stderr.on('data', (d) => {
          err += d.toString();
        });
        proc.on('error', (e) => reject(e));
        proc.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error(err || `espeak-ng exited ${code}`));
        });
      });
      await this.ffmpeg([
        '-y',
        '-i',
        wavPath,
        '-codec:a',
        'libmp3lame',
        '-q:a',
        '4',
        mp3Path,
      ]);
      const mp3 = await fs.readFile(mp3Path);
      await fs.unlink(wavPath).catch(() => undefined);
      await fs.unlink(mp3Path).catch(() => undefined);
      return mp3;
    } catch (error) {
      this.logger.warn(
        `espeak TTS error: ${error instanceof Error ? error.message : error}`,
      );
    }

    return null;
  }

  private ffmpeg(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
      let stderr = '';
      proc.stderr.on('data', (d) => {
        stderr += d.toString();
      });
      proc.on('error', (err) =>
        reject(new Error(`ffmpeg not available: ${err.message}`)),
      );
      proc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-800)}`));
      });
    });
  }
}
