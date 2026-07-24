import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { StreamingService } from '../streaming/streaming.service';

@Injectable()
export class SimulationService {
  private readonly logger = new Logger(SimulationService.name);
  private simulationDate: Date = new Date('2017-02-01T00:00:00.000Z');

  constructor(
    private readonly prisma: PrismaService,
    private readonly streaming: StreamingService
  ) {}

  getDate() {
    return {
      simulationDate: this.simulationDate.toISOString(),
      speed: 'MANUAL',
    };
  }

  async advance(days: number) {
    const prevDate = new Date(this.simulationDate);
    this.simulationDate.setDate(this.simulationDate.getDate() + days);

    this.logger.log(`Avanzando fecha de simulación +${days} días: ${this.simulationDate.toISOString()}`);

    const alerts = await this.checkAlerts(prevDate, this.simulationDate);

    return {
      previousDate: prevDate.toISOString(),
      currentDate: this.simulationDate.toISOString(),
      daysAdvanced: days,
      alertsDetected: alerts.length,
      alerts,
    };
  }

  async reset() {
    this.simulationDate = new Date('2017-02-01T00:00:00.000Z');
    return this.getDate();
  }

  async getAlerts() {
    return this.prisma.businessAlert.findMany({
      orderBy: { detectedAt: 'desc' },
      take: 20,
    });
  }

  private async checkAlerts(fromDate: Date, toDate: Date) {
    const orders = await this.prisma.olistOrder.findMany({
      where: {
        orderPurchaseTimestamp: {
          gte: fromDate,
          lte: toDate,
        },
      },
    });

    const alerts = [];
    if (orders.length > 50) {
      const alert = await this.prisma.businessAlert.create({
        data: {
          alertType: 'ORDER_SPIKE_DETECTED',
          entityType: 'ORDERS',
          entityId: 'ALL',
          severity: 'MEDIUM',
          detectedAt: this.simulationDate,
          metricsJson: { orderCount: orders.length },
        },
      });
      alerts.push(alert);
    }

    return alerts;
  }
}
