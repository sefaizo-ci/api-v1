import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { APP } from './common/constants/routes';

@Controller()
@ApiTags('System')
export class AppController {
  @Get(APP.HEALTH)
  @ApiOperation({ summary: 'Health check' })
  @ApiOkResponse({
    description: 'Service health status',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        status: { type: 'string' },
        service: { type: 'string' },
        timestamp: { type: 'string' },
      },
      example: {
        success: true,
        status: 'ok',
        service: 'sefaizo-api',
        timestamp: '2026-04-12T00:00:00.000Z',
      },
    },
  })
  getHealth() {
    return {
      success: true,
      status: 'ok',
      service: 'sefaizo-api',
      timestamp: new Date().toISOString(),
    };
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
