import { InvestigationCapability } from './capability-agent-map';
import { resolveQuestionCapabilities } from './question-intent';

export function classifyCapabilities(
  question: string,
): InvestigationCapability[] {
  return resolveQuestionCapabilities(question);
}
