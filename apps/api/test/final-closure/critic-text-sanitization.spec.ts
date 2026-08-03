import { auditMethodProvenance } from '../../src/agents/critic/method-provenance';
import { extractNumbersFromText } from '../../src/agents/critic/rendered-number-coverage';
import { sanitizeAnalyticalText } from '../../src/agents/critic/analytical-text-sanitizer';
import { parseMethodAssertion } from '../../src/agents/critic/method-assertion-parser';

describe('Critic Text Sanitization & Negations (PR-00 / PR-03)', () => {
  describe('Method Negation Parser', () => {
    it('should distinguish negated SHAP mentions', () => {
      const text = 'No se ejecutó inferencia predictiva ni SHAP.';
      const res = parseMethodAssertion(text, 'LOCAL_SHAP');
      expect(res.mentioned).toBe(true);
      expect(res.polarity).toBe('NEGATED');
    });

    it('should identify asserted SHAP mentions', () => {
      const text =
        'Los factores SHAP de mayor impacto fueron la distancia y el peso.';
      const res = parseMethodAssertion(text, 'LOCAL_SHAP');
      expect(res.mentioned).toBe(true);
      expect(res.polarity).toBe('ASSERTED');
    });

    it('should not flag UNSUPPORTED_METHOD_CLAIM for negated SHAP in auditMethodProvenance', () => {
      const findings: any[] = [
        {
          id: 'f-1',
          agent: 'DATA_SCIENCE',
          title: 'Gobernanza',
          description: 'No se ejecutó inferencia predictiva ni SHAP.',
          evidenceIds: ['ev-gov'],
        },
      ];
      const evidenceList: any[] = [
        {
          id: 'ev-gov',
          toolName: 'get_delivery_model_governance',
        },
      ];

      const violations = auditMethodProvenance(findings, evidenceList);
      const shapViolations = violations.filter(
        (v) => v.method === 'LOCAL_SHAP',
      );
      expect(shapViolations.length).toBe(0);
    });
  });

  describe('Analytical Text Sanitizer & Number Extraction', () => {
    it('should sanitize semantic versions, dates, and run IDs from text', () => {
      const rawText =
        'Modelo xgboost — delivery-risk-v2.0.0 evaluado en 2018-02 con run-anomaly-1-1785792627448. Umbral Z = 3.46 y 24 meses.';
      const sanitized = sanitizeAnalyticalText(rawText);
      expect(sanitized).not.toContain('v2.0.0');
      expect(sanitized).not.toContain('2018-02');
      expect(sanitized).not.toContain('1785792627448');

      const numbers = extractNumbersFromText(rawText);
      const values = numbers.map((n) => n.value);
      expect(values).not.toContain(0);
      expect(values).toContain(3.46);
      expect(values).toContain(24);
    });
  });
});
