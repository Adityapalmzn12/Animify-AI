import {
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { StorageProvider } from './storage.interface';

@Injectable()
export class S3StorageProvider implements StorageProvider, OnModuleInit {
  private readonly logger = new Logger(S3StorageProvider.name);
  private client!: S3Client;
  private bucket = '';
  private cloudFrontUrl?: string;
  private ready = false;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const bucket = this.config.get<string>('storage.s3.bucket');
    const accessKeyId = this.config.get<string>('storage.s3.accessKeyId');
    const secretAccessKey = this.config.get<string>('storage.s3.secretAccessKey');
    const region = this.config.get<string>('storage.s3.region') || 'us-east-1';
    this.cloudFrontUrl = this.config.get<string>('storage.s3.cloudFrontUrl') || undefined;

    if (!bucket || !accessKeyId || !secretAccessKey) {
      this.logger.warn('S3 storage not fully configured');
      return;
    }

    this.bucket = bucket;
    this.client = new S3Client({
      region,
      credentials: { accessKeyId, secretAccessKey },
    });
    this.ready = true;
    this.logger.log(`S3 storage ready (bucket=${bucket})`);
  }

  isReady() {
    return this.ready;
  }

  private ensureReady() {
    if (!this.ready) {
      throw new ServiceUnavailableException('S3 storage is not configured');
    }
  }

  buildStorageKey(userId: string, fileId: string, fileName: string): string {
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `uploads/${userId}/${fileId}/${safeName}`;
  }

  async getUploadUrl(storageKey: string, mimeType: string) {
    this.ensureReady();
    const expiresIn = this.config.get<number>('storage.uploadUrlExpiry') ?? 7200;
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: storageKey,
      ContentType: mimeType,
    });
    const uploadUrl = await getSignedUrl(this.client, command, { expiresIn });
    return { uploadUrl, expiresIn };
  }

  async getDownloadUrl(storageKey: string) {
    this.ensureReady();
    const expiresIn = this.config.get<number>('storage.downloadUrlExpiry') ?? 86400;
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    if (this.cloudFrontUrl) {
      return {
        downloadUrl: `${this.cloudFrontUrl.replace(/\/$/, '')}/${storageKey}`,
        expiresAt,
      };
    }

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: storageKey,
    });
    const downloadUrl = await getSignedUrl(this.client, command, { expiresIn });
    return { downloadUrl, expiresAt };
  }

  async fileExists(storageKey: string): Promise<boolean> {
    this.ensureReady();
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: storageKey }),
      );
      return true;
    } catch {
      return false;
    }
  }

  async uploadBuffer(storageKey: string, buffer: Buffer, mimeType: string) {
    this.ensureReady();
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
        Body: buffer,
        ContentType: mimeType,
      }),
    );
  }

  async deleteObject(storageKey: string) {
    this.ensureReady();
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: storageKey }),
    );
  }
}
