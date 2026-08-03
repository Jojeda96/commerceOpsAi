import { Finding, NumericClaim } from '@commerce-ops/shared-types';

export interface UncoveredNumberResult {
  rawText: string;
  value: number;
  index: number;
}

export function extractNumbersFromText(
  text: string,
): { rawText: string; value: number; index: number }[] {
  // Matches integer and floating-point numbers, including formatted numbers like 61,779 or 61.779 or 9.3%
  const regex = /(?<![vV\w-])\b\d+(?:[.,]\d+)*%?\b/g;
  const results: { rawText: string; value: number; index: number }[] = [];

  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const rawText = match[0];
    const isYear = /^(?:201[6-9]|202[0-9])$/.test(rawText);
    if (isYear) continue;

    let cleaned = rawText.replace('%', '');
    // If text has ',' as thousands separator like 61,779
    if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(cleaned)) {
      cleaned = cleaned.replace(/,/g, '');
    } else if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(cleaned)) {
      // European 61.779,50
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      // Simple 9.3 or 61779
      cleaned = cleaned.replace(',', '.');
    }

    const value = parseFloat(cleaned);
    if (!isNaN(value)) {
      results.push({ rawText, value, index: match.index });
    }
  }

  return results;
}

export function findUncoveredNumbers(
  finding: Finding,
): UncoveredNumberResult[] {
  if (!finding.description) return [];

  const extracted = extractNumbersFromText(finding.description);
  const claims = finding.numericClaims || [];

  const uncovered: UncoveredNumberResult[] = [];

  for (const num of extracted) {
    const isClaimed = claims.some((c: NumericClaim) => {
      const tol = c.tolerance || 0.05;
      if (Math.abs(c.value - num.value) <= tol) return true;
      if (Math.abs(c.value * 100 - num.value) <= 0.1) return true;
      return false;
    });

    if (!isClaimed) {
      uncovered.push(num);
    }
  }

  return uncovered;
}
