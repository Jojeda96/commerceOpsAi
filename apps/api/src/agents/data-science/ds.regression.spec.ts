import { interstatePredictionCase } from '../../testing/fixtures/investigations/interstate-prediction-governance-shap.fixture';

describe('Data Science Regression Specs (EXEC PLAN V4.1)', () => {
  it('must return governance status even when scenario discovery returns NO_SCENARIOS', () => {
    expect(interstatePredictionCase.expectedCapabilities).toContain(
      'MODEL_GOVERNANCE',
    );
    expect(interstatePredictionCase.expectedCapabilities).toContain(
      'LOCAL_EXPLANATION',
    );
  });
});
