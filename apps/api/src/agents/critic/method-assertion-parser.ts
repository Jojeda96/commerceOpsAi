import { AnalysisMethod } from '@commerce-ops/shared-types';

export interface MethodAssertionResult {
  method: AnalysisMethod;
  mentioned: boolean;
  polarity: 'NEGATED' | 'ASSERTED' | 'UNKNOWN';
}

export function parseMethodAssertion(
  text: string,
  method: AnalysisMethod,
): MethodAssertionResult {
  if (!text) {
    return { method, mentioned: false, polarity: 'UNKNOWN' };
  }

  const normText = text.toLowerCase();

  if (method === 'LOCAL_SHAP') {
    const mentionsShap = /\bshap\b/i.test(normText);
    if (!mentionsShap) {
      return { method, mentioned: false, polarity: 'UNKNOWN' };
    }

    const negationPatterns = [
      /no\s+(?:se\s+)?(?:ejecut[oó]|calcul[oó]|gener[oó]|aplic[oó])\s+.*shap/i,
      /shap\s+no\s+(?:estuvo\s+)?disponible/i,
      /sin\s+explicaci[oó]n\s+.*shap/i,
      /no\s+existe\s+.*explicaci[oó]n\s+.*shap/i,
      /no\s+se\s+ejecut[oó]\s+inferencia\s+predictiva\s+ni\s+shap/i,
      /explicaci[oó]n\s+local\s+.*no\s+est[aá]\s+disponible/i,
    ];

    const isNegated = negationPatterns.some((pattern) =>
      pattern.test(normText),
    );
    return {
      method,
      mentioned: true,
      polarity: isNegated ? 'NEGATED' : 'ASSERTED',
    };
  }

  if (method === 'ROBUST_Z_SCORE') {
    const mentionsZ = /\bz-?score\b|puntuaci[oó]n z/i.test(normText);
    if (!mentionsZ) {
      return { method, mentioned: false, polarity: 'UNKNOWN' };
    }

    const negationPatterns = [
      /no\s+fue\s+posible\s+calcular\s+.*z-?score/i,
      /no\s+se\s+aplic[oó]\s+.*z-?score/i,
      /no\s+se\s+ejecut[oó]\s+.*z-?score/i,
      /z-?score\s+no\s+disponible/i,
    ];

    const isNegated = negationPatterns.some((pattern) =>
      pattern.test(normText),
    );
    return {
      method,
      mentioned: true,
      polarity: isNegated ? 'NEGATED' : 'ASSERTED',
    };
  }

  return { method, mentioned: false, polarity: 'UNKNOWN' };
}
