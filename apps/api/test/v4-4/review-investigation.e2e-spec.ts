import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import '../support/mock-chat-openai';
import { AppModule } from '../../src/app.module';

describe('V4.4 Acceptance Query A: Review Complaints (E2E)', () => {
  jest.setTimeout(30000);
  let app: INestApplication;
  let jwtToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    const jwtService = app.get(JwtService);
    jwtToken = jwtService.sign({
      sub: 'user-demo-1',
      email: 'demo@commerceops.ai',
      role: 'admin',
    });
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('POST /investigations & /run - review complaint question routes only to CUSTOMER_EXPERIENCE and produces grounded finding', async () => {
    const question =
      '¿Cuáles son las quejas principales en las reseñas de clientes sobre demoras en la entrega y paquetes dañados?';

    const createRes = await request(app.getHttpServer())
      .post('/investigations')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send({ question })
      .expect(201);

    const invId = createRes.body.id;
    expect(invId).toBeDefined();

    await request(app.getHttpServer())
      .post(`/investigations/${invId}/run`)
      .set('Authorization', `Bearer ${jwtToken}`)
      .expect(201);

    let body: any = {};
    for (let i = 0; i < 20; i++) {
      const detailRes = await request(app.getHttpServer())
        .get(`/investigations/${invId}`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(200);

      body = detailRes.body;
      if (
        body.status === 'COMPLETED' ||
        body.status === 'FAILED' ||
        body.status === 'REJECTED'
      ) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    expect(body.status).toBe('COMPLETED');
    const executedAgents = (body.agentRuns || []).map(
      (ar: any) => ar.agentName,
    );
    expect(executedAgents).toContain('CUSTOMER_EXPERIENCE');
    expect(executedAgents).not.toContain('LOGISTICS');

    const cxFinding = body.findings?.find(
      (f: any) =>
        f.agentName === 'CUSTOMER_EXPERIENCE' ||
        f.agent === 'CUSTOMER_EXPERIENCE',
    );
    expect(cxFinding).toBeDefined();
    expect(cxFinding.findingType).toBe('REVIEW_COMPLAINT_ANALYSIS');
    expect(cxFinding.auditStatus).toBe('APPROVED');
    const methods = (cxFinding.methodClaims || []).map(
      (mc: any) => mc.method || mc,
    );
    expect(methods).toContain('REVIEW_LEXICON_AGGREGATION');
  });
});
