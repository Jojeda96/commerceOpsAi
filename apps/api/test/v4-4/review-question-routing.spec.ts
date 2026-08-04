import { classifyCapabilities } from '../../src/agents/supervisor/capability-classifier';
import { mapCapabilitiesToAgents } from '../../src/agents/supervisor/capability-agent-map';

describe('PR-00 / V4.4: Review Question Routing & Intent Contract', () => {
  it('should route review complaint questions strictly to CUSTOMER_EXPERIENCE capability and agent', () => {
    const question =
      '¿Cuáles son las quejas principales en las reseñas de clientes sobre demoras en la entrega y paquetes dañados?';

    const capabilities = classifyCapabilities(question);

    expect(capabilities).toEqual(['REVIEW_COMPLAINT_ANALYSIS']);

    const selectedAgents = mapCapabilitiesToAgents(capabilities);

    expect(selectedAgents).toEqual(['CUSTOMER_EXPERIENCE']);
    expect(selectedAgents).not.toContain('LOGISTICS');
  });

  it('should route mixed questions asking for reviews AND operational rate to both CX and LOGISTICS', () => {
    const question =
      '¿Cuáles son las quejas en reseñas por demoras y cuál es la tasa global de atraso?';

    const capabilities = classifyCapabilities(question);
    const selectedAgents = mapCapabilitiesToAgents(capabilities);

    expect(selectedAgents).toContain('CUSTOMER_EXPERIENCE');
    expect(selectedAgents).toContain('LOGISTICS');
  });
});
