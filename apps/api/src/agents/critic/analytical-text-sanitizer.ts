/**
 * Sanitizes analytical text by removing non-metric numeric tokens like
 * semantic version strings, ISO dates, execution IDs, and hex hashes
 * before number extraction for numeric claim auditing.
 */
export function sanitizeAnalyticalText(text: string): string {
  if (!text) return '';

  let sanitized = text;

  // 1. Remove ISO dates (e.g., 2018-02-01, 2018-02, 2026-08-03T21:30:43.505Z)
  sanitized = sanitized.replace(
    /\b\d{4}-\d{2}(-\d{2})?(T\d{2}:\d{2}:\d{2}(\.\d+)?Z?)?\b/gi,
    ' ',
  );

  // 2. Remove semantic versions (e.g., delivery-risk-v2.0.0, v2.0.0, xgboost-2.1.3, 2.0.0)
  // Preserves simple decimals like 3.46 or 7.8
  sanitized = sanitized.replace(
    /\b(?:[a-z][a-z0-9_-]*-v?\d+\.\d+(?:\.\d+)?|v\d+\.\d+(?:\.\d+)?|\d+\.\d+\.\d+)\b/gi,
    ' ',
  );

  // 3. Remove execution IDs, run IDs, and UUIDs (e.g., run-anomaly-1-1785792627448, faf0a2b2-861a-4794-b4f3-cd8c5ab55d14)
  sanitized = sanitized.replace(
    /\b(?:run|ev|finding|task|claim|scope)-[a-z0-9_-]+\b/gi,
    ' ',
  );
  sanitized = sanitized.replace(
    /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
    ' ',
  );

  // 4. Remove hex hashes (e.g., f3ec52388020d442)
  sanitized = sanitized.replace(/\b[0-9a-f]{12,64}\b/gi, ' ');

  // 5. Remove quoted text snippets (e.g., customer review quotes in "...")
  sanitized = sanitized.replace(/"[^"]*"/g, ' ');

  return sanitized;
}
