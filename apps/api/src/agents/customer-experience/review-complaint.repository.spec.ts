import { ReviewComplaintRepository } from './review-complaint.repository';
import { mockReviewsFixture } from '../../../test/fixtures/v4-4/reviews.fixture';

describe('ReviewComplaintRepository', () => {
  let repository: ReviewComplaintRepository;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      olistOrderReview: {
        findMany: jest.fn().mockResolvedValue(mockReviewsFixture),
      },
    };
    repository = new ReviewComplaintRepository(mockPrisma);
  });

  it('should analyze review complaints deterministically without double-counting topic reviews', async () => {
    const result = await repository.analyzeReviewComplaints({
      topics: ['DELIVERY_DELAY', 'PACKAGE_DAMAGE'],
      scopeHash: 'hash-test',
    });

    expect(result.status).toBe('AVAILABLE');
    expect(result.data?.totalCommentedReviews).toBe(3);
    expect(result.data?.totalMatchedReviews).toBe(3);
    expect(result.data?.topics).toHaveLength(2);

    const delayTopic = result.data?.topics.find((t) => t.topic === 'DELIVERY_DELAY');
    expect(delayTopic).toBeDefined();
    expect(delayTopic?.uniqueReviewCount).toBe(2);

    const damageTopic = result.data?.topics.find((t) => t.topic === 'PACKAGE_DAMAGE');
    expect(damageTopic).toBeDefined();
    expect(damageTopic?.uniqueReviewCount).toBe(2);
  });

  it('should return NO_DATA when no comments match taxonomy', async () => {
    mockPrisma.olistOrderReview.findMany.mockResolvedValue([
      {
        reviewId: 'rev-99',
        orderId: 'ord-99',
        reviewScore: 5,
        reviewCommentMessage: 'Excelente produto, adorei!',
        reviewCreationDate: new Date(),
      },
    ]);

    const result = await repository.analyzeReviewComplaints({
      topics: ['DELIVERY_DELAY'],
      scopeHash: 'hash-test-nodata',
    });

    expect(result.status).toBe('NO_DATA');
    expect(result.reasonCode).toBe('NO_COMPLAINTS_MATCHED_TAXONOMY');
  });

  it('should return NO_DATA when no review comments exist in scope', async () => {
    mockPrisma.olistOrderReview.findMany.mockResolvedValue([]);

    const result = await repository.analyzeReviewComplaints({
      topics: ['DELIVERY_DELAY'],
      scopeHash: 'hash-test-empty',
    });

    expect(result.status).toBe('NO_DATA');
    expect(result.reasonCode).toBe('NO_REVIEW_COMMENTS_IN_SCOPE');
  });
});
