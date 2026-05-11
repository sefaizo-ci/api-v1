import type { LoginApp } from '../../core/enums/auth.enums';

export class InitAuthFlowQuery {
  constructor(
    public readonly phone: string,
    public readonly app?: LoginApp,
  ) {}
}
