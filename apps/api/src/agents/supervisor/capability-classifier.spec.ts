import { classifyCapabilities } from './capability-classifier';
import { mapCapabilitiesToAgents } from './capability-agent-map';
import { anomalyNoDateCase } from '../../testing/fixtures/investigations/anomaly-zscore-no-date.fixture';
import { interstatePredictionCase } from '../../testing/fixtures/investigations/interstate-prediction-governance-shap.fixture';

describe('Capability Classifier Unit Tests (PR-03)', () => {
  it('anomalyNoDateCase must classify DESCRIPTIVE_LOGISTICS + ANOMALY_DETECTION and map strictly to LOGISTICS + ANOMALY', () => {
    const caps = classifyCapabilities(anomalyNoDateCase.question);
    const agents = mapCapabilitiesToAgents(caps);

    expect(caps).toContain('DESCRIPTIVE_LOGISTICS');
    expect(caps).toContain('ANOMALY_DETECTION');
    expect(agents).toEqual(['LOGISTICS', 'ANOMALY']);
    expect(agents).not.toContain('DATA_SCIENCE');
  });

  it('interstatePredictionCase must classify ML capabilities and map to LOGISTICS + DATA_SCIENCE', () => {
    const caps = classifyCapabilities(interstatePredictionCase.question);
    const agents = mapCapabilitiesToAgents(caps);

    expect(caps).toContain('HISTORICAL_CONTEXT');
    expect(caps).toContain('ML_PREDICTION');
    expect(caps).toContain('MODEL_GOVERNANCE');
    expect(caps).toContain('LOCAL_EXPLANATION');
    expect(agents).toEqual(['LOGISTICS', 'DATA_SCIENCE']);
  });
});
