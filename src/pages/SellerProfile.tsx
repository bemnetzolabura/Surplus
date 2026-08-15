import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CalendarDays, MapPin, Package, Quote, ShoppingBag } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { fmtDate } from '../lib/format';
import { Avatar, EmptyState, PageLoader, Stars, VerifiedBadge } from '../components/ui';
import ListingCard from '../components/ListingCard';

export default function SellerProfile() {
  const { id } = useParams();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch(`/api/profiles?id=${id}`).then(setData).catch((e) => setError(e.message));
  }, [id]);

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <h2 className="text-xl font-bold text-navy-900">Profile not found</h2>
        <Link to="/browse" className="btn btn-navy mt-6">Back to marketplace</Link>
      </div>
    );
  }
  if (!data) return <PageLoader label="Loading profile…" />;

  const { profile, listings, ratings } = data;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="card overflow-hidden">
        <div className="h-24 sm:h-32 bg-gradient-to-r from-navy-900 via-navy-800 to-navy-600 relative">
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, #E8B931 0%, transparent 40%)' }} />
        </div>
        <div className="px-6 pb-6 -mt-10 flex flex-col sm:flex-row sm:items-end gap-4">
          <Avatar name={profile.company_name || profile.full_name} size={84} className="ring-4 ring-white" />
          <div className="flex-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-extrabold text-navy-900">{profile.company_name || profile.full_name}</h1>
              {profile.kyc_status === 'VERIFIED' && <VerifiedBadge />}
            </div>
            {profile.company_name && <p className="text-sm font-semibold text-stone-500">{profile.full_name}</p>}
            <div className="mt-2 flex items-center gap-4 flex-wrap text-sm text-stone-500">
              <span className="inline-flex items-center gap-1.5">
                <Stars value={profile.rating_avg} size={14} />
                <b className="text-stone-700">{Number(profile.rating_avg || 0).toFixed(1)}</b>
                <span>({profile.rating_count || 0} reviews)</span>
              </span>
              {profile.city && <span className="inline-flex items-center gap-1"><MapPin size={13} /> {profile.city}{profile.region ? `, ${profile.region}` : ''}</span>}
              <span className="inline-flex items-center gap-1"><CalendarDays size={13} /> Member since {fmtDate(profile.created_at)}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="bg-sand-50 rounded-xl px-6 py-3">
              <p className="text-2xl font-extrabold text-navy-800">{listings.length}</p>
              <p className="text-[11px] font-semibold text-stone-400 uppercase">Active listings</p>
            </div>
            <div className="bg-sand-50 rounded-xl px-6 py-3">
              <p className="text-2xl font-extrabold text-navy-800">{profile.total_transactions || 0}</p>
              <p className="text-[11px] font-semibold text-stone-400 uppercase">Completed orders</p>
            </div>
          </div>
        </div>
      </div>

      {/* Listings */}
      <h2 className="mt-10 mb-5 text-xl font-extrabold text-navy-900 tracking-tight flex items-center gap-2">
        <Package size={19} /> Materials for sale
      </h2>
      {listings.length === 0 ? (
        <div className="card">
          <EmptyState icon={Package} title="No active listings" message="This seller has no materials on the market right now." />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {listings.map((l: any) => <ListingCard key={l.id} listing={{ ...l, seller: profile }} />)}
        </div>
      )}

      {/* Ratings */}
      <h2 className="mt-10 mb-5 text-xl font-extrabold text-navy-900 tracking-tight flex items-center gap-2">
        <ShoppingBag size={19} /> Recent reviews
      </h2>
      {ratings.length === 0 ? (
        <div className="card">
          <EmptyState icon={Quote} title="No reviews yet" message="Reviews appear here after completed transactions." />
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {ratings.map((r: any) => (
            <div key={r.id} className="card p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar name={r.rater?.company_name || r.rater?.full_name} size={36} />
                  <div>
                    <p className="text-sm font-bold text-navy-900">{r.rater?.company_name || r.rater?.full_name || 'Trader'}</p>
                    <p className="text-[11px] text-stone-400">{fmtDate(r.created_at)}</p>
                  </div>
                </div>
                <Stars value={r.rating} size={14} />
              </div>
              {r.review && <p className="mt-3 text-sm text-stone-600 leading-relaxed">{r.review}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
