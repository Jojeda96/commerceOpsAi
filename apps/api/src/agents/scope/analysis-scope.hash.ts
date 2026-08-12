import { createHash } from 'crypto';
import { AnalysisScope } from './analysis-scope.types';

export function calculateScopeHash(
  scope: Omit<AnalysisScope, 'scopeHash'>,
): string {
  const normalized = {
    dateFrom: scope.dateFrom || null,
    dateTo: scope.dateTo || null,
    categories: scope.categories ? [...scope.categories].sort() : [],
    sellerIds: scope.sellerIds ? [...scope.sellerIds].sort() : [],
    sellerStates: scope.sellerStates ? [...scope.sellerStates].sort() : [],
    customerStates: scope.customerStates
      ? [...scope.customerStates].sort()
      : [],
    reviewScores: scope.reviewScores
      ? [...scope.reviewScores].sort((a, b) => a - b)
      : [],
    comparison: scope.comparison
      ? {
          mode: scope.comparison.mode,
          dateFrom: scope.comparison.dateFrom,
          dateTo: scope.comparison.dateTo,
        }
      : null,
    interstateOnly: Boolean(scope.interstateOnly),
  };

  return createHash('sha256')
    .update(JSON.stringify(normalized))
    .digest('hex')
    .substring(0, 16);
}
