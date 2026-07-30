export interface ModelPricing {
  inputPerMillion: number;
  outputPerMillion: number;
}

export const MODEL_PRICING_TABLE: Record<string, ModelPricing> = {
  'gpt-4o-mini': {
    inputPerMillion: 0.15,
    outputPerMillion: 0.6,
  },
  'gpt-4o': {
    inputPerMillion: 2.5,
    outputPerMillion: 10.0,
  },
  'gpt-3.5-turbo': {
    inputPerMillion: 0.5,
    outputPerMillion: 1.5,
  },
};

export function calculateEstimatedCostUsd(
  modelName: string,
  inputTokens?: number,
  outputTokens?: number,
): number | undefined {
  if (inputTokens === undefined && outputTokens === undefined) {
    return undefined;
  }

  const pricing = MODEL_PRICING_TABLE[modelName] || MODEL_PRICING_TABLE['gpt-4o-mini'];
  const inputCost = ((inputTokens || 0) / 1_000_000) * pricing.inputPerMillion;
  const outputCost = ((outputTokens || 0) / 1_000_000) * pricing.outputPerMillion;

  return Number((inputCost + outputCost).toFixed(6));
}
