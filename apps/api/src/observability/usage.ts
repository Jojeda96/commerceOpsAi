export function extractModelUsage(response: any) {
  const usage =
    response?.usage_metadata ??
    response?.response_metadata?.tokenUsage ??
    response?.response_metadata?.usage;

  return {
    inputTokens:
      usage?.input_tokens ??
      usage?.promptTokens ??
      usage?.prompt_tokens ??
      undefined,
    outputTokens:
      usage?.output_tokens ??
      usage?.completionTokens ??
      usage?.completion_tokens ??
      undefined,
  };
}
