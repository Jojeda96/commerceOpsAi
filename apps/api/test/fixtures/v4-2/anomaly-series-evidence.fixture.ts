export const ANOMALY_SERIES_EVIDENCE_FIXTURE = {
  method: 'ROBUST_Z_SCORE',
  threshold: 3.0,
  monthsEvaluated: 24,
  medianMonthlyLateRatePct: 7.8,
  mad: 1.2,
  anomalies: [
    {
      month: '2018-02',
      lateRatePct: 14.5,
      sampleSize: 3200,
      robustZScore: 3.46,
    },
    {
      month: '2018-03',
      lateRatePct: 18.2,
      sampleSize: 3500,
      robustZScore: 5.24,
    },
  ],
};
