import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';

@ApiTags('Analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('revenue')
  @ApiOperation({
    summary: 'Obtener resumen determinista de ingresos y ventas',
  })
  getRevenueSummary(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getRevenueSummary(query);
  }

  @Get('deliveries')
  @ApiOperation({
    summary: 'Obtener resumen determinista de entregas y atrasos',
  })
  getDeliveriesSummary(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getDeliveriesSummary(query);
  }

  @Get('reviews')
  @ApiOperation({
    summary:
      'Obtener resumen determinista de calificaciones y distribución de estrellas',
  })
  getReviewsSummary(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getReviewsSummary(query);
  }

  @Get('sellers')
  @ApiOperation({ summary: 'Obtener ranking de vendedores por ingresos' })
  getSellersSummary(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getSellersSummary(query);
  }

  @Get('ml-metrics')
  @ApiOperation({ summary: 'Proxy de métricas de gobernanza ML' })
  getMlMetrics() {
    return this.analyticsService.getMlMetrics();
  }

  @Get('ml-runtime')
  @ApiOperation({ summary: 'Proxy del estado de runtime del servicio ML' })
  getMlRuntime() {
    return this.analyticsService.getMlRuntime();
  }

  @Get('ml-validation')
  @ApiOperation({
    summary: 'Walk-forward CV y validación temporal del champion',
  })
  getMlValidation() {
    return this.analyticsService.getMlValidation();
  }

  @Get('ml-drift')
  @ApiOperation({
    summary: 'Reporte de drift de features entre entrenamiento y test',
  })
  getMlDrift() {
    return this.analyticsService.getMlDrift();
  }

  @Get('ml-defense')
  @ApiOperation({
    summary:
      'Preguntas y respuestas de defensa Data Scientist con snapshot de métricas',
  })
  getMlDefense() {
    return this.analyticsService.getMlDefense();
  }
}
