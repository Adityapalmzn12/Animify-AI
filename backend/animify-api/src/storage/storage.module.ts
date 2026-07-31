import { Global, Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { S3StorageProvider } from './s3-storage.provider';

@Global()
@Module({
  providers: [S3StorageProvider, StorageService],
  exports: [StorageService, S3StorageProvider],
})
export class StorageModule {}
