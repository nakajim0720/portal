import { CARD_CATEGORIES, type CardCategory, type PrefillQueryData } from '../types';

export function readAndClearPrefillQuery(): PrefillQueryData | null {
  const params = new URLSearchParams(window.location.search);
  const name = params.get('name')?.trim() || '';
  const price = params.get('price')?.trim() || '';
  const url = params.get('url')?.trim() || '';
  const rawCategory = params.get('category')?.trim() || '';

  const category = (CARD_CATEGORIES as readonly string[]).includes(rawCategory)
    ? (rawCategory as CardCategory)
    : undefined;

  if (!name && !price && !url && !category) {
    return null;
  }

  // URLからクエリを除去（ハッシュは維持）
  const cleanUrl = `${window.location.pathname}${window.location.hash}`;
  window.history.replaceState(null, '', cleanUrl);

  return {
    name: name || undefined,
    price: price || undefined,
    url: url || undefined,
    category,
  };
}