import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { BadRequestException } from '../../libs/exceptions/domain.exceptions';
import type { MediaUploadKind } from './media-storage.port';

/**
 * Server-signed binding between a reserved storage `fileId` and the
 * professional it was issued to. The client cannot forge it, so at confirm
 * time we trust this token (not the file path, which the client controls) to
 * decide ownership and what to persist. Self-contained and stateless — no DB
 * row to track, which suits serverless.
 */
export type UploadTokenPayload = {
  professionalId: string;
  fileId: string;
  type: MediaUploadKind;
  serviceId?: string;
};

const TOKEN_TTL = '15m';

@Injectable()
export class MediaUploadTokenService {
  constructor(private readonly jwtService: JwtService) {}

  issue(payload: UploadTokenPayload): string {
    return this.jwtService.sign(
      { ...payload, scope: 'media-upload' },
      { expiresIn: TOKEN_TTL },
    );
  }

  verify(token: string): UploadTokenPayload {
    let decoded: UploadTokenPayload & { scope?: string };
    try {
      decoded = this.jwtService.verify(token);
    } catch {
      throw new BadRequestException(
        'Jeton d’upload invalide ou expiré. Redemandez un upload-intent.',
      );
    }
    if (decoded.scope !== 'media-upload' || !decoded.fileId) {
      throw new BadRequestException('Jeton d’upload invalide.');
    }
    return {
      professionalId: decoded.professionalId,
      fileId: decoded.fileId,
      type: decoded.type,
      serviceId: decoded.serviceId,
    };
  }
}
