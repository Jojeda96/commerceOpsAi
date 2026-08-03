import { interstatePredictionCase } from '../../src/testing/fixtures/investigations/interstate-prediction-governance-shap.fixture';
import { resolveAnalysisScope } from '../../src/agents/scope/analysis-scope.resolver';
import { classifyCapabilities } from '../../src/agents/supervisor/capability-classifier';
import { mapCapabilitiesToAgents } from '../../src/agents/supervisor/capability-agent-map';

describe('E2E Incident Case B: ML Interstate Prediction Partial Answer', () => {
  it('must detect interstateOnly=true, classify ML capabilities, and allow partial approval', () => {
    const scope = resolveAnalysisScope({
      question: interstatePredictionCase.question,
      dtoFilters: interstatePredictionCase.requestFilters,
    });

    expect(scope.interstateOnly).toBe(true);

    const capabilities = classifyCapabilities(
      interstatePredictionCase.question,
    );
    const selectedAgents = mapCapabilitiesToAgents(capabilities);

    expect(selectedAgents).toEqual(['LOGISTICS', 'DATA_SCIENCE']);
  });
});
