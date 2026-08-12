import { parseDeterministicQuestionFilters } from '../../src/agents/scope/analysis-scope.resolver';
import { classifyCapabilities } from '../../src/agents/supervisor/capability-classifier';
import { mapCapabilitiesToAgents } from '../../src/agents/supervisor/capability-agent-map';

describe('E2E: Q2 Logistics Month & Category Comparison', () => {
  const question =
    '¿Cómo cambió la tasa de entregas tardías de la categoría muebles en febrero de 2018 respecto de enero de 2018?';

  it('routes to LOGISTICS agent', () => {
    const caps = classifyCapabilities(question);
    const agents = mapCapabilitiesToAgents(caps);

    expect(agents).toContain('LOGISTICS');
  });

  it('parses comparison scope, category alias and February 2018 date range', () => {
    const parsed = parseDeterministicQuestionFilters(question);

    expect(parsed.dateFrom).toBe('2018-02-01T00:00:00.000Z');
    expect(parsed.dateTo).toBe('2018-02-28T23:59:59.999Z');
    expect(parsed.categories).toEqual(['moveis_decoracao']);
    expect(parsed.comparison).toBeDefined();
    expect(parsed.comparison?.dateFrom).toBe('2018-01-01T00:00:00.000Z');
    expect(parsed.comparison?.dateTo).toBe('2018-01-31T23:59:59.999Z');
  });
});
