import { Link } from 'react-router-dom';
import { MapPin, ShieldCheck } from 'lucide-react';
import { formatETB, firstImage, timeAgo } from '../lib/format';
import { CONDITION_META } from '../lib/constants';
import { Chip, Stars } from './ui';

export default function ListingCard({ listing }: { listing: any }) {
  const img = firstImage(listing.images);
  const seller = listing.seller;
  return (
    <Link to={`/listing/${listing.id}`} className="card overflow-hidden group hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 flex flex-col">
      <div className="relative aspect-[4/3] bg-stone-100 overflow-hidden">
        {img ? (
          <img src={img} alt={listing.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-stone-300 bg-navy-50">
            <span className="text-4xl font-black">{listing.title?.[0] || '?'}</span>
          </div>
        )}
        <div className="absolute top-2.5 left-2.5 flex gap-1.5">
          {listing.condition && CONDITION_META[listing.condition] && (
            <Chip meta={CONDITION_META[listing.condition]} className="!bg-white/95 shadow-sm backdrop-blur" />
          )}
        </div>
        {listing.verification_status === 'VERIFIED' && (
          <div className="absolute top-2.5 right-2.5 bg-emerald-500 text-white rounded-full px-2 py-1 text-[10px] font-bold flex items-center gap-1 shadow">
            <ShieldCheck size={11} /> VERIFIED
          </div>
        )}
        {listing.featured && (
          <div className="absolute bottom-2.5 left-2.5 bg-gold-500 text-navy-900 rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide shadow">
            Featured
          </div>
        )}
      </div>
      <div className="p-4 flex flex-col flex-1">
        <div className="flex items-baseline gap-1">
          <span className="text-lg font-extrabold text-navy-800">{formatETB(listing.price_per_unit)}</span>
          <span className="text-xs text-stone-500 font-medium">/ {listing.unit}</span>
        </div>
        <h3 className="mt-1 font-semibold text-[15px] text-stone-800 leading-snug line-clamp-2 group-hover:text-navy-700 transition-colors">
          {listing.title}
        </h3>
        <div className="mt-auto pt-3 flex items-center justify-between text-xs text-stone-500">
          <span className="inline-flex items-center gap-1 font-medium">
            <MapPin size={12} className="text-navy-400" /> {listing.city}
          </span>
          <span>{timeAgo(listing.created_at)}</span>
        </div>
        {seller && (
          <div className="mt-2 pt-2 border-t border-stone-100 flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-600 truncate">{seller.company_name || seller.full_name}</span>
            {Number(seller.rating_avg) > 0 && (
              <span className="inline-flex items-center gap-1">
                <Stars value={seller.rating_avg} size={11} />
                <span className="text-[11px] font-bold text-stone-600">{Number(seller.rating_avg).toFixed(1)}</span>
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
