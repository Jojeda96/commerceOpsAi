import { classifyCapabilities } from '../../src/agents/supervisor/capability-classifier';
import { mapCapabilitiesToAgents } from '../../src/agents/supervisor/capability-agent-map';
import { classifyAnswerComponents } from '../../src/agents/supervisor/answer-component-classifier';
import { parseDeterministicQuestionFilters } from '../../src/agents/scope/analysis-scope.resolver';

describe('E2E: Q6 Rating Comparison (Feb 2018 vs Jan 2018)', () => {
  const question =
    '¿Cómo cambió la calificación promedio de los clientes en febrero de 2018 respecto de enero de 2018?';

  it('routes to CUSTOMER_EXPERIENCE agent', () => {
    const caps = classifyCapabilities(question);
    const agents = mapCapabilitiesToAgents(caps);

    expect(agents).toEqual(['CUSTOMER_EXPERIENCE']);
  });

  it('classifies REVIEW_RATING_CONTEXT and TEMPORAL_RATING_COMPARISON components', () => {
    const components = classifyAnswerComponents(question);
    expect(components).toContain('REVIEW_RATING_CONTEXT');
    expect(components).toContain('TEMPORAL_RATING_COMPARISON');
  });

  it('parses comparison scope for rating query', () => {
    const parsed = parseDeterministicQuestionFilters(question);
    expect(parsed.comparison).toBeDefined();
    expect(parsed.comparison?.dateFrom).toContain('2018-01-01');
    expect(parsed.comparison?.dateTo).toContain('2018-01-31');
  });
});
