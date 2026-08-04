import { normalizeReviewText } from '../../src/agents/customer-experience/review-text-normalizer';
import { REVIEW_COMPLAINT_TAXONOMY_VERSION } from '../../src/agents/customer-experience/review-complaint-taxonomy';

describe('PR-00 / V4.4: Review Complaint Analysis & Text Normalizer Contract', () => {
  it('should normalize portuguese review text removing accents, punctuation and lowercasing', () => {
    expect(normalizeReviewText('Não chegou!')).toBe('nao chegou');
    expect(normalizeReviewText('Embalagem danificada')).toBe('embalagem danificada');
    expect(normalizeReviewText('CAIXA AMASSADA')).toBe('caixa amassada');
  });

  it('should export taxonomy version v1.0.0', () => {
    expect(REVIEW_COMPLAINT_TAXONOMY_VERSION).toBe('v1.0.0');
  });
});
