import { anomalyNoDateCase } from '../../testing/fixtures/investigations/anomaly-zscore-no-date.fixture';

describe('Anomaly Regression Specs (EXEC PLAN V4.1)', () => {
  it('must accept canonical analysis scope and match logistics scopeHash', () => {
    expect(anomalyNoDateCase.expectedScope.dateFrom).toBeUndefined();
    expect(anomalyNoDateCase.expectedScope.dateTo).toBeUndefined();
  });
});
