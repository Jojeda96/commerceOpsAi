import { ToolResultEnvelopeSchema } from './tool-result.schema';

describe('ToolResultEnvelopeSchema', () => {
  it('validates a correct envelope', () => {
    const envelope = {
      status: 'AVAILABLE',
      scopeHash: 'hash-1234',
      appliedScope: {
        interstateOnly: true,
        provenance: [],
        scopeHash: 'hash-1234',
      },
      rowCount: 61779,
      sampleSize: 61779,
      methods: ['DESCRIPTIVE_AGGREGATION'],
      metrics: [
        {
          key: 'delivery.aggregate.late_rate_pct',
          label: 'Tasa histórica agregada de atraso',
          value: 9.3,
          unit: 'PERCENT',
          sampleSize: 61779,
          sourcePath: '$.data.aggregateLateRatePct',
        },
      ],
      data: { aggregateLateRatePct: 9.3 },
    };

    const parsed = ToolResultEnvelopeSchema.safeParse(envelope);
    expect(parsed.success).toBe(true);
  });

  it('rejects an envelope missing scopeHash', () => {
    const invalidEnvelope = {
      status: 'AVAILABLE',
      scopeHash: '',
      appliedScope: { interstateOnly: true, provenance: [], scopeHash: '' },
      rowCount: 10,
      sampleSize: 10,
      methods: ['DESCRIPTIVE_AGGREGATION'],
      metrics: [],
      data: null,
    };

    const parsed = ToolResultEnvelopeSchema.safeParse(invalidEnvelope);
    expect(parsed.success).toBe(false);
  });

  it('rejects an invalid unit in metric', () => {
    const invalidEnvelope = {
      status: 'AVAILABLE',
      scopeHash: 'hash-1234',
      appliedScope: {
        interstateOnly: true,
        provenance: [],
        scopeHash: 'hash-1234',
      },
      rowCount: 10,
      sampleSize: 10,
      methods: ['DESCRIPTIVE_AGGREGATION'],
      metrics: [
        {
          key: 'test',
          label: 'Test',
          value: 1,
          unit: 'INVALID_UNIT',
          sourcePath: '$.test',
        },
      ],
      data: null,
    };

    const parsed = ToolResultEnvelopeSchema.safeParse(invalidEnvelope);
    expect(parsed.success).toBe(false);
  });
});
