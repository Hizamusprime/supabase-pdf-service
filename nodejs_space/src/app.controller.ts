import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Health')
@Controller()
export class AppController {
  @Get()
  @ApiOperation({ summary: 'Health check endpoint' })
  getHello() {
    return {
      status: 'ok',
      message: 'Supabase PDF Generation Service',
      version: '1.0.0'
    };
  }
}
