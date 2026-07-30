import { anomalyNoDateCase } from '../../src/testing/fixtures/investigations/anomaly-zscore-no-date.fixture';
import { resolveAnalysisScope } from '../../src/agents/scope/analysis-scope.resolver';
import { classifyCapabilities } from '../../src/agents/supervisor/capability-classifier';
import { mapCapabilitiesToAgents } from '../../src/agents/supervisor/capability-agent-map';

describe('E2E Incident Case A: Anomaly Detection Without Date Filter', () => {
  it('must resolve unforced scope, select LOGISTICS + ANOMALY, and omit DATA_SCIENCE', () => {
    const scope = resolveAnalysisScope({
      question: anomalyNoDateCase.question,
      dtoFilters: anomalyNoDateCase.requestFilters,
    });

    expect(scope.dateFrom).toBeUndefined();
    expect(scope.dateTo).toBeUndefined();
    expect(scope.interstateOnly).toBe(false);
    expect(scope.scopeHash).toBeDefined();

    const capabilities = classifyCapabilities(anomalyNoDateCase.question);
    const selectedAgents = mapCapabilitiesToAgents(capabilities);

    expect(selectedAgents).toEqual(['LOGISTICS', 'ANOMALY']);
    expect(selectedAgents).not.toContain('DATA_SCIENCE');
  });
});
