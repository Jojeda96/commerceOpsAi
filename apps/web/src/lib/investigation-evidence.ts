import { EvidenceDetail, FindingDetail } from '@/types/investigation-detail';

export function findEvidenceByTool(
  finding: FindingDetail,
  toolName: string,
): EvidenceDetail | undefined {
  if (!finding || !finding.evidence) return undefined;
  return finding.evidence.find(
    (e) => e.toolName === toolName || (e as any).evidenceType === toolName,
  );
}
