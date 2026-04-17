import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  CreateProfessionalProfileDto,
  ReorderGalleryDto,
  SetAvailabilityDto,
  SetCommuneFeeDto,
  UploadGalleryItemDto,
} from './index';

describe('Professional DTO validation', () => {
  it('rejects invalid profile payload (short name + invalid avatar url)', async () => {
    const dto = plainToInstance(CreateProfessionalProfileDto, {
      agencyName: 'A',
      avatarUrl: 'not-a-url',
    });

    const errors = await validate(dto);
    const fields = errors.map((error) => error.property);

    expect(fields).toContain('agencyName');
    expect(fields).toContain('avatarUrl');
  });

  it('rejects invalid commune fee payload (negative fee)', async () => {
    const dto = plainToInstance(SetCommuneFeeDto, {
      commune: 'Cocody',
      travelFee: -1,
    });

    const errors = await validate(dto);
    const fields = errors.map((error) => error.property);

    expect(fields).toContain('travelFee');
  });

  it('rejects invalid availability payload (day out of range + bad time)', async () => {
    const dto = plainToInstance(SetAvailabilityDto, {
      dayOfWeek: 9,
      startTime: '25:00',
      endTime: '17:00',
    });

    const errors = await validate(dto);
    const fields = errors.map((error) => error.property);

    expect(fields).toContain('dayOfWeek');
    expect(fields).toContain('startTime');
  });

  it('rejects invalid gallery payload (non-url image)', async () => {
    const dto = plainToInstance(UploadGalleryItemDto, {
      imageUrl: 'invalid-image-path',
    });

    const errors = await validate(dto);
    const fields = errors.map((error) => error.property);

    expect(fields).toContain('imageUrl');
  });

  it('rejects invalid gallery reorder payload (non-uuid id)', async () => {
    const dto = plainToInstance(ReorderGalleryDto, {
      itemOrders: [{ id: 'not-uuid', order: 0 }],
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.property).toBe('itemOrders');
  });
});
