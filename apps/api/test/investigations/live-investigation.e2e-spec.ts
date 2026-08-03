import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';

describe('Live E2E Investigation Execution Test', () => {
  let app: INestApplication;
  let token: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    // Authenticate
    const authRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'demo@commerceops.ai', password: 'demo123' })
      .expect(201);

    token = authRes.body.accessToken;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('should authenticate, execute investigation via HTTP POST, poll to completion and verify clean status', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/api/investigations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        question:
          '¿Cuál es el volumen total de ventas, ingresos y rendimiento logístico por región?',
      })
      .expect(201);

    const investigationId = createRes.body.id || createRes.body.investigationId;
    expect(investigationId).toBeDefined();

    const runRes = await request(app.getHttpServer())
      .post(`/api/investigations/${investigationId}/run`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    expect(runRes.body.status).toBe('QUEUED');

    let completedData: any = null;
    let attempts = 0;
    const maxAttempts = 30;

    while (attempts < maxAttempts) {
      await new Promise((res) => setTimeout(res, 2000));

      const getRes = await request(app.getHttpServer())
        .get(`/api/investigations/${investigationId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const status = getRes.body.status;
      console.log(`[Poll ${attempts + 1}] Investigation Status: ${status}`);
      if (
        status === 'COMPLETED' ||
        status === 'COMPLETED_WITH_WARNINGS' ||
        status === 'NEEDS_HUMAN_REVIEW' ||
        status === 'REJECTED' ||
        status === 'FAILED'
      ) {
        completedData = getRes.body;
        break;
      }
      attempts++;
    }

    expect(completedData).not.toBeNull();
    expect(completedData.status).toMatch(
      /COMPLETED|COMPLETED_WITH_WARNINGS|NEEDS_HUMAN_REVIEW|APPROVED/,
    );
    expect(completedData.findings).toBeDefined();
    console.log(
      '--- TEST E2E HTTP CON AUTENTICACIÓN COMPLETADO EXITOSAMENTE ---',
    );
    console.log('ID:', completedData.id);
    console.log('Status final:', completedData.status);
    console.log('Findings activos:', (completedData.findings || []).length);
  }, 90000);
});
