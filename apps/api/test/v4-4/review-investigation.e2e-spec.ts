import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';

describe('V4.4 Acceptance Query A: Review Complaints (E2E)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('POST /investigations - review complaint question routes only to CUSTOMER_EXPERIENCE and produces grounded finding', async () => {
    const question =
      '¿Cuáles son las quejas principales en las reseñas de clientes sobre demoras en la entrega y paquetes dañados?';

    const response = await request(app.getHttpServer())
      .post('/investigations')
      .send({ question })
      .expect(201);

    const body = response.body;

    expect(body.status).toBe('COMPLETED');
    expect(body.selectedAgents).toEqual(['CUSTOMER_EXPERIENCE']);
    expect(body.selectedAgents).not.toContain('LOGISTICS');

    const cxFinding = body.findings.find(
      (f: any) => f.agentName === 'CUSTOMER_EXPERIENCE',
    );
    expect(cxFinding).toBeDefined();
    expect(cxFinding.findingType).toBe('REVIEW_COMPLAINT_ANALYSIS');
    expect(cxFinding.auditStatus).toBe('APPROVED');
    expect(cxFinding.methodClaims).toContain('REVIEW_LEXICON_AGGREGATION');
  });
});
