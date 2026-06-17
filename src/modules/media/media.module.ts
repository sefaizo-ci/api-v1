import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AppwriteMediaService } from './appwrite-media.service';
import { MEDIA_STORAGE_SERVICE } from './media-storage.port';
import { MediaController } from './media.controller';
import { MediaUploadTokenService } from './media-upload-token.service';

// To switch storage provider: replace AppwriteMediaService with another
// class that implements MediaStoragePort and update useClass below.
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
      }),
    }),
  ],
  controllers: [MediaController],
  providers: [
    {
      provide: MEDIA_STORAGE_SERVICE,
      useClass: AppwriteMediaService,
    },
    MediaUploadTokenService,
  ],
  exports: [MEDIA_STORAGE_SERVICE, MediaUploadTokenService],
})
export class MediaModule {}
