import { ICommand } from '@nestjs/cqrs';

export class AddServiceCommand implements ICommand {
  constructor(
    public readonly professionalId: string,
    public readonly name: string,
    public readonly description?: string,
    public readonly durationMin: number = 30,
    public readonly basePrice: number = 0,
    public readonly category: string = 'Other',
    public readonly imageUrl?: string,
  ) {}
}

export class RemoveServiceImageCommand implements ICommand {
  constructor(
    public readonly serviceId: string,
    public readonly professionalId: string,
    public readonly imageUrl: string,
  ) {}
}

export class CreateServiceCategoryCommand implements ICommand {
  constructor(
    public readonly name: string,
    public readonly description?: string,
    public readonly createdBy?: string,
  ) {}
}

export class UpdateServiceCategoryCommand implements ICommand {
  constructor(
    public readonly categoryId: string,
    public readonly name?: string,
    public readonly description?: string,
    public readonly updatedBy?: string,
  ) {}
}

export class DeleteServiceCategoryCommand implements ICommand {
  constructor(
    public readonly categoryId: string,
    public readonly deletedBy?: string,
  ) {}
}

export class CreateServiceCategoryRequestCommand implements ICommand {
  constructor(
    public readonly professionalId: string,
    public readonly proposedName: string,
    public readonly proposedDescription?: string,
    public readonly requestedBy?: string,
  ) {}
}

export class ApproveServiceCategoryRequestCommand implements ICommand {
  constructor(
    public readonly requestId: string,
    public readonly reviewedBy: string,
    public readonly approvedName?: string,
    public readonly approvedDescription?: string,
  ) {}
}

export class RejectServiceCategoryRequestCommand implements ICommand {
  constructor(
    public readonly requestId: string,
    public readonly reviewedBy: string,
    public readonly reviewNote?: string,
  ) {}
}

export class UpdateServiceCommand implements ICommand {
  constructor(
    public readonly serviceId: string,
    public readonly name?: string,
    public readonly description?: string,
    public readonly durationMin?: number,
    public readonly basePrice?: number,
    public readonly category?: string,
    public readonly imageUrl?: string,
    public readonly requesterUserId?: string,
  ) {}
}

export class DeleteServiceCommand implements ICommand {
  constructor(
    public readonly serviceId: string,
    public readonly professionalId: string,
  ) {}
}

export class SetServiceCommuneFeeCommand implements ICommand {
  constructor(
    public readonly serviceId: string,
    public readonly professionalId: string,
    public readonly commune: string,
    public readonly travelFee: number,
  ) {}
}

export class ActivateServiceCommand implements ICommand {
  constructor(
    public readonly serviceId: string,
    public readonly professionalId: string,
  ) {}
}

export class DeactivateServiceCommand implements ICommand {
  constructor(
    public readonly serviceId: string,
    public readonly professionalId: string,
  ) {}
}

export class UpsertServicesBulkCommand implements ICommand {
  constructor(
    public readonly professionalId: string,
    public readonly services: Array<{
      id?: string;
      name: string;
      durationMin: number;
      basePrice: number;
      category: string;
      description?: string;
      imageUrl?: string | null;
    }>,
  ) {}
}
