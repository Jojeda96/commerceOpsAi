import { MetricUnit, NumericClaim } from '@commerce-ops/shared-types';

export interface RenderNumberOptions {
  metricKey: string;
  value: number;
  unit: MetricUnit;
  evidenceId: string;
  sourcePath: string;
  tolerance?: number;
  sampleSize?: number;
  decimals?: number;
  suffix?: string;
  prefix?: string;
}

export function renderNumberWithClaim(options: RenderNumberOptions): {
  renderedText: string;
  claim: NumericClaim;
} {
  const {
    metricKey,
    value,
    unit,
    evidenceId,
    sourcePath,
    tolerance = 0.05,
    sampleSize,
    decimals = 1,
    suffix = '',
    prefix = '',
  } = options;

  let formattedValue: string;
  if (unit === 'COUNT') {
    formattedValue = Math.round(value).toLocaleString('en-US');
  } else if (unit === 'PERCENT') {
    formattedValue = (
      Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals)
    ).toFixed(decimals);
  } else {
    formattedValue = value.toString();
  }

  const renderedText = `${prefix}${formattedValue}${suffix}`;
  const claimId = `claim-${metricKey.replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  const claim: NumericClaim = {
    claimId,
    metricKey,
    value,
    unit,
    evidenceId,
    sourcePath,
    tolerance,
    sampleSize,
    renderedTextFragment: renderedText,
  };

  return { renderedText, claim };
}
