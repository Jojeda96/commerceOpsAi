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
});
