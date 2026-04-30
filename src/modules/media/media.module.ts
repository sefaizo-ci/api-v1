import { Module } from '@nestjs/common';
import { AppwriteMediaService } from './appwrite-media.service';
import { MEDIA_STORAGE_SERVICE } from './media-storage.port';
import { MediaController } from './media.controller';

// To switch storage provider: replace AppwriteMediaService with another
// class that implements MediaStoragePort and update useClass below.
@Module({
  controllers: [MediaController],
  providers: [
    {
      provide: MEDIA_STORAGE_SERVICE,
      useClass: AppwriteMediaService,
    },
  ],
  exports: [MEDIA_STORAGE_SERVICE],
})
export class MediaModule {}
