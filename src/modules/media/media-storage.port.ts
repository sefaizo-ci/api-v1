/** Kind of media a professional can upload, used to namespace storage paths. */
export type MediaUploadKind = 'gallery' | 'avatar' | 'service';

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

export type ListMediaFilesInput = {
  professionalId: string;
  type: MediaUploadKind;
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
