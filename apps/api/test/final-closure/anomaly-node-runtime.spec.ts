import { createAnomalyNode } from '../../src/agents/anomaly/anomaly.node';

describe('Anomaly Node Runtime (PR-00 / PR-01 baseline)', () => {
  it('should run anomaly node deterministically using buildAnomalyFinding and not invoke ChatOpenAI', async () => {
    // Generate 24 months of orders with varying monthly late rates (so MAD > 0)
    const mockOrders: any[] = [];
    let monthIdx = 0;
    for (let year = 2017; year <= 2018; year++) {
      for (let month = 1; month <= 12; month++) {
        monthIdx++;
        const mStr = month < 10 ? `0${month}` : `${month}`;
        const isAnom1 = year === 2018 && month === 2;
        const isAnom2 = year === 2018 && month === 3;
        // Vary base lateCount across normal months so MAD > 0
        const baseLate = 2 + (monthIdx % 4);
        const lateCount = isAnom2 ? 15 : isAnom1 ? 12 : baseLate;

        for (let i = 0; i < 35; i++) {
          const isLate = i < lateCount;
          mockOrders.push({
            id: `ord-${year}-${mStr}-${i}`,
            orderId: `ord-${year}-${mStr}-${i}`,
            orderStatus: 'delivered',
            orderPurchaseTimestamp: new Date(
              `${year}-${mStr}-15T10:00:00.000Z`,
            ),
            orderDeliveredCarrierDate: new Date(
              `${year}-${mStr}-16T10:00:00.000Z`,
            ),
            orderDeliveredCustomerDate: isLate
              ? new Date(`${year}-${mStr}-28T10:00:00.000Z`)
              : new Date(`${year}-${mStr}-19T10:00:00.000Z`),
            orderEstimatedDeliveryDate: new Date(
              `${year}-${mStr}-20T10:00:00.000Z`,
            ),
            customer: { customerState: 'SP' },
            items: [
              {
                price: 50.0,
                sellerId: 'seller-1',
                seller: { sellerState: 'SP' },
                product: { productCategoryName: 'beleza_saude' },
              },
            ],
          });
        }
      }
    }

    const mockPrisma = {
      $queryRaw: jest.fn().mockImplementation(() => Promise.resolve([])),
      olistOrder: {
        findMany: jest.fn().mockResolvedValue(mockOrders),
      },
    } as any;

    const mockStreaming = {
      emit: jest.fn(),
    } as any;

    const anomalyNode = createAnomalyNode(mockPrisma, mockStreaming);

    const initialState: any = {
      investigationId: 'inv-test-anomaly',
      userQuestion: 'Detecta desviaciones o picos anómalos',
      analysisScope: {
        interstateOnly: false,
        provenance: [],
        scopeHash: 'f3ec52388020d442',
      },
      completedAgents: [],
      iteration: 1,
    };

    const result = await anomalyNode(initialState);
    expect(result.findings).toBeDefined();
    expect(result.findings.length).toBe(1);

    const finding = result.findings[0];
    expect(finding.numericClaims).toBeDefined();
    expect(finding.numericClaims!.length).toBeGreaterThanOrEqual(5);
    expect(finding.methodClaims).toEqual([
      expect.objectContaining({ method: 'ROBUST_Z_SCORE' }),
    ]);

    expect(finding.description).toContain('2018-02');
    expect(finding.description).toContain('2018-03');
  });
});
