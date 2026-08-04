import { resolveQuestionCapabilities } from './question-intent';
import { mapCapabilitiesToAgents } from './capability-agent-map';

describe('Question Intent & Capability Classification', () => {
  it('should map review complaints question strictly to CUSTOMER_EXPERIENCE', () => {
    const question =
      '¿Cuáles son las quejas principales en las reseñas de clientes sobre demoras en la entrega y paquetes dañados?';
    const caps = resolveQuestionCapabilities(question);
    expect(caps).toEqual(['REVIEW_COMPLAINT_ANALYSIS']);

    const agents = mapCapabilitiesToAgents(caps);
    expect(agents).toEqual(['CUSTOMER_EXPERIENCE']);
  });

  it('should map mixed review + operational metric question to CX and LOGISTICS', () => {
    const question =
      '¿Cuáles son las quejas en reseñas por demoras y cuál es la tasa global de atraso?';
    const caps = resolveQuestionCapabilities(question);
    const agents = mapCapabilitiesToAgents(caps);
    expect(agents).toContain('CUSTOMER_EXPERIENCE');
    expect(agents).toContain('LOGISTICS');
  });

  it('should map generic logistics query to LOGISTICS', () => {
    const question =
      '¿Cuál es la tasa de atraso interestatal en los envíos de los últimos 3 meses?';
    const caps = resolveQuestionCapabilities(question);
    const agents = mapCapabilitiesToAgents(caps);
    expect(agents).toEqual(['LOGISTICS']);
  });

  it('should map box damage opinions to CUSTOMER_EXPERIENCE', () => {
    const question = 'Opiniones sobre caja dañada y entregas tardías';
    const caps = resolveQuestionCapabilities(question);
    const agents = mapCapabilitiesToAgents(caps);
    expect(agents).toEqual(['CUSTOMER_EXPERIENCE']);
  });
});
