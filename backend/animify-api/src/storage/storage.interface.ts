export interface StorageProvider {
  buildStorageKey(userId: string, fileId: string, fileName: string): string;
  getUploadUrl(
    storageKey: string,
    mimeType: string,
  ): Promise<{ uploadUrl: string; token?: string; expiresIn: number }>;
  getDownloadUrl(storageKey: string): Promise<{
    downloadUrl: string;
    expiresAt: Date;
  }>;
  fileExists(storageKey: string): Promise<boolean>;
  uploadBuffer(
    storageKey: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<void>;
  deleteObject?(storageKey: string): Promise<void>;
}

export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');
