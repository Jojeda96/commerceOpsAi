export interface OrderItemForRollup {
  price: number;
  sellerId: string;
  sellerState: string;
  categoryName: string | null;
}

export function resolvePrimarySeller(
  items: OrderItemForRollup[],
): { sellerId: string; sellerState: string } | null {
  if (!items || items.length === 0) return null;

  const sellerTotals = new Map<
    string,
    { totalValue: number; sellerState: string }
  >();

  for (const item of items) {
    if (!item.sellerId || !item.sellerState) continue;
    const current = sellerTotals.get(item.sellerId) || {
      totalValue: 0,
      sellerState: item.sellerState,
    };
    current.totalValue += item.price;
    sellerTotals.set(item.sellerId, current);
  }

  if (sellerTotals.size === 0) return null;

  const sorted = Array.from(sellerTotals.entries()).sort((a, b) => {
    if (b[1].totalValue !== a[1].totalValue) {
      return b[1].totalValue - a[1].totalValue;
    }
    return a[0].localeCompare(b[0]);
  });

  return {
    sellerId: sorted[0][0],
    sellerState: sorted[0][1].sellerState,
  };
}

export function resolvePrimaryCategory(
  items: OrderItemForRollup[],
): string | null {
  if (!items || items.length === 0) return null;

  const categoryTotals = new Map<string, number>();

  for (const item of items) {
    if (!item.categoryName) continue;
    const current = categoryTotals.get(item.categoryName) || 0;
    categoryTotals.set(item.categoryName, current + item.price);
  }

  if (categoryTotals.size === 0) return null;

  const sorted = Array.from(categoryTotals.entries()).sort((a, b) => {
    if (b[1] !== a[1]) {
      return b[1] - a[1];
    }
    return a[0].localeCompare(b[0]);
  });

  return sorted[0][0];
}

export function formatRouteKey(
  originState: string,
  destinationState: string,
): string {
  return `${originState.toUpperCase()}->${destinationState.toUpperCase()}`;
}
