export const dsSnapshotEmptyFixture = {
  governance: {
    status: 'AVAILABLE' as const,
    scopeHash: 'f3ec52388020d442',
    appliedScope: {
      interstateOnly: true,
      provenance: [],
      scopeHash: 'f3ec52388020d442',
    },
    rowCount: 0,
    sampleSize: 0,
    methods: ['MODEL_INFERENCE' as const],
    metrics: [],
    data: {
      modelName: 'xgboost',
      modelVersion: 'delivery-risk-v2.0.0',
      deploymentStatus: 'EXPERIMENTAL_NOT_APPROVED',
      operationallyActionable: false,
      reasons: ['MODEL_EXPERIMENTAL_NOT_APPROVED'],
      qualityGateReasons: ['MODEL_EXPERIMENTAL_NOT_APPROVED'],
    },
  },
  scenarios: {
    status: 'UNAVAILABLE' as const,
    reasonCode: 'SNAPSHOT_TABLE_EMPTY',
    scopeHash: 'f3ec52388020d442',
    appliedScope: {
      interstateOnly: true,
      provenance: [],
      scopeHash: 'f3ec52388020d442',
    },
    rowCount: 0,
    sampleSize: 0,
    methods: ['MODEL_INFERENCE' as const],
    metrics: [],
    data: null,
    diagnostics: {
      tableExists: true,
      totalSnapshotRows: 0,
    },
  },
};
