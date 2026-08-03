import {
  AnalysisScope,
  ScopeDatasetCoverage,
} from '@commerce-ops/shared-types';

export function validateScopeAgainstDataset(
  scope: AnalysisScope,
  coverage: { minDate: string; maxDate: string },
): ScopeDatasetCoverage {
  let isOutsideCoverage = false;

  if (scope.dateFrom) {
    if (
      new Date(scope.dateFrom) > new Date(coverage.maxDate) ||
      new Date(scope.dateFrom) < new Date(coverage.minDate)
    ) {
      isOutsideCoverage = true;
    }
  }

  if (scope.dateTo) {
    if (
      new Date(scope.dateTo) < new Date(coverage.minDate) ||
      new Date(scope.dateTo) > new Date(coverage.maxDate)
    ) {
      isOutsideCoverage = true;
    }
  }

  return {
    minDate: coverage.minDate,
    maxDate: coverage.maxDate,
    isOutsideCoverage,
  };
}
