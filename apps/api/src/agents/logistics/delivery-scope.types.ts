import { AnalysisScope } from '@commerce-ops/shared-types';

export interface ScopedDeliveredOrder {
  orderId: string;
  purchaseTimestamp: Date;
  deliveredCarrierDate: Date | null;
  deliveredCustomerDate: Date;
  estimatedDeliveryDate: Date;
  primarySellerState: string;
  customerState: string;
  primaryCategory: string | null;
  isInterstate: boolean;
  isLate: boolean;
}

export interface DeliveryScopeDiagnostics {
  rawDeliveredOrders: number;
  ordersAfterDateFilter: number;
  ordersAfterCategoryFilter: number;
  ordersAfterStateFilter: number;
  ordersAfterInterstateFilter: number;
  excludedMissingRoute: number;
}

export class ScopeHashMismatchError extends Error {
  constructor(
    public readonly expectedHash: string,
    public readonly receivedHash: string,
  ) {
    super(
      `Scope hash mismatch: expected '${expectedHash}' but received '${receivedHash}'`,
    );
    this.name = 'ScopeHashMismatchError';
  }
}
