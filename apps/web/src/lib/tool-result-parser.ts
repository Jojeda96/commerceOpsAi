import { EvidenceDetail } from '@/types/investigation-detail';

export function parseToolResult<T>(evidence?: EvidenceDetail): T | null {
  if (!evidence || !evidence.resultSummary) {
    return null;
  }

  try {
    const parsed =
      typeof evidence.resultSummary === 'string'
        ? JSON.parse(evidence.resultSummary)
        : evidence.resultSummary;

    return parsed as T;
  } catch (err) {
    console.warn('[parseToolResult] Error parsing tool result JSON:', err);
    return null;
  }
}
