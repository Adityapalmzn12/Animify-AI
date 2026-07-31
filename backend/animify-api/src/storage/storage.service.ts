import {
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { S3StorageProvider } from './s3-storage.provider';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private client!: SupabaseClient;
  private bucket = 'animify-videos';
  private initialized = false;
  private useS3 = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly s3: S3StorageProvider,
  ) {}

  onModuleInit() {
    const provider = (
      this.configService.get<string>('storage.provider') || 'supabase'
    ).toLowerCase();
    if (provider === 's3' && this.s3.isReady()) {
      this.useS3 = true;
      this.logger.log('StorageService using S3 backend');
      return;
    }
    if (provider === 's3') {
      this.logger.warn(
        'STORAGE_PROVIDER=s3 but S3 not ready; falling back to Supabase',
      );
    }
    this.initializeSupabase();
  }

  private resolveBackend() {
    if (
      !this.useS3 &&
      (this.configService.get<string>('storage.provider') || '').toLowerCase() ===
        's3' &&
      this.s3.isReady()
    ) {
      this.useS3 = true;
    }
  }

  private initializeSupabase() {
    const url = this.configService.get<string>('storage.supabaseUrl');
    const secretKey = this.configService.get<string>(
      'storage.supabaseServiceRoleKey',
    );
    this.bucket =
      this.configService.get<string>('storage.bucketName') || 'animify-videos';

    if (!url || !secretKey) {
      this.logger.warn(
        'Supabase Storage not configured. Set SUPABASE_URL and SUPABASE_SECRET_KEY',
      );
      return;
    }

    try {
      // Use supabase-js (CJS-safe) instead of @supabase/server which pulls ESM-only jose.
      this.client = createClient(url, secretKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      this.initialized = true;
      this.logger.log(
        `Supabase Storage initialized (bucket: ${this.bucket})`,
      );
    } catch (error) {
      this.logger.error('Failed to initialize Supabase Storage', error);
    }
  }

  private ensureReady() {
    if (this.useS3) return;
    if (!this.initialized || !this.client) {
      throw new ServiceUnavailableException(
        'Storage is not configured. Add SUPABASE_* or S3 credentials.',
      );
    }
  }

  buildStorageKey(userId: string, fileId: string, fileName: string): string {
    this.resolveBackend();
    if (this.useS3) return this.s3.buildStorageKey(userId, fileId, fileName);
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `uploads/${userId}/${fileId}/${safeName}`;
  }

  async getUploadUrl(
    storageKey: string,
    mimeType: string,
  ): Promise<{ uploadUrl: string; token?: string; expiresIn: number }> {
    this.resolveBackend();
    if (this.useS3) return this.s3.getUploadUrl(storageKey, mimeType);
    this.ensureReady();
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
    return { uploadUrl: data.signedUrl, token: data.token, expiresIn };
  }

  async getDownloadUrl(storageKey: string): Promise<{
    downloadUrl: string;
    expiresAt: Date;
  }> {
    this.resolveBackend();
    if (this.useS3) return this.s3.getDownloadUrl(storageKey);
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
    return { downloadUrl: data.signedUrl, expiresAt };
  }

  async fileExists(storageKey: string): Promise<boolean> {
    this.resolveBackend();
    if (this.useS3) return this.s3.fileExists(storageKey);
    this.ensureReady();
    const lastSlash = storageKey.lastIndexOf('/');
    const folder = lastSlash >= 0 ? storageKey.slice(0, lastSlash) : '';
    const fileName =
      lastSlash >= 0 ? storageKey.slice(lastSlash + 1) : storageKey;
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .list(folder, { search: fileName, limit: 100 });
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
    this.resolveBackend();
    if (this.useS3) return this.s3.uploadBuffer(storageKey, buffer, mimeType);
    this.ensureReady();
    const { error } = await this.client.storage
      .from(this.bucket)
      .upload(storageKey, buffer, { contentType: mimeType, upsert: true });
    if (error) {
      this.logger.error(`Failed to upload ${storageKey}`, error);
      throw new ServiceUnavailableException(
        error.message || 'Failed to upload processed video',
      );
    }
  }

  async deleteObject(storageKey: string): Promise<void> {
    this.resolveBackend();
    if (this.useS3) {
      await this.s3.deleteObject(storageKey);
      return;
    }
    this.ensureReady();
    await this.client.storage.from(this.bucket).remove([storageKey]);
  }

  async getFileMetadata(storageKey: string) {
    if (this.useS3) {
      const exists = await this.s3.fileExists(storageKey);
      return exists ? { name: storageKey } : null;
    }
    this.ensureReady();
    const lastSlash = storageKey.lastIndexOf('/');
    const folder = lastSlash >= 0 ? storageKey.slice(0, lastSlash) : '';
    const fileName =
      lastSlash >= 0 ? storageKey.slice(lastSlash + 1) : storageKey;
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .list(folder, { search: fileName, limit: 100 });
    if (error) throw error;
    return (data ?? []).find((item) => item.name === fileName) ?? null;
  }
}
