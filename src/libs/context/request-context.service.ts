import { AsyncLocalStorage } from 'async_hooks';

interface RequestContext {
  requestId: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

export class RequestContextService {
  static getRequestId(): string {
    return storage.getStore()?.requestId ?? 'n/a';
  }

  static run(context: RequestContext, callback: () => void): void {
    storage.run(context, callback);
  }
}
