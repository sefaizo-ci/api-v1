import type { INestApplication } from '@nestjs/common';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { createNestApp } from '../src/main';

let appPromise: Promise<INestApplication> | undefined;

async function getApp(): Promise<INestApplication> {
  if (!appPromise) {
    appPromise = createNestApp().then(async (app) => {
      await app.init();
      return app;
    });
  }

  return appPromise;
}

export default async function handler(req: Request, res: Response) {
  const app = await getApp();
  const server = app.getHttpAdapter().getInstance() as RequestHandler;

  return new Promise<void>((resolve, reject) => {
    res.on('finish', resolve);
    res.on('error', reject);

    server(req, res, ((error?: unknown) => {
      if (error) {
        reject(
          error instanceof Error
            ? error
            : new Error('Express handler failed'),
        );
      }
    }) as NextFunction);
  });
}
