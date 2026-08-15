const CITY_KM: Record<string, number> = {
  'Addis Ababa~Adama': 100,
  'Addis Ababa~Bishoftu': 45,
  'Addis Ababa~Hawassa': 275,
  'Addis Ababa~Bahir Dar': 565,
  'Addis Ababa~Dire Dawa': 445,
  'Addis Ababa~Mekelle': 780,
  'Addis Ababa~Gondar': 725,
  'Addis Ababa~Jimma': 350,
  'Addis Ababa~Hossana': 230,
  'Adama~Bishoftu': 50,
  'Adama~Hawassa': 220,
  'Adama~Dire Dawa': 360,
  'Adama~Bahir Dar': 650,
  'Adama~Mekelle': 860,
  'Adama~Gondar': 820,
  'Adama~Jimma': 400,
  'Adama~Hossana': 300,
  'Bishoftu~Hawassa': 260,
  'Bishoftu~Dire Dawa': 400,
  'Bishoftu~Bahir Dar': 600,
  'Bishoftu~Mekelle': 800,
  'Bishoftu~Jimma': 380,
  'Bahir Dar~Mekelle': 480,
  'Bahir Dar~Gondar': 180,
  'Dire Dawa~Hawassa': 520,
  'Dire Dawa~Mekelle': 760,
  'Gondar~Mekelle': 360,
  'Hawassa~Jimma': 310,
  'Hawassa~Hossana': 120,
};

export function distanceKm(a?: string | null, b?: string | null): number {
  if (!a || !b) return 550;
  if (a === b) return 0;
  const pair = [a, b].sort();
  return CITY_KM[`${pair[0]}~${pair[1]}`] ?? 550;
}

export function deliveryFeeETB(km: number): number {
  return Math.round((400 + Math.max(km, 0) * 3.5) / 10) * 10;
}

export const DELIVERY_STATUS_META: Record<string, { label: string; classes: string }> = {
  PENDING: { label: 'Awaiting driver', classes: 'bg-amber-100 text-amber-800' },
  ACCEPTED: { label: 'Driver assigned', classes: 'bg-sky-100 text-sky-800' },
  PICKED_UP: { label: 'In transit', classes: 'bg-indigo-100 text-indigo-800' },
  DELIVERED: { label: 'Delivered', classes: 'bg-emerald-100 text-emerald-800' },
  CANCELLED: { label: 'Cancelled', classes: 'bg-stone-200 text-stone-600' },
};
