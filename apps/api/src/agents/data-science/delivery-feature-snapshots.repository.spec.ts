import { DeliveryFeatureSnapshotsRepository } from './delivery-feature-snapshots.repository';

describe('DeliveryFeatureSnapshotsRepository', () => {
  it('should query snapshots with filters without throw', async () => {
    const mockPrisma: any = {
      $queryRaw: jest.fn().mockResolvedValue([
        {
          primarySellerState: 'SP',
          customerState: 'RJ',
          primaryCategory: 'beleza_saude',
          totalPrice: 120.0,
          totalFreight: 25.0,
          totalWeightG: 600.0,
          totalVolumeCm3: 2000.0,
          itemCount: 1,
          sellerCount: 1,
          estimatedDeliveryDays: 14.0,
          shippingWindowDays: 5.0,
          routeDistanceKm: 420.0,
          purchaseDow: 2,
          purchaseHour: 14,
          purchaseMonth: 5,
          purchaseWeek: 20,
          sellerPriorOrders: 15,
          sellerPriorLateRateSmoothed: 0.05,
          routePriorOrders: 8,
          routePriorLateRateSmoothed: 0.08,
          categoryPriorOrders: 100,
          categoryPriorLateRateSmoothed: 0.04,
          sampleSize: 50,
          historicalLateRate: 0.06,
        },
      ]),
    };

    const repo = new DeliveryFeatureSnapshotsRepository(mockPrisma);
    const results = await repo.findSnapshots({
      limit: 2,
      customerStates: ['RJ'],
      selectionMethod: 'REPRESENTATIVE_MEDIAN',
    });

    expect(results).toHaveLength(1);
    expect(results[0].primarySellerState).toBe('SP');
    expect(results[0].customerState).toBe('RJ');
    expect(results[0].sellerPriorLateRateSmoothed).toBe(0.05);
    expect(results[0].routePriorLateRateSmoothed).toBe(0.08);
  });
});
