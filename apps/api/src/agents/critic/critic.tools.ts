import { tool } from '@langchain/core/tools';
import { z } from 'zod';

export function createCriticTools() {
  const validateFindingEvidence = tool(
    async ({ findingTitle, evidenceCount }) => {
      if (evidenceCount === 0) {
        return JSON.stringify({
          valid: false,
          issue: `El hallazgo "${findingTitle}" no tiene ninguna evidencia enlazada.`,
        });
      }
      return JSON.stringify({
        valid: true,
        message: `El hallazgo "${findingTitle}" cuenta con ${evidenceCount} evidencia(s) verificable(s).`,
      });
    },
    {
      name: 'validate_finding_evidence',
      description:
        'Verifica que un hallazgo tenga evidencias registradas y no inventadas.',
      schema: z.object({
        findingTitle: z.string(),
        evidenceCount: z.number(),
      }),
    },
  );

  const checkCausalLanguage = tool(
    async ({ text }) => {
      const causalTerms = [
        'causó',
        'provocó',
        'demuestra que',
        'debido únicamente a',
      ];
      const found = causalTerms.filter((term) =>
        text.toLowerCase().includes(term),
      );

      if (found.length > 0) {
        return JSON.stringify({
          hasCausalClaims: true,
          termsFound: found,
          warning:
            'Se detectaron afirmaciones causales estrictas. Se sugiere reformular a lenguaje correlacional o condicional.',
        });
      }
      return JSON.stringify({ hasCausalClaims: false });
    },
    {
      name: 'check_causal_language',
      description:
        'Detecta palabras de causalidad estricta para exigir fundamentación o moderar el lenguaje.',
      schema: z.object({
        text: z.string(),
      }),
    },
  );

  return [validateFindingEvidence, checkCausalLanguage];
}
