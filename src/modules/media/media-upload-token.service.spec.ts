import { JwtService } from '@nestjs/jwt';
import { BadRequestException } from '../../libs/exceptions/domain.exceptions';
import { MediaUploadTokenService } from './media-upload-token.service';

describe('MediaUploadTokenService', () => {
  const jwt = new JwtService({ secret: 'test-secret' });
  const service = new MediaUploadTokenService(jwt);

  it('round-trips an issued token back to its payload', () => {
    const token = service.issue({
      professionalId: 'pro-1',
      fileId: 'file-1',
      type: 'service',
      serviceId: 'svc-1',
    });

    expect(service.verify(token)).toEqual({
      professionalId: 'pro-1',
      fileId: 'file-1',
      type: 'service',
      serviceId: 'svc-1',
    });
  });

  it('rejects a token signed with a different secret (forgery)', () => {
    const forged = new JwtService({ secret: 'other-secret' }).sign({
      professionalId: 'attacker',
      fileId: 'file-x',
      type: 'gallery',
      scope: 'media-upload',
    });

    expect(() => service.verify(forged)).toThrow(BadRequestException);
  });

  it('rejects a token that is not scoped to media uploads', () => {
    const wrongScope = jwt.sign({
      professionalId: 'pro-1',
      fileId: 'file-1',
      type: 'gallery',
    });

    expect(() => service.verify(wrongScope)).toThrow(BadRequestException);
  });
});
