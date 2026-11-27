export type FeatureId = 'portal' | 'kaimono' | 'card';

export function parseFeatureFromHash(hash: string): FeatureId {
  const normalized = hash.replace(/^#\/?/, '').split('?')[0]?.trim().toLowerCase();
  if (normalized === 'kaimono' || normalized === 'kaimono-compare') {
    return 'kaimono';
  }
  if (normalized === 'card' || normalized === 'card-approval') {
    return 'card';
  }
  return 'portal';
}

export function featureToHash(feature: FeatureId): string {
  switch (feature) {
    case 'kaimono':
      return '#/kaimono';
    case 'card':
      return '#/card';
    case 'portal':
    default:
      return '#/portal';
  }
}