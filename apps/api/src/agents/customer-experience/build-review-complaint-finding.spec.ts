import { buildReviewComplaintFinding } from './build-review-complaint-finding';
import { mockReviewAnalysisResultFixture } from '../../../test/fixtures/v4-4/review-analysis-result.fixture';

describe('buildReviewComplaintFinding', () => {
  const mockEvidence = {
    id: 'ev-cx-complaints-001',
    toolName: 'analyze_review_complaints',
    parameters: {},
    resultSummary: '',
    generatedAt: new Date().toISOString(),
  };

  it('should build grounded finding with numeric claims, method claims and coverage items', () => {
    const { finding, coverageItems } = buildReviewComplaintFinding({
      investigationId: 'inv-001',
      localAgentRunId: 'run-001',
      complaintData: mockReviewAnalysisResultFixture,
      complaintEvidence: mockEvidence,
      requiredAnswerComponents: [
        'REVIEW_COMPLAINT_THEMES',
        'DELIVERY_DELAY_COMPLAINTS',
        'PACKAGE_DAMAGE_COMPLAINTS',
      ],
    });

    expect(finding.findingType).toBe('REVIEW_COMPLAINT_ANALYSIS');
    expect(finding.confidence).toBeUndefined();
    expect(finding.auditStatus).toBe('PENDING');

    expect(finding.methodClaims).toContainEqual(
      expect.objectContaining({
        method: 'REVIEW_LEXICON_AGGREGATION',
        toolName: 'analyze_review_complaints',
      }),
    );

    expect(finding.numericClaims?.length).toBeGreaterThan(0);
    expect(finding.description).not.toContain('causes del embalaje deficiente');

    expect(coverageItems).toContainEqual(
      expect.objectContaining({
        component: 'REVIEW_COMPLAINT_THEMES',
        status: 'ANSWERED',
      }),
    );
  });

  // Test 8.3: CX Sample Size Adequacy
  it('Test 8.3 — should compute sampleAdequacy = 20 when sample size is large (e.g. 40,950)', () => {
    const complaintEvidence = {
      id: 'ev-cx-complaints-40k',
      toolName: 'analyze_review_complaints',
      status: 'AVAILABLE',
      rowCount: 40950,
      sampleSize: 40950,
      generatedAt: new Date().toISOString(),
    };

    const { finding } = buildReviewComplaintFinding({
      investigationId: 'inv-8-3',
      localAgentRunId: 'run-8-3',
      complaintData: mockReviewAnalysisResultFixture,
      complaintEvidence: complaintEvidence as any,
      requiredAnswerComponents: ['REVIEW_COMPLAINT_THEMES'],
    });

    expect(
      finding.numericClaims?.find(
        (c) => c.metricKey === 'reviews.comments.total',
      )?.sampleSize,
    ).toBe(3);
  });

  // Test 8.4: Subtheme Order and Labels
  it('Test 8.4 — should sort subthemes by frequency descending and format with labels in description', () => {
    const fixtureWithUnsortedSubthemes = {
      taxonomyVersion: 'v1.0.0',
      method: 'DETERMINISTIC_LEXICON_AGGREGATION' as const,
      totalCommentedReviews: 4337,
      totalMatchedReviews: 4337,
      topics: [
        {
          topic: 'DELIVERY_DELAY' as const,
          uniqueReviewCount: 4337,
          shareOfCommentedPct: 100,
          averageReviewScore: 1.2,
          ratingDistribution: { '1': 4000, '2': 337, '3': 0, '4': 0, '5': 0 },
          subthemes: [
            {
              code: 'LATE_DELIVERY',
              uniqueReviewCount: 1401,
              shareWithinTopicPct: 32.3,
              examples: [],
            },
            {
              code: 'NOT_DELIVERED',
              uniqueReviewCount: 2774,
              shareWithinTopicPct: 63.95,
              examples: [],
            },
            {
              code: 'DEADLINE_MISSED',
              uniqueReviewCount: 162,
              shareWithinTopicPct: 3.73,
              examples: [],
            },
          ],
        },
      ],
    };

    const { finding } = buildReviewComplaintFinding({
      investigationId: 'inv-8-4',
      localAgentRunId: 'run-8-4',
      complaintData: fixtureWithUnsortedSubthemes,
      complaintEvidence: mockEvidence,
      requiredAnswerComponents: [
        'REVIEW_COMPLAINT_THEMES',
        'DELIVERY_DELAY_COMPLAINTS',
      ],
    });

    // Highest frequency subtheme (NOT_DELIVERED with 2,774) should appear before LATE_DELIVERY (1,401)
    const notDeliveredIndex = finding.description.indexOf(
      'Pedido no recibido (2.774 reseñas)',
    );
    const lateDeliveryIndex = finding.description.indexOf(
      'Entrega tardía (1.401 reseñas)',
    );

    expect(notDeliveredIndex).toBeGreaterThan(-1);
    expect(lateDeliveryIndex).toBeGreaterThan(-1);
    expect(notDeliveredIndex).toBeLessThan(lateDeliveryIndex);
  });
});
