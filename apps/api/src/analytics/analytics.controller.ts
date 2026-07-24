import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';

@ApiTags('Analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('revenue')
  @ApiOperation({ summary: 'Obtener resumen determinista de ingresos y ventas' })
  getRevenueSummary(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getRevenueSummary(query);
  }

  @Get('deliveries')
  @ApiOperation({ summary: 'Obtener resumen determinista de entregas y atrasos' })
  getDeliveriesSummary(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getDeliveriesSummary(query);
  }

  @Get('reviews')
  @ApiOperation({ summary: 'Obtener resumen determinista de calificaciones y distribución de estrellas' })
  getReviewsSummary(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getReviewsSummary(query);
  }

  @Get('sellers')
  @ApiOperation({ summary: 'Obtener ranking de vendedores por ingresos' })
  getSellersSummary(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getSellersSummary(query);
  }
}
