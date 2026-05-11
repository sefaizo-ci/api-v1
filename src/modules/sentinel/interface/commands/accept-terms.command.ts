import { ICommand } from '@nestjs/cqrs';

export class AcceptTermsCommand implements ICommand {
  constructor(public readonly userId: string) {}
}
