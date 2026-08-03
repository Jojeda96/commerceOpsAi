export const ANOMALY_QUESTION =
  'Detecta desviaciones o picos anómalos en la tasa de retraso de entregas mediante Z-Score robusto.';

export const ANOMALY_EXPECTED_AGENTS = ['LOGISTICS', 'ANOMALY'];

export const ANOMALY_LOGISTICS_PROHIBITED_PHRASES = [
  'utilizando el z-score',
  'aplicando z-score',
  'mediante z-score',
  'se identificaron dos meses',
];

export function containsProhibitedPhrase(
  text: string,
  phrases: string[] = ANOMALY_LOGISTICS_PROHIBITED_PHRASES,
): boolean {
  const normalized = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  return phrases.some((phrase) => {
    const normPhrase = phrase
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    return normalized.includes(normPhrase);
  });
}
