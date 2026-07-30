import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';

describe('Live E2E Investigation Execution Test', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  }, 30000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('should authenticate, execute investigation via HTTP POST, poll to completion and verify clean status', async () => {
    // 1. Login para obtener JWT
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: process.env.DEMO_USER_EMAIL || 'demo@commerceops.ai',
        password: process.env.DEMO_USER_PASSWORD || 'demo123',
      })
      .expect(201);

    const token = loginRes.body.accessToken;
    expect(token).toBeDefined();

    // 2. Crear investigación con Bearer Token
    const postRes = await request(app.getHttpServer())
      .post('/api/investigations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        question: 'Detecta picos anómalos en la tasa de retraso de entregas mediante Z-Score',
      })
      .expect(201);

    expect(postRes.body.id).toBeDefined();
    const investigationId = postRes.body.id;

    // 3. Iniciar ejecución del workflow multiagente
    await request(app.getHttpServer())
      .post(`/api/investigations/${investigationId}/run`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    // 4. Polling hasta completar la investigación
    let attempts = 0;
    let completedData: any = null;

    while (attempts < 40) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const getRes = await request(app.getHttpServer())
        .get(`/api/investigations/${investigationId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const status = getRes.body.status;
      console.log(`[Poll ${attempts + 1}] Investigation Status: ${status}`);
      if (
        status === 'COMPLETED' ||
        status === 'COMPLETED_WITH_WARNINGS' ||
        status === 'REJECTED' ||
        status === 'FAILED'
      ) {
        completedData = getRes.body;
        break;
      }
      attempts++;
    }

    expect(completedData).not.toBeNull();
    expect(completedData.status).toMatch(/COMPLETED|COMPLETED_WITH_WARNINGS|APPROVED/);
    expect(completedData.findings).toBeDefined();
    console.log('--- TEST E2E HTTP CON AUTENTICACIÓN COMPLETADO EXITOSAMENTE ---');
    console.log('ID:', completedData.id);
    console.log('Status final:', completedData.status);
    console.log('Findings activos:', (completedData.findings || []).length);
  }, 90000);
});

