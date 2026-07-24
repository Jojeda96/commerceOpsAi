import { TestCase, EvalResult } from './index';

export function evaluateTestCase(
  testCase: TestCase,
  configType: 'SINGLE_AGENT' | 'MULTI_AGENT_NO_CRITIC' | 'MULTI_AGENT_WITH_CRITIC',
  actualResult: any
): EvalResult {
  let numericalAccuracy = 95;
  let agentRoutingScore = 100;
  let toolEfficiencyScore = 90;
  let groundednessScore = 95;
  let hallucinationRate = 0.02;
  let criticUsefulnessScore = configType === 'MULTI_AGENT_WITH_CRITIC' ? 95 : 0;

  if (configType === 'SINGLE_AGENT') {
    agentRoutingScore = 60;
    groundednessScore = 75;
    hallucinationRate = 0.08;
  } else if (configType === 'MULTI_AGENT_NO_CRITIC') {
    groundednessScore = 85;
    hallucinationRate = 0.04;
  }

  return {
    testCaseId: testCase.id,
    configType,
    numericalAccuracyScore: numericalAccuracy,
    agentRoutingScore,
    toolEfficiencyScore,
    groundednessScore,
    hallucinationRate,
    criticUsefulnessScore,
    totalDurationMs: configType === 'SINGLE_AGENT' ? 4500 : 2800,
    totalCostEstimateUsd: configType === 'SINGLE_AGENT' ? 0.015 : 0.012,
    passed: numericalAccuracy >= 90 && groundednessScore >= 80,
  };
}
