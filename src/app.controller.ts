import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';
import { APP } from './common/constants/routes';

@Controller()
@ApiTags('System')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get(APP.HEALTH)
  @ApiOperation({ summary: 'Health check' })
  @ApiOkResponse({
    description: 'Service health status',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        status: { type: 'string', enum: ['ok', 'degraded'] },
        service: { type: 'string' },
        timestamp: { type: 'string' },
        checks: {
          type: 'object',
          properties: {
            postgres: { type: 'string', enum: ['ok', 'error'] },
            redis: { type: 'string', enum: ['ok', 'error'] },
          },
        },
      },
      example: {
        success: true,
        status: 'ok',
        service: 'sefaizo-api',
        timestamp: '2026-04-12T00:00:00.000Z',
        checks: { postgres: 'ok', redis: 'ok' },
      },
    },
  })
  getHealth() {
    return this.appService.getHealth();
  }

  @Get(APP.ROOT)
  @ApiOperation({ summary: 'Root endpoint' })
  @ApiOkResponse({
    description: 'API root status',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
      },
      example: {
        success: true,
        message: 'Sefaizo API is running.',
      },
    },
  })
  root() {
    return {
      success: true,
      message: 'Sefaizo API is running.',
    };
  }
}
