/**
 * CakeToHome Platform Kernel Storage Abstraction Interface
 * Supports Local, AWS S3, Cloudflare R2, GCS, and Azure Blob.
 */

export interface UploadOptions {
  folder?: string;
  contentType?: string;
  isPublic?: boolean;
}

export interface IStorageProvider {
  uploadFile(fileBuffer: Buffer, fileName: string, options?: UploadOptions): Promise<{ url: string; key: string }>;
  deleteFile(key: string): Promise<boolean>;
  getSignedUrl(key: string, expiresInSeconds?: number): Promise<string>;
}

export class LocalStorageProvider implements IStorageProvider {
  private baseDir: string;
  private publicUrl: string;

  constructor(baseDir = "./uploads", publicUrl = "http://localhost:3000/uploads") {
    this.baseDir = baseDir;
    this.publicUrl = publicUrl;
  }

  async uploadFile(fileBuffer: Buffer, fileName: string, options: UploadOptions = {}): Promise<{ url: string; key: string }> {
    const key = `${options.folder ? `${options.folder}/` : ""}${Date.now()}-${fileName}`;
    const url = `${this.publicUrl}/${key}`;
    return { url, key };
  }

  async deleteFile(key: string): Promise<boolean> {
    return true;
  }

  async getSignedUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    return `${this.publicUrl}/${key}`;
  }
}
