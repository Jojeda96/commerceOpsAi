import { Controller, Get, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SimulationService } from './simulation.service';

@ApiTags('Simulation')
@Controller('simulation')
export class SimulationController {
  constructor(private readonly simulationService: SimulationService) {}

  @Get('date')
  @ApiOperation({ summary: 'Obtener fecha actual simulada del sistema' })
  getDate() {
    return this.simulationService.getDate();
  }

  @Post('advance')
  @ApiOperation({ summary: 'Avanzar la fecha simulada en días (+1, +7, +30)' })
  advance(@Body('days') days = 7) {
    return this.simulationService.advance(days);
  }

  @Post('reset')
  @ApiOperation({ summary: 'Reiniciar el simulador a fecha base inicial' })
  reset() {
    return this.simulationService.reset();
  }

  @Get('alerts')
  @ApiOperation({ summary: 'Obtener alertas operacionales detectadas durante la simulación' })
  getAlerts() {
    return this.simulationService.getAlerts();
  }
}
