export type MediaUploadResult = {
  fileId: string;
  filePath: string;
  url: string;
};

export type MediaUploadInput = {
  professionalId: string;
  buffer: Buffer;
  mimeType: string;
};

export type MediaFileInfo = {
  fileId: string;
  fileName: string;
  mimeType: string;
  sizeOriginal: number;
  viewUrl: string;
  downloadUrl: string;
};

export type MediaUploadKind = 'gallery' | 'avatar' | 'service' | 'profile';

export type CreateDirectUploadInput = {
  professionalId: string;
  type: MediaUploadKind;
  mimeType: string;
};

/**
 * Everything the mobile client needs to upload an image straight to the
 * storage backend, without the bytes ever passing through the API (which on
 * Vercel is capped at a 4.5 MB request body). The server dictates `fileId` and
 * `path` so the eventual file is predictable and ownership can be enforced at
 * confirm time; `uploadToken` is a short-lived credential scoped to the bucket.
 */
export type DirectUploadTarget = {
  fileId: string;
  path: string;
  /** Canonical public view URL the file will have once uploaded. */
  viewUrl: string;
  endpoint: string;
  projectId: string;
  bucketId: string;
  /** Short-lived JWT authorizing the direct upload to the bucket. */
  uploadToken: string;
  expiresAt: string;
};

export type ListMediaFilesInput = {
  professionalId: string;
  type: 'gallery' | 'avatar' | 'service';
  page?: number;
  limit?: number;
};

export type ListMediaFilesResult = {
  data: MediaFileInfo[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export interface MediaStoragePort {
  /**
   * Issue a direct-to-storage upload target so the client can upload the bytes
   * itself. The API only sees the (small) confirmation afterwards.
   */
  createDirectUpload(
    args: CreateDirectUploadInput,
  ): Promise<DirectUploadTarget>;
  uploadGalleryImage(args: MediaUploadInput): Promise<MediaUploadResult>;
  uploadAvatarImage(args: MediaUploadInput): Promise<MediaUploadResult>;
  uploadServiceImage(args: MediaUploadInput): Promise<MediaUploadResult>;
  getFileInfo(fileId: string): Promise<MediaFileInfo>;
  listProfessionalFiles(
    args: ListMediaFilesInput,
  ): Promise<ListMediaFilesResult>;
  deleteFile(fileId: string): Promise<void>;
  /**
   * Delete the underlying file given a stored view URL.
   * No-op when the URL does not belong to this storage provider
   * (e.g. an externally-hosted imageUrl provided directly by the client).
   */
  deleteFileByUrl(url: string | null | undefined): Promise<void>;
  /**
   * Build a resized/compressed preview URL from a stored view URL.
   * Returns the original URL unchanged for externally-hosted images
   * (cannot be transformed) and `null` for empty input.
   */
  buildPreviewUrl(
    url: string | null | undefined,
    options: PreviewOptions,
  ): string | null;
}

export type PreviewOptions = {
  width: number;
  height?: number;
  /** 0-100, defaults to 75 */
  quality?: number;
  /** defaults to 'webp' */
  output?: 'webp' | 'jpg' | 'png';
};

export const MEDIA_STORAGE_SERVICE = 'MEDIA_STORAGE_SERVICE';
