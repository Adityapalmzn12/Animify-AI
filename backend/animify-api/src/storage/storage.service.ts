import {
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createAdminClient } from '@supabase/server/core';
import type { SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private client!: SupabaseClient;
  private bucket = 'animify-videos';
  private initialized = false;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    this.initializeSupabase();
  }

  private initializeSupabase() {
    const url = this.configService.get<string>('storage.supabaseUrl');
    const secretKey = this.configService.get<string>(
      'storage.supabaseServiceRoleKey',
    );
    const publishableKey = this.configService.get<string>(
      'storage.supabaseAnonKey',
    );
    const jwksUrl = this.configService.get<string>('storage.jwksUrl');
    this.bucket =
      this.configService.get<string>('storage.bucketName') || 'animify-videos';

    if (!url || !secretKey) {
      this.logger.warn(
        'Supabase Storage not configured. Set SUPABASE_URL and SUPABASE_SECRET_KEY',
      );
      return;
    }

    try {
      // Prefer ConfigService values; @supabase/server also reads process.env
      this.client = createAdminClient({
        env: {
          url,
          secretKeys: { default: secretKey },
          ...(publishableKey
            ? { publishableKeys: { default: publishableKey } }
            : {}),
          ...(jwksUrl ? { jwksUrl } : {}),
        },
      });
      this.initialized = true;
      this.logger.log(
        `Supabase Storage initialized via @supabase/server (bucket: ${this.bucket})`,
      );
    } catch (error) {
      this.logger.error('Failed to initialize Supabase Storage', error);
    }
  }

  private ensureReady() {
    if (!this.initialized || !this.client) {
      throw new ServiceUnavailableException(
        'Supabase Storage is not configured. Add SUPABASE_URL and SUPABASE_SECRET_KEY.',
      );
    }
  }

  buildStorageKey(userId: string, fileId: string, fileName: string): string {
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `uploads/${userId}/${fileId}/${safeName}`;
  }

  async getUploadUrl(
    storageKey: string,
    _mimeType: string,
  ): Promise<{ uploadUrl: string; token?: string; expiresIn: number }> {
    this.ensureReady();

    // Supabase signed upload URLs are valid for 2 hours
    const expiresIn = 7200;

    const { data, error } = await this.client.storage
      .from(this.bucket)
      .createSignedUploadUrl(storageKey);

    if (error || !data?.signedUrl) {
      this.logger.error('Failed to create signed upload URL', error);
      throw new ServiceUnavailableException(
        error?.message || 'Failed to create upload URL',
      );
    }

    return {
      uploadUrl: data.signedUrl,
      token: data.token,
      expiresIn,
    };
  }

  async getDownloadUrl(storageKey: string): Promise<{
    downloadUrl: string;
    expiresAt: Date;
  }> {
    this.ensureReady();

    const expiresIn =
      this.configService.get<number>('storage.downloadUrlExpiry') ?? 86400;
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    const { data, error } = await this.client.storage
      .from(this.bucket)
      .createSignedUrl(storageKey, expiresIn);

    if (error || !data?.signedUrl) {
      this.logger.error('Failed to create signed download URL', error);
      throw new ServiceUnavailableException(
        error?.message || 'Failed to create download URL',
      );
    }

    return {
      downloadUrl: data.signedUrl,
      expiresAt,
    };
  }

  async fileExists(storageKey: string): Promise<boolean> {
    this.ensureReady();

    const lastSlash = storageKey.lastIndexOf('/');
    const folder = lastSlash >= 0 ? storageKey.slice(0, lastSlash) : '';
    const fileName =
      lastSlash >= 0 ? storageKey.slice(lastSlash + 1) : storageKey;

    const { data, error } = await this.client.storage
      .from(this.bucket)
      .list(folder, {
        search: fileName,
        limit: 100,
      });

    if (error) {
      this.logger.warn(`fileExists check failed for ${storageKey}`, error);
      return false;
    }

    return (data ?? []).some((item) => item.name === fileName);
  }

  async uploadBuffer(
    storageKey: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<void> {
    this.ensureReady();

    const { error } = await this.client.storage
      .from(this.bucket)
      .upload(storageKey, buffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (error) {
      this.logger.error(`Failed to upload ${storageKey}`, error);
      throw new ServiceUnavailableException(
        error.message || 'Failed to upload processed video',
      );
    }
  }

  async getFileMetadata(storageKey: string) {
    this.ensureReady();

    const lastSlash = storageKey.lastIndexOf('/');
    const folder = lastSlash >= 0 ? storageKey.slice(0, lastSlash) : '';
    const fileName =
      lastSlash >= 0 ? storageKey.slice(lastSlash + 1) : storageKey;

    const { data, error } = await this.client.storage
      .from(this.bucket)
      .list(folder, {
        search: fileName,
        limit: 100,
      });

    if (error) {
      throw error;
    }

    return (data ?? []).find((item) => item.name === fileName) ?? null;
  }
}
