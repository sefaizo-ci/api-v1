import { Injectable, Logger } from '@nestjs/common';
import { BadRequestException } from '../../libs/exceptions/domain.exceptions';
import { ConfigService } from '@nestjs/config';
import {
  Client,
  ID,
  Models,
  Permission,
  Query,
  Role,
  Storage,
} from 'node-appwrite';
import { InputFile } from 'node-appwrite/file';
import { randomUUID } from 'node:crypto';
import {
  ListMediaFilesInput,
  ListMediaFilesResult,
  MediaFileInfo,
  MediaStoragePort,
  MediaUploadInput,
  MediaUploadResult,
} from './media-storage.port';

@Injectable()
export class AppwriteMediaService implements MediaStoragePort {
  private readonly logger = new Logger(AppwriteMediaService.name);
  private readonly endpoint: string;
  private readonly projectId: string;
  private readonly apiKey: string;
  private readonly bucketId: string;

  constructor(private readonly configService: ConfigService) {
    this.endpoint =
      this.configService.get<string>('APPWRITE_ENDPOINT') ??
      'https://fake-appwrite.local/v1';
    this.projectId =
      this.configService.get<string>('APPWRITE_PROJECT_ID') ??
      'fake-project-id';
    this.apiKey =
      this.configService.get<string>('APPWRITE_API_KEY') ?? 'fake-api-key';
    this.bucketId =
      this.configService.get<string>('APPWRITE_STORAGE_BUCKET_ID') ??
      'fake-bucket-id';
  }

  async uploadGalleryImage(args: MediaUploadInput): Promise<MediaUploadResult> {
    return this.uploadProfessionalImage(args, 'gallery');
  }

  async uploadAvatarImage(args: MediaUploadInput): Promise<MediaUploadResult> {
    return this.uploadProfessionalImage(args, 'avatar');
  }

  async uploadServiceImage(args: MediaUploadInput): Promise<MediaUploadResult> {
    return this.uploadProfessionalImage(args, 'service');
  }

  private uploadProfessionalImage(
    args: MediaUploadInput,
    type: 'gallery' | 'avatar' | 'service',
  ): Promise<MediaUploadResult> {
    const extension = this.extensionFromMimeType(args.mimeType);
    const filePath = `professionals/${args.professionalId}/${type}/${randomUUID()}.${extension}`;
    return this.uploadImage({
      buffer: args.buffer,
      filePath,
      mimeType: args.mimeType,
    });
  }

  async getFileInfo(fileId: string): Promise<MediaFileInfo> {
    if (this.isDryRunEnabled() || this.isFakeValue(this.apiKey)) {
      return {
        fileId,
        fileName: `dry-run/${fileId}.jpg`,
        mimeType: 'image/jpeg',
        sizeOriginal: 0,
        viewUrl: this.buildFileViewUrl(fileId),
        downloadUrl: this.buildFileDownloadUrl(fileId),
      };
    }

    const storage = this.createStorageClient();
    const file = await storage.getFile(this.bucketId, fileId);
    return this.mapFileInfo(file);
  }

  async listProfessionalFiles(
    args: ListMediaFilesInput,
  ): Promise<ListMediaFilesResult> {
    const page = args.page && args.page > 0 ? args.page : 1;
    const limit = args.limit && args.limit > 0 ? Math.min(args.limit, 100) : 20;
    const offset = (page - 1) * limit;
    const prefix = `professionals/${args.professionalId}/${args.type}/`;

    if (this.isDryRunEnabled() || this.isFakeValue(this.apiKey)) {
      this.logger.log(
        `[APPWRITE][DRY_RUN] list files prefix=${prefix} page=${page} limit=${limit}`,
      );

      return {
        data: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
        },
      };
    }

    const storage = this.createStorageClient();
    const queries = [
      Query.startsWith('name', prefix),
      Query.limit(limit),
      Query.offset(offset),
      Query.orderDesc('$createdAt'),
    ];

    const result = await storage.listFiles(this.bucketId, queries);

    return {
      data: result.files.map((file) => this.mapFileInfo(file)),
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
      },
    };
  }

  deleteFile(fileId: string): Promise<void> {
    this.logger.log(
      `[APPWRITE] deleteFile skipped — files are kept in bucket (fileId=${fileId})`,
    );
    return Promise.resolve();
  }

  private async uploadImage(args: {
    buffer: Buffer;
    filePath: string;
    mimeType: string;
  }): Promise<MediaUploadResult> {
    const dryRun = this.isDryRunEnabled() || this.isFakeValue(this.apiKey);
    const fileId = ID.unique();
    const url = this.buildFileViewUrl(fileId);

    if (dryRun) {
      this.logger.log(
        `[APPWRITE][DRY_RUN] bucket=${this.bucketId} fileId=${fileId} filePath=${args.filePath} mimeType=${args.mimeType} bytes=${args.buffer.byteLength}`,
      );
      return {
        fileId,
        filePath: args.filePath,
        url,
      };
    }

    const storage = this.createStorageClient();
    const inputFile = InputFile.fromBuffer(args.buffer, args.filePath);

    await storage.createFile(this.bucketId, fileId, inputFile, [
      Permission.read(Role.any()),
    ]);

    this.logger.log(
      `[APPWRITE][LIVE] bucket=${this.bucketId} fileId=${fileId} filePath=${args.filePath}`,
    );

    return {
      fileId,
      filePath: args.filePath,
      url,
    };
  }

  private createStorageClient(): Storage {
    const client = new Client()
      .setEndpoint(this.endpoint)
      .setProject(this.projectId)
      .setKey(this.apiKey);

    return new Storage(client);
  }

  private buildFileViewUrl(fileId: string): string {
    const endpoint = this.endpoint.replace(/\/$/, '');
    const query = new URLSearchParams({
      project: this.projectId,
    });
    return `${endpoint}/storage/buckets/${this.bucketId}/files/${fileId}/view?${query.toString()}`;
  }

  private buildFileDownloadUrl(fileId: string): string {
    const endpoint = this.endpoint.replace(/\/$/, '');
    const query = new URLSearchParams({
      project: this.projectId,
    });
    return `${endpoint}/storage/buckets/${this.bucketId}/files/${fileId}/download?${query.toString()}`;
  }

  private mapFileInfo(file: Models.File): MediaFileInfo {
    return {
      fileId: file.$id,
      fileName: file.name,
      mimeType: file.mimeType,
      sizeOriginal: file.sizeOriginal,
      viewUrl: this.buildFileViewUrl(file.$id),
      downloadUrl: this.buildFileDownloadUrl(file.$id),
    };
  }

  private extensionFromMimeType(mimeType: string): string {
    switch (mimeType.toLowerCase()) {
      case 'image/jpeg':
      case 'image/jpg':
        return 'jpg';
      case 'image/png':
        return 'png';
      case 'image/webp':
        return 'webp';
      default:
        throw new BadRequestException(
          `Unsupported image mime type: ${mimeType}`,
        );
    }
  }

  private isDryRunEnabled(): boolean {
    const value = this.configService.get<string>('APPWRITE_DRY_RUN');
    if (!value) {
      return true;
    }

    return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
  }

  private isFakeValue(value?: string): boolean {
    if (!value) {
      return true;
    }

    return value.toLowerCase().includes('fake');
  }
}
