import { TestCase } from './index';

export const EVAL_TEST_CASES: TestCase[] = [
  {
    id: 'EVAL-001',
    category: 'LOGISTICS',
    question: '¿Cuál fue la tasa de retraso general en entregas durante febrero de 2018?',
    expectedAgents: ['LOGISTICS'],
    expectedTools: ['get_delivery_summary'],
    expectedMetric: {
      name: 'lateRate',
      expectedValue: 12.6,
      tolerancePercent: 5,
    },
  },
  {
    id: 'EVAL-002',
    category: 'SALES',
    question: '¿Cuáles son las 5 categorías con mayores ingresos acumulados?',
    expectedAgents: ['SALES'],
    expectedTools: ['get_sales_by_category'],
    expectedMetric: {
      name: 'topCategory',
      expectedValue: 'beleza_saude',
    },
  },
  {
    id: 'EVAL-003',
    category: 'CUSTOMER_EXPERIENCE',
    question: '¿Cuál es la distribución de calificaciones de 1 a 5 estrellas en las reseñas?',
    expectedAgents: ['CUSTOMER_EXPERIENCE'],
    expectedTools: ['get_rating_summary'],
    expectedMetric: {
      name: 'averageRating',
      expectedValue: 4.08,
      tolerancePercent: 5,
    },
  },
  {
    id: 'EVAL-004',
    category: 'SELLER_PERFORMANCE',
    question: 'Evalúa el rendimiento y riesgo operacional del vendedor con mayores ventas.',
    expectedAgents: ['SELLER_PERFORMANCE'],
    expectedTools: ['get_seller_scorecard'],
    expectedMetric: {
      name: 'riskScore',
      expectedValue: 'LOW',
    },
  },
  {
    id: 'EVAL-005',
    category: 'MULTI_AGENT',
    question: '¿Por qué disminuyó la calificación promedio en febrero de 2018?',
    expectedAgents: ['SALES', 'LOGISTICS', 'CUSTOMER_EXPERIENCE', 'CRITIC', 'STRATEGY'],
    expectedTools: ['get_revenue_summary', 'get_delivery_summary', 'get_rating_summary'],
    expectedMetric: {
      name: 'qualityScore',
      expectedValue: 90,
      tolerancePercent: 10,
    },
  },
];
