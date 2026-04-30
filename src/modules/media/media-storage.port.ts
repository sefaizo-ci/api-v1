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
  type: 'gallery' | 'avatar';
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
  getFileInfo(fileId: string): Promise<MediaFileInfo>;
  listProfessionalFiles(
    args: ListMediaFilesInput,
  ): Promise<ListMediaFilesResult>;
  deleteFile(fileId: string): Promise<void>;
}

export const MEDIA_STORAGE_SERVICE = 'MEDIA_STORAGE_SERVICE';
