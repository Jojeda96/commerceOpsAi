import { ModelGovernanceResult } from './governance-result.schema';
import { ScenarioResult } from './scenario-result.schema';
import { PredictionResult } from './prediction-result.schema';
import { ExplanationResult } from './explanation-result.schema';

export interface DataScienceInvestigationResult {
  governance: ModelGovernanceResult;
  scenarios: ScenarioResult;
  predictions: PredictionResult[];
  explanations: ExplanationResult[];
  limitations: string[];
  coverage: {
    governanceAnswered: boolean;
    predictionAnswered: boolean;
    explanationAnswered: boolean;
  };
}
