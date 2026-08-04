import { AgentName } from '@commerce-ops/shared-types';

export type InvestigationCapability =
  | 'DESCRIPTIVE_LOGISTICS'
  | 'ANOMALY_DETECTION'
  | 'HISTORICAL_CONTEXT'
  | 'ML_PREDICTION'
  | 'MODEL_GOVERNANCE'
  | 'LOCAL_EXPLANATION'
  | 'SALES_ANALYSIS'
  | 'CUSTOMER_EXPERIENCE_ANALYSIS'
  | 'REVIEW_COMPLAINT_ANALYSIS'
  | 'SELLER_ANALYSIS';

export function mapCapabilitiesToAgents(
  capabilities: InvestigationCapability[],
): AgentName[] {
  const agents = new Set<AgentName>();

  for (const cap of capabilities) {
    switch (cap) {
      case 'DESCRIPTIVE_LOGISTICS':
      case 'HISTORICAL_CONTEXT':
        agents.add('LOGISTICS');
        break;
      case 'ANOMALY_DETECTION':
        agents.add('LOGISTICS');
        agents.add('ANOMALY');
        break;
      case 'ML_PREDICTION':
      case 'MODEL_GOVERNANCE':
      case 'LOCAL_EXPLANATION':
        agents.add('LOGISTICS');
        agents.add('DATA_SCIENCE');
        break;
      case 'SALES_ANALYSIS':
        agents.add('SALES');
        break;
      case 'CUSTOMER_EXPERIENCE_ANALYSIS':
      case 'REVIEW_COMPLAINT_ANALYSIS':
        agents.add('CUSTOMER_EXPERIENCE');
        break;
      case 'SELLER_ANALYSIS':
        agents.add('SELLER_PERFORMANCE');
        break;
    }
  }

  if (agents.size === 0) {
    agents.add('LOGISTICS');
  }

  return Array.from(agents);
}
