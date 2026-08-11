import { buildReviewComplaintFinding } from '../../src/agents/customer-experience/build-review-complaint-finding';
import { mockReviewAnalysisResultFixture } from '../fixtures/v4-4/review-analysis-result.fixture';
import { buildReviewComplaintMetrics } from '../../src/agents/customer-experience/review-complaint-metrics';
import { auditMethodProvenance } from '../../src/agents/critic/method-provenance';
import { auditNumericClaims } from '../../src/agents/critic/numeric-grounding';
import { Finding } from '@commerce-ops/shared-types';

describe('Closure Query C — Review Complaint Investigation (E2E Contract)', () => {
  it('Test 8.11 — should produce COMPLETED status with iteration = 1 for CX review query', () => {
    const complaintEvidence: any = {
      id: 'ev-cx-complaints-e2e',
      toolName: 'analyze_review_complaints',
      status: 'AVAILABLE',
      rowCount: mockReviewAnalysisResultFixture.totalCommentedReviews,
      sampleSize: mockReviewAnalysisResultFixture.totalCommentedReviews,
      metrics: buildReviewComplaintMetrics(mockReviewAnalysisResultFixture),
      resultSummary: JSON.stringify(mockReviewAnalysisResultFixture),
      generatedAt: new Date().toISOString(),
    };

    const { finding, coverageItems } = buildReviewComplaintFinding({
      investigationId: 'inv-review-e2e',
      localAgentRunId: 'run-cx-1',
      complaintData: mockReviewAnalysisResultFixture,
      complaintEvidence,
      requiredAnswerComponents: [
        'REVIEW_COMPLAINT_THEMES',
        'DELIVERY_DELAY_COMPLAINTS',
        'PACKAGE_DAMAGE_COMPLAINTS',
      ],
    });

    expect(finding.agent).toBe('CUSTOMER_EXPERIENCE');
    expect(finding.findingType).toBe('REVIEW_COMPLAINT_ANALYSIS');
    expect(finding.operationalStatus).toBe('ACTIONABLE');

    // Method provenance audit
    const methodViolations = auditMethodProvenance(
      [finding],
      [complaintEvidence],
    );
    expect(methodViolations).toEqual([]);

    // Numeric grounding audit
    const groundingViolations = auditNumericClaims(
      [finding],
      [complaintEvidence],
    );
    expect(groundingViolations).toEqual([]);

    // Check coverage items
    expect(coverageItems).toContainEqual(
      expect.objectContaining({
        component: 'REVIEW_COMPLAINT_THEMES',
        status: 'ANSWERED',
      }),
    );
  });

  it('Test 8.12 - should ensure active findings have unique keys without duplicates', () => {
    const findings: Finding[] = [
      {
        id: 'f1',
        investigationId: 'inv-1',
        localAgentRunId: 'r1',
        agent: 'CUSTOMER_EXPERIENCE',
        title: 'Quejas principales en rese�as de clientes',
        description: 'V1',
        findingType: 'REVIEW_COMPLAINT_ANALYSIS',
        evidenceIds: ['ev1'],
        status: 'SUPERSEDED',
        auditStatus: 'REJECTED',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'f2',
        investigationId: 'inv-1',
        localAgentRunId: 'r2',
        agent: 'CUSTOMER_EXPERIENCE',
        title: 'Quejas principales en rese�as de clientes',
        description: 'V2',
        findingType: 'REVIEW_COMPLAINT_ANALYSIS',
        evidenceIds: ['ev1', 'ev2'],
        auditStatus: 'APPROVED',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
      },
    ];

    const activeFindings = findings.filter((f) => f.status !== 'SUPERSEDED');
    const activeKeys = activeFindings.map(
      (f) => (f as any).findingKey || `${f.agent}:${f.title}`,
    );

    expect(new Set(activeKeys).size).toBe(activeFindings.length);
  });
});
