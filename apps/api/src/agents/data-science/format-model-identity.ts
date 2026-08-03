export function formatModelIdentity(
  algorithm: string,
  versionStr: string,
): string {
  const cleanAlg = (algorithm || 'xgboost').toLowerCase();
  let cleanVersion = versionStr || 'delivery-risk-v2.0.0';

  // Fix accidental leading 'v' duplication if version starts with 'vdelivery' or 'vv'
  if (cleanVersion.startsWith('vdelivery')) {
    cleanVersion = cleanVersion.substring(1);
  } else if (cleanVersion.startsWith('vv')) {
    cleanVersion = cleanVersion.substring(1);
  }

  return `${cleanAlg} — ${cleanVersion}`;
}
