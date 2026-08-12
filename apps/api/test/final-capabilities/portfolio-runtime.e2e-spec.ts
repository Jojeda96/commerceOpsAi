import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';

import '../support/mock-chat-openai';
import { AppModule } from '../../src/app.module';

describe('Portfolio Final Capability Runtime Matrix (E2E)', () => {
  jest.setTimeout(180000);

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

  async function runInvestigation(question: string) {
    const createRes = await request(app.getHttpServer())
      .post('/investigations')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send({ question })
      .expect(201);

    const investigationId = createRes.body.id;

    expect(investigationId).toBeDefined();

    await request(app.getHttpServer())
      .post(`/investigations/${investigationId}/run`)
      .set('Authorization', `Bearer ${jwtToken}`)
      .expect(201);

    let body: any = {};

    for (let attempt = 0; attempt < 100; attempt++) {
      const detailRes = await request(app.getHttpServer())
        .get(`/investigations/${investigationId}`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(200);

      body = detailRes.body;

      if (
        [
          'COMPLETED',
          'COMPLETED_WITH_WARNINGS',
          'NEEDS_HUMAN_REVIEW',
          'FAILED',
          'REJECTED',
        ].includes(body.status)
      ) {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    if (body.status !== 'COMPLETED') {
      console.log(`[E2E Debug] ${question} -> status=${body.status}`, {
        criticFeedback: body.criticFeedback,
        findings: body.findings,
      });
    }

    return body;
  }

  function executedAgents(body: any): string[] {
    return (body.agentRuns || []).map((run: any) => run.agentName);
  }

  function toolExecutions(body: any): any[] {
    return (body.agentRuns || []).flatMap(
      (run: any) => run.toolExecutions || [],
    );
  }

  function findingFor(body: any, agentName: string) {
    return (body.findings || []).find(
      (finding: any) =>
        finding.agentName === agentName || finding.agent === agentName,
    );
  }

  function metricKeys(finding: any): string[] {
    return (finding?.numericClaims || []).map((claim: any) => claim.metricKey);
  }

  it('Q1 seller top revenue is grounded and completes', async () => {
    const body = await runInvestigation(
      'Evalúa el riesgo operacional y rendimiento acumulado del vendedor con mayores ventas.',
    );

    expect(body.status).toBe('COMPLETED');

    expect(executedAgents(body)).toContain('SELLER_PERFORMANCE');

    expect(executedAgents(body)).not.toContain('LOGISTICS');

    const finding = findingFor(body, 'SELLER_PERFORMANCE');

    expect(finding).toBeDefined();

    expect(finding.auditStatus).toBe('APPROVED');

    expect(finding.description).toMatch(/Vendedor con mayores ventas/i);

    expect(metricKeys(finding)).toEqual(
      expect.arrayContaining([
        'seller.revenue',
        'seller.gmv',
        'seller.unique_orders',
        'seller.items_sold',
        'seller.late_rate_pct',
        'seller.average_rating',
      ]),
    );

    const tools = toolExecutions(body);

    expect(
      tools.some((tool: any) => tool.toolName === 'get_top_seller_by_revenue'),
    ).toBe(true);

    expect(
      tools.some((tool: any) => tool.toolName === 'get_seller_scorecard'),
    ).toBe(true);
  });

  it('Q2 furniture Feb vs Jan uses category and comparison scope', async () => {
    const body = await runInvestigation(
      '¿Cómo cambió la tasa de entregas tardías de la categoría muebles en febrero de 2018 respecto de enero de 2018?',
    );

    expect(body.status).toBe('COMPLETED');

    const scope = body.resolvedScopeJson;

    expect(scope.categories).toEqual(['moveis_decoracao']);

    expect(scope.comparison).toBeDefined();

    const finding = findingFor(body, 'LOGISTICS');

    expect(finding.auditStatus).toBe('APPROVED');

    expect(metricKeys(finding)).toEqual(
      expect.arrayContaining([
        'delivery.comparison.target_late_rate_pct',
        'delivery.comparison.reference_late_rate_pct',
        'delivery.comparison.delta_percentage_points',
        'delivery.comparison.relative_change_pct',
      ]),
    );
  });

  it('Q3 routes are requested with LATE_RATE sorting', async () => {
    const body = await runInvestigation(
      '¿Cuáles son las rutas interestatales con mayor tasa de atrasos en entregas?',
    );

    expect(body.status).toBe('COMPLETED');

    const routeTool = toolExecutions(body).find(
      (tool: any) => tool.toolName === 'get_delivery_performance_by_route',
    );

    expect(routeTool).toBeDefined();

    expect(routeTool.parametersJson?.sortBy).toBe('LATE_RATE');

    const finding = findingFor(body, 'LOGISTICS');

    expect(finding.auditStatus).toBe('APPROVED');
  });

  it('Q4 top categories has 5 grounded categories', async () => {
    const body = await runInvestigation(
      '¿Cuáles son las 5 categorías que concentran mayores ingresos y cuál es su ticket promedio?',
    );

    expect(body.status).toBe('COMPLETED');

    expect(executedAgents(body)).toEqual(expect.arrayContaining(['SALES']));

    expect(executedAgents(body)).not.toContain('LOGISTICS');

    const finding = findingFor(body, 'SALES');

    expect(finding.auditStatus).toBe('APPROVED');

    const keys = metricKeys(finding);

    const categoryRevenueKeys = keys.filter(
      (key) => key.startsWith('sales.category.') && key.endsWith('.revenue'),
    );

    expect(categoryRevenueKeys).toHaveLength(5);

    expect(finding.description).toMatch(/ticket promedio/i);
  });

  it('Q5 payment comparison is fully grounded', async () => {
    const body = await runInvestigation(
      '¿Cuál es la diferencia en volumen de ventas e ingresos entre pagos con tarjeta de crédito y boleto bancario?',
    );

    expect(body.status).toBe('COMPLETED');

    const finding = findingFor(body, 'SALES');

    expect(finding.auditStatus).toBe('APPROVED');

    expect(metricKeys(finding)).toEqual(
      expect.arrayContaining([
        'sales.payment.credit_card.total_value',
        'sales.payment.credit_card.transaction_count',
        'sales.payment.boleto.total_value',
        'sales.payment.boleto.transaction_count',
        'sales.payment.comparison.revenue_delta',
        'sales.payment.comparison.revenue_delta_pct',
        'sales.payment.comparison.transaction_delta',
        'sales.payment.comparison.transaction_delta_pct',
      ]),
    );
  });

  it('Q6 rating comparison is grounded and completes', async () => {
    const body = await runInvestigation(
      '¿Cómo cambió la calificación promedio de los clientes en febrero de 2018 respecto de enero de 2018?',
    );

    expect(body.status).toBe('COMPLETED');

    expect(executedAgents(body)).toContain('CUSTOMER_EXPERIENCE');

    const finding = findingFor(body, 'CUSTOMER_EXPERIENCE');

    expect(finding.auditStatus).toBe('APPROVED');

    expect(metricKeys(finding)).toEqual(
      expect.arrayContaining([
        'reviews.comparison.target_rating',
        'reviews.comparison.reference_rating',
        'reviews.comparison.delta_rating',
        'reviews.comparison.relative_change_pct',
      ]),
    );
  });

  it('Q7 passes review score and category filters to complaint tool', async () => {
    const body = await runInvestigation(
      '¿Cuáles son las quejas principales en las reseñas de 1 estrella sobre la categoría informatica_acessorios?',
    );

    expect(body.status).toBe('COMPLETED');

    const scope = body.resolvedScopeJson;

    expect(scope.categories).toEqual(['informatica_acessorios']);

    expect(scope.reviewScores).toEqual([1]);

    const complaintTool = toolExecutions(body).find(
      (tool: any) => tool.toolName === 'analyze_review_complaints',
    );

    expect(complaintTool).toBeDefined();

    expect(complaintTool.parametersJson?.minimumReviewScore).toBe(1);

    expect(complaintTool.parametersJson?.maximumReviewScore).toBe(1);

    const finding = findingFor(body, 'CUSTOMER_EXPERIENCE');

    expect(finding.auditStatus).toBe('APPROVED');
  });
});
