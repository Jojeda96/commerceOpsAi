import { AnalysisScope, ScopeProvenanceEntry, ScopeSource } from '@commerce-ops/shared-types';

export { AnalysisScope, ScopeProvenanceEntry, ScopeSource };

export interface ResolveScopeInput {
  question: string;
  dtoFilters?: {
    dateFrom?: string;
    dateTo?: string;
    categories?: string[];
    sellerIds?: string[];
    sellerStates?: string[];
    customerStates?: string[];
    interstateOnly?: boolean;
  };
  criticScopePatch?: Partial<AnalysisScope>;
}
