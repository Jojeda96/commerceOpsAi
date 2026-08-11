import { classifyAnswerComponents } from './answer-component-classifier';

describe('Answer Component Classifier', () => {
  it('should classify review query with delay and damage into required components (without rating)', () => {
    const question =
      '¿Cuáles son las quejas principales en las reseñas de clientes sobre demoras en la entrega y paquetes dañados?';
    const components = classifyAnswerComponents(question);

    expect(components).toContain('REVIEW_COMPLAINT_THEMES');
    expect(components).toContain('DELIVERY_DELAY_COMPLAINTS');
    expect(components).toContain('PACKAGE_DAMAGE_COMPLAINTS');
    // Test 8.1: Rating NOT requested — should NOT contain REVIEW_RATING_CONTEXT
    expect(components).not.toContain('REVIEW_RATING_CONTEXT');
  });

  // Test 8.2: Rating explicitly requested
  it('should include REVIEW_RATING_CONTEXT when question asks for rating/stars', () => {
    const question =
      '¿Cuál es el rating promedio y la distribución de estrellas de las quejas por demora?';
    const components = classifyAnswerComponents(question);

    expect(components).toContain('REVIEW_RATING_CONTEXT');
  });

  it('should classify delay-only review query without package damage component', () => {
    const question =
      '¿Cuáles son las quejas en reseñas sobre demoras de entrega?';
    const components = classifyAnswerComponents(question);

    expect(components).toContain('REVIEW_COMPLAINT_THEMES');
    expect(components).toContain('DELIVERY_DELAY_COMPLAINTS');
    expect(components).not.toContain('PACKAGE_DAMAGE_COMPLAINTS');
  });

  it('should classify anomaly question into historical and anomaly components', () => {
    const question =
      'Detecta desviaciones o picos anómalos mediante Z-Score robusto';
    const components = classifyAnswerComponents(question);

    expect(components).toContain('HISTORICAL_LOGISTICS_CONTEXT');
    expect(components).toContain('ANOMALY_DETECTION');
  });
});
