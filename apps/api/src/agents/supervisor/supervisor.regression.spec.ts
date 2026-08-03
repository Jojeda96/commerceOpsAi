import { anomalyNoDateCase } from '../../testing/fixtures/investigations/anomaly-zscore-no-date.fixture';
import { interstatePredictionCase } from '../../testing/fixtures/investigations/interstate-prediction-governance-shap.fixture';

describe('Supervisor Regression Specs (EXEC PLAN V4.1)', () => {
  it('anomalyNoDateCase must classify capabilities deterministically and not invent dates', () => {
    expect(anomalyNoDateCase.question).toBeDefined();
    expect(anomalyNoDateCase.expectedCapabilities).toEqual([
      'DESCRIPTIVE_LOGISTICS',
      'ANOMALY_DETECTION',
    ]);
    expect(anomalyNoDateCase.expectedAgents).toEqual(['LOGISTICS', 'ANOMALY']);
    expect(anomalyNoDateCase.forbiddenAgents).toEqual(['DATA_SCIENCE']);
  });

  it('interstatePredictionCase must classify ML capabilities and activate interstateOnly', () => {
    expect(interstatePredictionCase.question).toBeDefined();
    expect(interstatePredictionCase.expectedScope.interstateOnly).toBe(true);
    expect(interstatePredictionCase.expectedAgents).toEqual([
      'LOGISTICS',
      'DATA_SCIENCE',
    ]);
  });
});
