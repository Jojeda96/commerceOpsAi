import { parseDeterministicQuestionFilters } from '../../src/agents/scope/analysis-scope.resolver';
import { classifyCapabilities } from '../../src/agents/supervisor/capability-classifier';
import { mapCapabilitiesToAgents } from '../../src/agents/supervisor/capability-agent-map';

describe('E2E: Q7 Review Filter (1-Star Reviews for informatica_acessorios)', () => {
  const question =
    '¿Cuáles son las quejas principales en las reseñas de 1 estrella sobre la categoría informatica_acessorios?';

  it('routes to CUSTOMER_EXPERIENCE agent', () => {
    const caps = classifyCapabilities(question);
    const agents = mapCapabilitiesToAgents(caps);

    expect(agents).toEqual(['CUSTOMER_EXPERIENCE']);
  });

  it('parses informatica_acessorios category and reviewScores = [1]', () => {
    const parsed = parseDeterministicQuestionFilters(question);

    expect(parsed.categories).toEqual(['informatica_acessorios']);
    expect(parsed.reviewScores).toEqual([1]);
  });
});
