import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Sse,
  ParseIntPipe,
  DefaultValuePipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { InvestigationsService } from './investigations.service';
import { CreateInvestigationDto } from './dto/create-investigation.dto';
import { StreamingService } from '../streaming/streaming.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Investigations')
@Controller('investigations')
export class InvestigationsController {
  constructor(
    private readonly investigationsService: InvestigationsService,
    private readonly streamingService: StreamingService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Crear una nueva investigación multiagente' })
  @ApiResponse({
    status: 201,
    description: 'Investigación creada exitosamente',
  })
  create(@Body() dto: CreateInvestigationDto) {
    return this.investigationsService.create(dto);
  }

  @Post(':id/run')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Ejecutar el workflow multiagente para una investigación',
  })
  run(@Param('id') id: string) {
    return this.investigationsService.run(id);
  }

  @Get()
  @ApiOperation({ summary: 'Listar investigaciones con paginación y filtros' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, type: String })
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('status') status?: string,
  ) {
    return this.investigationsService.findAll(page, limit, status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener detalle completo de una investigación' })
  findOne(@Param('id') id: string) {
    return this.investigationsService.findOne(id);
  }

  @Get(':id/findings')
  @ApiOperation({ summary: 'Obtener hallazgos de una investigación' })
  getFindings(@Param('id') id: string) {
    return this.investigationsService.getFindings(id);
  }

  @Get(':id/agent-runs')
  @ApiOperation({
    summary: 'Obtener ejecuciones de agentes de una investigación',
  })
  getAgentRuns(@Param('id') id: string) {
    return this.investigationsService.getAgentRuns(id);
  }

  @Get(':id/report')
  @ApiOperation({ summary: 'Obtener informe final consolidado' })
  getReport(@Param('id') id: string) {
    return this.investigationsService.getReport(id);
  }

  @Sse(':id/stream')
  @ApiOperation({
    summary: 'Suscribirse a eventos Server-Sent Events (SSE) en tiempo real',
  })
  stream(@Param('id') id: string): Observable<{ data: any }> {
    return this.streamingService.getStream(id);
  }
}
