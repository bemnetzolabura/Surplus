import type { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Star, StarHalf, ShieldCheck, Package, Layers, TreePine, Mountain, Boxes, House,
  LayoutGrid, Cable, Droplets, PaintBucket, Construction, Hammer, Warehouse, X,
  type LucideIcon,
} from 'lucide-react';
import type { ChipMeta } from '../lib/constants';

export function Spinner({ size = 22, className = '' }: { size?: number; className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

export function PageLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-navy-400">
      <Spinner size={30} />
      <p className="mt-3 text-sm font-medium">{label}</p>
    </div>
  );
}

export function Chip({ meta, className = '' }: { meta: ChipMeta; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ${meta.classes} ${className}`}>
      {meta.label}
    </span>
  );
}

export function VerifiedBadge({ small = false }: { small?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 font-semibold ${small ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'}`}>
      <ShieldCheck size={small ? 12 : 14} />
      Verified
    </span>
  );
}

export function Stars({ value = 0, size = 14, className = '' }: { value?: number | string; size?: number; className?: string }) {
  const v = Math.max(0, Math.min(5, Number(value) || 0));
  const full = Math.floor(v);
  const half = v - full >= 0.5;
  return (
    <span className={`inline-flex items-center gap-0.5 text-gold-500 ${className}`}>
      {Array.from({ length: 5 }).map((_, i) =>
        i < full ? (
          <Star key={i} size={size} fill="currentColor" strokeWidth={0} />
        ) : i === full && half ? (
          <span key={i} className="relative inline-flex" style={{ width: size, height: size }}>
            <Star size={size} className="absolute text-stone-300" fill="currentColor" strokeWidth={0} />
            <StarHalf size={size} className="absolute" fill="currentColor" strokeWidth={0} />
          </span>
        ) : (
          <Star key={i} size={size} className="text-stone-300" fill="currentColor" strokeWidth={0} />
        )
      )}
    </span>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  message,
  action,
}: {
  icon: LucideIcon;
  title: string;
  message?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-14 h-14 rounded-2xl bg-navy-50 text-navy-300 flex items-center justify-center">
        <Icon size={26} />
      </div>
      <h3 className="mt-4 font-bold text-navy-800">{title}</h3>
      {message && <p className="mt-1 text-sm text-stone-500 max-w-sm">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 bg-navy-950/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 40, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 30, opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', damping: 28, stiffness: 350 }}
            className={`bg-white w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[92vh] flex flex-col`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
              <h3 className="font-bold text-navy-800 text-lg">{title}</h3>
              <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-stone-100 flex items-center justify-center text-stone-500">
                <X size={18} />
              </button>
            </div>
            <div className="overflow-y-auto px-5 py-4">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  cement: Package,
  rebar: Layers,
  steel: Warehouse,
  lumber: TreePine,
  aggregates: Mountain,
  'bricks-blocks': Boxes,
  roofing: House,
  'tiles-ceramics': LayoutGrid,
  electrical: Cable,
  plumbing: Droplets,
  'paint-finishing': PaintBucket,
  'equipment-tools': Construction,
  hardware: Hammer,
};

export function CategoryIcon({ slug, size = 20, className = '' }: { slug: string; size?: number; className?: string }) {
  const Icon = CATEGORY_ICONS[slug] || Package;
  return <Icon size={size} className={className} />;
}

export function Avatar({ name, size = 40, className = '' }: { name?: string | null; size?: number; className?: string }) {
  const initialsStr = (name || 'U').trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
  return (
    <div
      className={`rounded-full bg-navy-800 text-gold-400 font-bold flex items-center justify-center shrink-0 ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initialsStr}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="card overflow-hidden animate-pulse">
      <div className="aspect-[4/3] bg-stone-200" />
      <div className="p-4 space-y-2.5">
        <div className="h-3 bg-stone-200 rounded w-1/3" />
        <div className="h-4 bg-stone-200 rounded w-full" />
        <div className="h-4 bg-stone-200 rounded w-2/3" />
        <div className="h-3 bg-stone-200 rounded w-1/2" />
      </div>
    </div>
  );
}
