export const CITIES: { name: string; region: string }[] = [
  { name: 'Addis Ababa', region: 'Addis Ababa' },
  { name: 'Adama', region: 'Oromia' },
  { name: 'Hawassa', region: 'Sidama' },
  { name: 'Bahir Dar', region: 'Amhara' },
  { name: 'Dire Dawa', region: 'Dire Dawa' },
  { name: 'Mekelle', region: 'Tigray' },
  { name: 'Gondar', region: 'Amhara' },
  { name: 'Jimma', region: 'Oromia' },
  { name: 'Bishoftu', region: 'Oromia' },
  { name: 'Hossana', region: 'Central Ethiopia' },
];

export const CONDITIONS = [
  { value: 'NEW', label: 'New' },
  { value: 'LIKE_NEW', label: 'Like New' },
  { value: 'GOOD', label: 'Good' },
  { value: 'FAIR', label: 'Fair' },
  { value: 'SALVAGE', label: 'Salvage' },
];

export const UNITS = ['bag', 'kg', 'quintal', 'tonne', 'piece', 'sheet', 'm³', 'meter', 'roll', 'box', 'bucket', 'set', 'unit', 'bundle', 'trip'];

export const CONDITION_LABELS: Record<string, string> = {
  NEW: 'New',
  LIKE_NEW: 'Like New',
  GOOD: 'Good',
  FAIR: 'Fair',
  SALVAGE: 'Salvage',
};

export interface ChipMeta { label: string; classes: string }

export const CONDITION_META: Record<string, ChipMeta> = {
  NEW: { label: 'New', classes: 'bg-emerald-100 text-emerald-800' },
  LIKE_NEW: { label: 'Like New', classes: 'bg-teal-100 text-teal-800' },
  GOOD: { label: 'Good', classes: 'bg-sky-100 text-sky-800' },
  FAIR: { label: 'Fair', classes: 'bg-amber-100 text-amber-800' },
  SALVAGE: { label: 'Salvage', classes: 'bg-stone-200 text-stone-700' },
};

export const LISTING_STATUS_META: Record<string, ChipMeta> = {
  ACTIVE: { label: 'Active', classes: 'bg-emerald-100 text-emerald-800' },
  PENDING_APPROVAL: { label: 'Pending Review', classes: 'bg-amber-100 text-amber-800' },
  DRAFT: { label: 'Draft', classes: 'bg-stone-200 text-stone-600' },
  SOLD: { label: 'Sold Out', classes: 'bg-navy-100 text-navy-700' },
  EXPIRED: { label: 'Expired', classes: 'bg-stone-200 text-stone-600' },
  REJECTED: { label: 'Rejected', classes: 'bg-red-100 text-red-700' },
  SUSPENDED: { label: 'Suspended', classes: 'bg-red-100 text-red-700' },
};

export const TXN_STATUS_META: Record<string, ChipMeta> = {
  NEGOTIATING: { label: 'Negotiating', classes: 'bg-stone-200 text-stone-700' },
  PAYMENT_PENDING: { label: 'Awaiting Payment', classes: 'bg-amber-100 text-amber-800' },
  PAID: { label: 'Paid — In Escrow', classes: 'bg-sky-100 text-sky-800' },
  DELIVERING: { label: 'Delivering', classes: 'bg-indigo-100 text-indigo-800' },
  DELIVERED: { label: 'Delivered', classes: 'bg-teal-100 text-teal-800' },
  COMPLETED: { label: 'Completed', classes: 'bg-emerald-100 text-emerald-800' },
  CANCELLED: { label: 'Cancelled', classes: 'bg-stone-200 text-stone-600' },
  DISPUTED: { label: 'Disputed', classes: 'bg-red-100 text-red-700' },
  REFUNDED: { label: 'Refunded', classes: 'bg-violet-100 text-violet-800' },
};

export const ESCROW_STATUS_META: Record<string, ChipMeta> = {
  PENDING: { label: 'Pending', classes: 'bg-amber-100 text-amber-800' },
  HELD: { label: 'Held in Escrow', classes: 'bg-sky-100 text-sky-800' },
  RELEASED: { label: 'Released', classes: 'bg-emerald-100 text-emerald-800' },
  REFUNDED: { label: 'Refunded', classes: 'bg-violet-100 text-violet-800' },
  DISPUTED: { label: 'Disputed', classes: 'bg-red-100 text-red-700' },
  AUTO_REFUNDED: { label: 'Auto-Refunded', classes: 'bg-violet-100 text-violet-800' },
};

export const VERIF_STATUS_META: Record<string, ChipMeta> = {
  UNVERIFIED: { label: 'Unverified', classes: 'bg-stone-200 text-stone-600' },
  PENDING: { label: 'Verification Pending', classes: 'bg-amber-100 text-amber-800' },
  VERIFIED: { label: 'Verified', classes: 'bg-emerald-100 text-emerald-800' },
  REJECTED: { label: 'Rejected', classes: 'bg-red-100 text-red-700' },
};

export const VREQ_STATUS_META: Record<string, ChipMeta> = {
  PENDING: { label: 'Awaiting Agent', classes: 'bg-amber-100 text-amber-800' },
  ASSIGNED: { label: 'Agent Assigned', classes: 'bg-sky-100 text-sky-800' },
  IN_PROGRESS: { label: 'In Progress', classes: 'bg-indigo-100 text-indigo-800' },
  COMPLETED: { label: 'Completed', classes: 'bg-emerald-100 text-emerald-800' },
  REJECTED: { label: 'Rejected', classes: 'bg-red-100 text-red-700' },
};

export const ROLE_LABELS: Record<string, string> = {
  BUYER: 'Buyer',
  SELLER: 'Seller',
  VERIFICATION_AGENT: 'Verification Agent',
  DELIVERY_AGENT: 'Delivery Agent',
  ADMIN: 'Admin',
  SUPER_ADMIN: 'Super Admin',
  GUEST: 'Guest',
};

export const TXN_STEPS = ['PAYMENT_PENDING', 'PAID', 'DELIVERING', 'COMPLETED'];

export const PRESET_IMAGES = [
  { url: '/images/materials/cement.jpg', label: 'Cement' },
  { url: '/images/materials/rebar.jpg', label: 'Rebar' },
  { url: '/images/materials/steel.jpg', label: 'Steel' },
  { url: '/images/materials/lumber.jpg', label: 'Lumber' },
  { url: '/images/materials/bricks.jpg', label: 'Bricks' },
  { url: '/images/materials/aggregate.jpg', label: 'Aggregate' },
  { url: '/images/materials/roofing.jpg', label: 'Roofing' },
  { url: '/images/materials/tiles.jpg', label: 'Tiles' },
  { url: '/images/materials/pipes.jpg', label: 'Pipes' },
  { url: '/images/materials/electrical.jpg', label: 'Electrical' },
  { url: '/images/materials/paint.jpg', label: 'Paint' },
  { url: '/images/materials/scaffolding.jpg', label: 'Equipment' },
];
