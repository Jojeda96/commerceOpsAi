import { formatModelIdentity } from './format-model-identity';

describe('Snapshot Readiness and Model Identity Formatting', () => {
  it('formats model identity without duplicate v prefix', () => {
    expect(formatModelIdentity('xgboost', 'vdelivery-risk-v2.0.0')).toBe(
      'xgboost — delivery-risk-v2.0.0',
    );
    expect(formatModelIdentity('xgboost', 'delivery-risk-v2.0.0')).toBe(
      'xgboost — delivery-risk-v2.0.0',
    );
  });
});
