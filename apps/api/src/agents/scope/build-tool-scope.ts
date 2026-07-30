import { AnalysisScope } from '@commerce-ops/shared-types';

export function buildToolScope(scope?: AnalysisScope) {
  if (!scope) {
    return {
      dateFrom: undefined,
      dateTo: undefined,
      categories: undefined,
      sellerIds: undefined,
      sellerStates: undefined,
      customerStates: undefined,
      interstateOnly: false,
      scopeHash: 'unspecified_scope_hash',
    };
  }

  return {
    dateFrom: scope.dateFrom,
    dateTo: scope.dateTo,
    categories: scope.categories,
    sellerIds: scope.sellerIds,
    sellerStates: scope.sellerStates,
    customerStates: scope.customerStates,
    interstateOnly: Boolean(scope.interstateOnly),
    scopeHash: scope.scopeHash,
  };
}
