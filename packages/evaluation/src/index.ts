import { AgentName } from '@commerce-ops/shared-types';

export interface TestCase {
  id: string;
  category: string;
  question: string;
  expectedAgents: AgentName[];
  expectedTools: string[];
  expectedMetric: {
    name: string;
    expectedValue: number | string;
    tolerancePercent?: number;
  };
}

export interface EvalResult {
  testCaseId: string;
  configType: 'SINGLE_AGENT' | 'MULTI_AGENT_NO_CRITIC' | 'MULTI_AGENT_WITH_CRITIC';
  numericalAccuracyScore: number;
  agentRoutingScore: number;
  toolEfficiencyScore: number;
  groundednessScore: number;
  hallucinationRate: number;
  criticUsefulnessScore: number;
  totalDurationMs: number;
  totalCostEstimateUsd: number;
  passed: boolean;
  isSynthetic?: boolean;
  note?: string;
}

export * from './eval-cases';
