import {
  ScenarioUnavailabilityReason,
  ScenarioDiagnostics,
} from './scenario-readiness.schema';

export interface DeliveryScenario {
  scenarioId: string;
  sellerState: string;
  customerState: string;
  category: string;
  observationCount: number;
  historicalLateRatePct: number;
  features: Record<string, number>;
}

export type ScenarioQueryResult =
  | {
      status: 'AVAILABLE';
      scenarios: DeliveryScenario[];
      diagnostics: ScenarioDiagnostics;
    }
  | {
      status: 'UNAVAILABLE';
      reasonCode: ScenarioUnavailabilityReason;
      diagnostics: ScenarioDiagnostics;
    };
