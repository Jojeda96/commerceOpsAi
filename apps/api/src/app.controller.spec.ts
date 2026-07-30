import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { PrismaService } from './database/prisma.service';
import { AnalyticsService } from './analytics/analytics.service';

describe('AppController', () => {
  let appController: AppController;

  const mockPrismaService = {
    $queryRaw: jest.fn().mockResolvedValue([{ 1: 1 }]),
  };

  const mockAnalyticsService = {
    getMlRuntime: jest.fn().mockResolvedValue({
      runtime_ready: true,
      deployment_status: 'EXPERIMENTAL_NOT_APPROVED',
    }),
  };

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AnalyticsService, useValue: mockAnalyticsService },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('getRoot', () => {
    it('should return root info object', () => {
      const info = appController.getRoot();
      expect(info).toBeDefined();
      expect(info.name).toBe('CommerceOps AI API');
      expect(info.status).toBe('online');
      expect(info.endpoints).toBeDefined();
      expect(info.endpoints.investigations).toBe('/api/investigations');
    });
  });

  describe('getHealth', () => {
    it('should return aggregated health status', async () => {
      const health = await appController.getHealth();
      expect(health).toBeDefined();
      expect(health.status).toBe('OPERATIONAL');
      expect(health.services.api).toBe('UP');
      expect(health.services.database).toBe('UP');
      expect(health.services.mlRuntime).toBe('UP');
    });
  });
});
