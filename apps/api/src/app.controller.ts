import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PrismaService } from './database/prisma.service';
import { AnalyticsService } from './analytics/analytics.service';

@ApiTags('System')
@Controller()
export class AppController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Estado y salud del servicio API Gateway' })
  getRoot() {
    return {
      name: 'CommerceOps AI API',
      status: 'online',
      version: '0.1.0',
      documentation: '/api/docs',
      endpoints: {
        health: '/api/health',
        investigations: '/api/investigations',
        analyticsRevenue: '/api/analytics/revenue',
        analyticsDeliveries: '/api/analytics/deliveries',
        analyticsReviews: '/api/analytics/reviews',
        analyticsSellers: '/api/analytics/sellers',
        analyticsMlMetrics: '/api/analytics/ml-metrics',
        analyticsMlRuntime: '/api/analytics/ml-runtime',
      },
    };
  }

  @Get('health')
  @ApiOperation({
    summary: 'Salud agregada del sistema multiagente (API, DB, Redis, ML)',
  })
  async getHealth() {
    let dbStatus = 'DOWN';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbStatus = 'UP';
    } catch (e) {
      dbStatus = 'DOWN';
    }

    const mlRuntime = await this.analyticsService.getMlRuntime();
    const mlStatus = (mlRuntime as any)?.runtime_ready ? 'UP' : 'DOWN';

    const services = {
      api: 'UP',
      database: dbStatus,
      redis: 'UP',
      mlRuntime: mlStatus,
    };

    const isFullyUp = dbStatus === 'UP' && mlStatus === 'UP';
    const isAnyUp = dbStatus === 'UP' || mlStatus === 'UP';

    const overallStatus = isFullyUp
      ? 'OPERATIONAL'
      : isAnyUp
        ? 'DEGRADED'
        : 'DOWN';

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      services,
      mlDetails: mlRuntime,
    };
  }
}
