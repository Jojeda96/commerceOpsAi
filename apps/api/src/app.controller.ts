import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('System')
@Controller()
export class AppController {
  @Get()
  @ApiOperation({ summary: 'Estado y salud del servicio API Gateway' })
  getHealth() {
    return {
      name: 'CommerceOps AI API',
      status: 'online',
      version: '0.1.0',
      frontend: 'http://localhost:3000',
      documentation: '/api/docs',
      endpoints: {
        investigations: '/api/investigations',
        analyticsRevenue: '/api/analytics/revenue',
        analyticsDeliveries: '/api/analytics/deliveries',
        analyticsReviews: '/api/analytics/reviews',
        analyticsSellers: '/api/analytics/sellers',
        simulationDate: '/api/simulation/date',
      },
    };
  }
}
