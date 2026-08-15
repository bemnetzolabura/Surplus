import { firstImage } from './format';

const KEY = 'surplussell_recent';

export interface RecentItem {
  id: string;
  title: string;
  img: string | null;
  price: number;
  unit: string;
  city: string;
}

export function pushRecent(listing: any) {
  if (!listing?.id || typeof window === 'undefined') return;
  try {
    const item: RecentItem = {
      id: listing.id,
      title: listing.title,
      img: firstImage(listing.images),
      price: Number(listing.price_per_unit) || 0,
      unit: listing.unit || 'unit',
      city: listing.city || '',
    };
    const rest = getRecent().filter((x) => x.id !== item.id);
    localStorage.setItem(KEY, JSON.stringify([item, ...rest].slice(0, 10)));
  } catch { /* storage unavailable */ }
}

export function getRecent(): RecentItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const arr = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
