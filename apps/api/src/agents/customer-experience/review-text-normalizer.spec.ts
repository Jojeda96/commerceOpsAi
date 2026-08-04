import { normalizeReviewText } from './review-text-normalizer';

describe('ReviewTextNormalizer', () => {
  it('should normalize accented portuguese characters and punctuation', () => {
    expect(normalizeReviewText('Não chegou!')).toBe('nao chegou');
    expect(normalizeReviewText('Embalagem danificada')).toBe(
      'embalagem danificada',
    );
    expect(normalizeReviewText('CAIXA AMASSADA')).toBe('caixa amassada');
    expect(normalizeReviewText('Péssimo... atrasou 20 días!!!')).toBe(
      'pessimo atrasou 20 dias',
    );
  });

  it('should handle empty or null input gracefully', () => {
    expect(normalizeReviewText(null)).toBe('');
    expect(normalizeReviewText(undefined)).toBe('');
    expect(normalizeReviewText('')).toBe('');
  });
});
