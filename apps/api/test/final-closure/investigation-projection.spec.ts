import { InvestigationsService } from '../../src/investigations/investigations.service';

describe('Investigation Service Evidence Projection (PR-00 / PR-02)', () => {
  it('should format findings with linked evidence details including metrics and status', async () => {
    const mockPrisma = {
      investigation: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'inv-proj-1',
          question: 'Test question',
          status: 'COMPLETED',
          tasks: [],
          agentRuns: [],
          criticFeedback: [],
          recommendations: [],
          findings: [
            {
              id: 'f-1',
              agentName: 'ANOMALY',
              title: 'Detección de anomalías',
              description: 'Prueba',
              numericClaimsJson: [],
              evidence: [
                {
                  evidence: {
                    id: 'ev-1',
                    evidenceType: 'detect_metric_anomalies',
                    toolName: 'detect_metric_anomalies',
                    status: 'AVAILABLE',
                    reasonCode: null,
                    scopeHash: 'hash1',
                    appliedScopeJson: { interstateOnly: false },
                    metricsJson: [
                      {
                        key: 'anomaly.series.threshold',
                        value: 3,
                        unit: 'ROBUST_Z_SCORE',
                        sourcePath: '$.data.threshold',
                      },
                    ],
                    summary: '{"status":"AVAILABLE"}',
                  },
                },
              ],
            },
          ],
        }),
      },
    } as any;

    const service = new InvestigationsService(mockPrisma, {} as any, {} as any);
    const result = await service.findOne('inv-proj-1');

    expect(result.findings[0].evidence).toBeDefined();
    expect(result.findings[0].evidence[0].toolName).toBe(
      'detect_metric_anomalies',
    );
    expect(result.findings[0].evidence[0].metrics).toBeDefined();
  });
});
