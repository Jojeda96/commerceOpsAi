export const CAPABILITIES = {
  historicalBatchAnalysis: true,
  scheduledMonitoring: true,
  realTimeOrderIngestion: false,
  causalImpactEstimation: false,
  carrierIdentityAnalysis: false,
};

export type CapabilitiesType = typeof CAPABILITIES;
