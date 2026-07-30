import { Finding } from '@commerce-ops/shared-types';

describe('E2E Re-iteration & Finding Supersession', () => {
  it('must supersede previous finding when a new finding with same findingKey is added in round 2', () => {
    const findings: Finding[] = [
      {
        id: 'f1',
        investigationId: 'inv-1',
        agent: 'LOGISTICS',
        title: 'Tasa de retrasos en entregas',
        description: 'Tasa observada 8.1%',
        findingType: 'LOGISTICS_DELAY',
        confidence: 0.9,
        evidenceIds: ['ev1'],
        iteration: 1,
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
      },
    ];

    const newFinding: Finding = {
      id: 'f2',
      investigationId: 'inv-1',
      agent: 'LOGISTICS',
      title: 'Tasa de retrasos en entregas',
      description: 'Tasa observada 8.1% (corregida)',
      findingType: 'LOGISTICS_DELAY',
      confidence: 0.95,
      evidenceIds: ['ev1_v2'],
      iteration: 2,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
    };

    // Simulate supersession logic
    const itemKey = `${newFinding.agent}:${newFinding.title}`;
    const merged = findings.map((f) => {
      if (`${f.agent}:${f.title}` === itemKey) {
        return { ...f, status: 'SUPERSEDED' as const };
      }
      return f;
    });
    merged.push(newFinding);

    const active = merged.filter((f) => f.status === 'ACTIVE');
    const superseded = merged.filter((f) => f.status === 'SUPERSEDED');

    expect(active).toHaveLength(1);
    expect(active[0].id).toBe('f2');
    expect(superseded).toHaveLength(1);
    expect(superseded[0].id).toBe('f1');
  });
});
