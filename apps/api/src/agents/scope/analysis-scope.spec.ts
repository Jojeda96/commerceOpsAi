import {
  resolveAnalysisScope,
  createEmptyScope,
} from './analysis-scope.resolver';
import { calculateScopeHash } from './analysis-scope.hash';
import { anomalyNoDateCase } from '../../testing/fixtures/investigations/anomaly-zscore-no-date.fixture';
import { interstatePredictionCase } from '../../testing/fixtures/investigations/interstate-prediction-governance-shap.fixture';

describe('AnalysisScope Unit Tests (PR-01)', () => {
  it('must create empty scope with unforced dates when no date filters are supplied', () => {
    const scope = resolveAnalysisScope({
      question: anomalyNoDateCase.question,
      dtoFilters: {},
    });

    expect(scope.dateFrom).toBeUndefined();
    expect(scope.dateTo).toBeUndefined();
    expect(scope.interstateOnly).toBe(false);
    expect(scope.scopeHash).toBeDefined();
    expect(scope.scopeHash).toHaveLength(16);
  });

  it('must detect interstateOnly=true deterministically from question text', () => {
    const scope = resolveAnalysisScope({
      question: interstatePredictionCase.question,
      dtoFilters: {},
    });

    expect(scope.interstateOnly).toBe(true);
    expect(
      scope.provenance.some((p: any) => p.field === 'interstateOnly'),
    ).toBe(true);
  });

  it('must produce identical hash for equivalent scopes regardless of property key ordering', () => {
    const scope1 = resolveAnalysisScope({
      question: 'Test question',
      dtoFilters: { categories: ['cat_a', 'cat_b'], interstateOnly: true },
    });
    const scope2 = resolveAnalysisScope({
      question: 'Test question',
      dtoFilters: { interstateOnly: true, categories: ['cat_b', 'cat_a'] },
    });

    expect(scope1.scopeHash).toBe(scope2.scopeHash);
  });

  it('must change scopeHash if any filter parameter changes', () => {
    const scope1 = resolveAnalysisScope({
      question: 'Test question',
      dtoFilters: { interstateOnly: true },
    });
    const scope2 = resolveAnalysisScope({
      question: 'Test question',
      dtoFilters: { interstateOnly: false },
    });

    expect(scope1.scopeHash).not.toBe(scope2.scopeHash);
  });
});
