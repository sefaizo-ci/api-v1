import {
  BadRequestException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Inject,
  Param,
  ParseIntPipe,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../../libs/database/prisma.service';
import { Roles } from '../../libs/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/infrastructure/guards/roles.guard';
import type { MediaStoragePort } from './media-storage.port';
import { MEDIA_STORAGE_SERVICE } from './media-storage.port';

type AuthenticatedRequest = Request & {
  user: {
    id: string;
    role: string;
    roles?: string[];
  };
};

@Controller('media')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('PROFESSIONAL', 'ADMIN')
export class MediaController {
  constructor(
    @Inject(MEDIA_STORAGE_SERVICE)
    private readonly mediaStorageService: MediaStoragePort,
    private readonly prisma: PrismaService,
  ) {}

  @Get('files/:fileId')
  async getFileInfo(
    @Param('fileId') fileId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const file = await this.mediaStorageService.getFileInfo(fileId);
    await this.assertMediaAccess(req, file.fileName);
    return file;
  }

  @Get('professionals/:professionalId/files')
  async listProfessionalFiles(
    @Param('professionalId') professionalId: string,
    @Req() req: AuthenticatedRequest,
    @Query('type') type: 'gallery' | 'avatar' = 'gallery',
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    if (!['gallery', 'avatar'].includes(type)) {
      throw new BadRequestException('Le type doit etre gallery ou avatar');
    }

    await this.assertProfessionalOwnership(req, professionalId);

    return this.mediaStorageService.listProfessionalFiles({
      professionalId,
      type,
      page,
      limit,
    });
  }

  @Delete('files/:fileId')
  async deleteFile(
    @Param('fileId') fileId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const file = await this.mediaStorageService.getFileInfo(fileId);
    await this.assertMediaAccess(req, file.fileName);

    await this.mediaStorageService.deleteFile(fileId);
    return {
      success: true,
    };
  }

  private async assertMediaAccess(
    req: AuthenticatedRequest,
    fileName: string,
  ): Promise<void> {
    if (req.user.role === 'ADMIN' || req.user.roles?.includes('ADMIN')) {
      return;
    }

    const professionalId = this.extractProfessionalId(fileName);
    if (!professionalId) {
      throw new ForbiddenException(
        'Impossible de verifier le proprietaire du media',
      );
    }

    await this.assertProfessionalOwnership(req, professionalId);
  }

  private extractProfessionalId(fileName: string): string | null {
    const match = /^professionals\/([^/]+)\//.exec(fileName);
    return match?.[1] ?? null;
  }

  private async assertProfessionalOwnership(
    req: AuthenticatedRequest,
    professionalId: string,
  ): Promise<void> {
    if (req.user.role === 'ADMIN' || req.user.roles?.includes('ADMIN')) {
      return;
    }

    const professional = await this.prisma.professional.findFirst({
      where: {
        id: professionalId,
        deletedAt: null,
      },
      select: {
        userId: true,
      },
    });

    if (!professional || professional.userId !== req.user.id) {
      throw new ForbiddenException('Acces interdit a ce media');
    }
  }
}
