import { MOCK_SUPERVISOR_RESPONSE, MOCK_CRITIC_RESPONSE } from './e2e-llm-mock';

describe('Investigation Flow E2E Contract', () => {
  it('verifies deterministic mock structure for supervisor and critic', () => {
    expect(MOCK_SUPERVISOR_RESPONSE.selectedAgents).toContain('LOGISTICS');
    expect(MOCK_SUPERVISOR_RESPONSE.selectedAgents).toContain('DATA_SCIENCE');
    expect(MOCK_CRITIC_RESPONSE.decision).toBe('APPROVED_WITH_WARNINGS');
    expect(MOCK_CRITIC_RESPONSE.score).toBeGreaterThanOrEqual(80);
  });
});
