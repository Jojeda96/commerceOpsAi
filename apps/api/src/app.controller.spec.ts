import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('getHealth', () => {
    it('should return health status object', () => {
      const health = appController.getHealth();
      expect(health).toBeDefined();
      expect(health.name).toBe('CommerceOps AI API');
      expect(health.status).toBe('online');
      expect(health.endpoints).toBeDefined();
      expect(health.endpoints.investigations).toBe('/api/investigations');
    });
  });
});
