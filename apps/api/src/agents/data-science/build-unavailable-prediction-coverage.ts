import { ScenarioUnavailabilityReason } from './scenario-readiness.schema';

export interface ComponentCoverageEntry {
  component: 'MODEL_GOVERNANCE' | 'PREDICTION' | 'LOCAL_EXPLANATION';
  status: 'ANSWERED' | 'UNAVAILABLE_WITH_REASON';
  reasonCode?: ScenarioUnavailabilityReason;
  evidenceIds: string[];
}

export function buildUnavailablePredictionCoverage(
  governanceEvId: string,
  scenarioEvId: string,
  unavailabilityReason: ScenarioUnavailabilityReason = 'SNAPSHOT_TABLE_EMPTY',
): ComponentCoverageEntry[] {
  return [
    {
      component: 'MODEL_GOVERNANCE',
      status: 'ANSWERED',
      evidenceIds: [governanceEvId],
    },
    {
      component: 'PREDICTION',
      status: 'UNAVAILABLE_WITH_REASON',
      reasonCode: unavailabilityReason,
      evidenceIds: [scenarioEvId],
    },
    {
      component: 'LOCAL_EXPLANATION',
      status: 'UNAVAILABLE_WITH_REASON',
      reasonCode: 'NO_VALID_PREDICTION',
      evidenceIds: [scenarioEvId],
    },
  ];
}
