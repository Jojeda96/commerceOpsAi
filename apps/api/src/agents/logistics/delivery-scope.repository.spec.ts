import {
  resolvePrimarySeller,
  resolvePrimaryCategory,
  formatRouteKey,
} from './canonical-route';

describe('DeliveryScopeRepository Canonical Helpers', () => {
  it('resolves primary seller by highest item value and tie-breaker sellerId', () => {
    const items = [
      {
        price: 50,
        sellerId: 'sellerB',
        sellerState: 'SP',
        categoryName: 'electronics',
      },
      {
        price: 100,
        sellerId: 'sellerA',
        sellerState: 'RJ',
        categoryName: 'electronics',
      },
    ];

    const result = resolvePrimarySeller(items);
    expect(result?.sellerId).toBe('sellerA');
    expect(result?.sellerState).toBe('RJ');
  });

  it('resolves primary seller tie-breaker by sellerId ascending when prices match', () => {
    const items = [
      {
        price: 100,
        sellerId: 'sellerB',
        sellerState: 'SP',
        categoryName: 'electronics',
      },
      {
        price: 100,
        sellerId: 'sellerA',
        sellerState: 'RJ',
        categoryName: 'electronics',
      },
    ];

    const result = resolvePrimarySeller(items);
    expect(result?.sellerId).toBe('sellerA');
    expect(result?.sellerState).toBe('RJ');
  });

  it('resolves primary category by highest item value', () => {
    const items = [
      { price: 30, sellerId: 's1', sellerState: 'SP', categoryName: 'books' },
      {
        price: 80,
        sellerId: 's1',
        sellerState: 'SP',
        categoryName: 'health_beauty',
      },
    ];

    const category = resolvePrimaryCategory(items);
    expect(category).toBe('health_beauty');
  });

  it('formats route key correctly', () => {
    expect(formatRouteKey('sp', 'rj')).toBe('SP->RJ');
  });
});
