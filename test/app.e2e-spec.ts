import {
  INestApplication,
  RequestMethod,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { APP } from '../src/common/constants/routes';
import { AppModule } from './../src/app.module';

type RootResponse = {
  success: boolean;
  message: string;
};

type HealthResponse = {
  success: boolean;
  status: string;
  service: string;
};

type ProfessionalListResponse = {
  data: unknown[];
  pagination: unknown;
};

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix(APP.API.PREFIX, {
      exclude: [
        { path: APP.HEALTH, method: RequestMethod.GET },
        { path: APP.ROOT, method: RequestMethod.GET },
      ],
    });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect(({ body }: { body: RootResponse }) => {
        expect(body.success).toBe(true);
        expect(body.message).toBe('Sefaizo API is running.');
      });
  });

  it('/health (GET)', () => {
    return request(app.getHttpServer())
      .get(`/${APP.HEALTH}`)
      .expect(200)
      .expect(({ body }: { body: HealthResponse }) => {
        expect(body.success).toBe(true);
        expect(body.status).toBe('ok');
        expect(body.service).toBe('sefaizo-api');
      });
  });

  it('/professional (GET) should be public', () => {
    return request(app.getHttpServer())
      .get(`/${APP.API.PREFIX}/professional`)
      .expect(200)
      .expect(({ body }: { body: ProfessionalListResponse }) => {
        expect(Array.isArray(body.data)).toBe(true);
        expect(body.pagination).toBeDefined();
      });
  });

  it('/professional/profile/me (GET) should require auth', () => {
    return request(app.getHttpServer())
      .get(`/${APP.API.PREFIX}/professional/profile/me`)
      .expect(401);
  });
});
