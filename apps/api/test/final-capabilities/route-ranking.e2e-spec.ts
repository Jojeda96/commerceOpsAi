import { classifyAnswerComponents } from '../../src/agents/supervisor/answer-component-classifier';
import { computeRouteDistribution } from '../../src/agents/logistics/logistics-metrics';

describe('E2E: Q3 Route Ranking by Late Rate', () => {
  const question =
    '¿Cuáles son las rutas interestatales con mayor tasa de atrasos en entregas?';

  it('classifies ROUTE_RANKING_BY_LATE_RATE answer component', () => {
    const components = classifyAnswerComponents(question);
    expect(components).toContain('ROUTE_RANKING_BY_LATE_RATE');
  });

  it('sorts routes descending by lateRatePct when sortBy = LATE_RATE', () => {
    const mockOrders: any[] = [
      // Route SP-RJ: 10 orders, 5 late -> 50%
      ...Array(5).fill({
        primarySellerState: 'SP',
        customerState: 'RJ',
        isLate: true,
        deliveredCustomerDate: new Date('2018-02-10'),
        estimatedDeliveryDate: new Date('2018-02-05'),
        purchaseTimestamp: new Date('2018-02-01'),
      }),
      ...Array(5).fill({
        primarySellerState: 'SP',
        customerState: 'RJ',
        isLate: false,
        deliveredCustomerDate: new Date('2018-02-04'),
        estimatedDeliveryDate: new Date('2018-02-05'),
        purchaseTimestamp: new Date('2018-02-01'),
      }),
      // Route MG-BA: 10 orders, 8 late -> 80%
      ...Array(8).fill({
        primarySellerState: 'MG',
        customerState: 'BA',
        isLate: true,
        deliveredCustomerDate: new Date('2018-02-10'),
        estimatedDeliveryDate: new Date('2018-02-05'),
        purchaseTimestamp: new Date('2018-02-01'),
      }),
      ...Array(2).fill({
        primarySellerState: 'MG',
        customerState: 'BA',
        isLate: false,
        deliveredCustomerDate: new Date('2018-02-04'),
        estimatedDeliveryDate: new Date('2018-02-05'),
        purchaseTimestamp: new Date('2018-02-01'),
      }),
    ];

    const dist = computeRouteDistribution(mockOrders, 10, 10, 'LATE_RATE');
    expect(dist).not.toBeNull();
    expect(dist!.routes.length).toBe(2);

    const routes = dist!.routes;
    for (let i = 1; i < routes.length; i++) {
      expect(routes[i - 1].lateRatePct).toBeGreaterThanOrEqual(
        routes[i].lateRatePct,
      );
    }

    expect(routes[0].routeKey).toBe('MG->BA');
  });
});
