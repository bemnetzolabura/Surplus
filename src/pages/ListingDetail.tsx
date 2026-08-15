import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, BadgeCheck, Calendar, Eye, HandCoins, Heart, MapPin, MessageSquare, Minus,
  Package, Plus, ShieldCheck, ShoppingCart, Tag, Truck,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiFetch } from '../lib/api';
import { CONDITION_LABELS, CONDITION_META } from '../lib/constants';
import { daysUntil, fmtDate, firstImage, formatETB, timeAgo } from '../lib/format';
import { pushRecent } from '../lib/recent';
import { Avatar, Chip, Modal, PageLoader, Stars, VerifiedBadge } from '../components/ui';
import ListingCard from '../components/ListingCard';

export default function ListingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile, token } = useAuth();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [imgIdx, setImgIdx] = useState(0);
  const [buyOpen, setBuyOpen] = useState(false);
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    setData(null);
    apiFetch(`/api/listing?id=${id}`)
      .then((d) => {
        setData(d);
        if (d?.listing) pushRecent(d.listing);
      })
      .catch((e) => setError(e.message));
    window.scrollTo(0, 0);
  }, [id]);

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <Package size={40} className="mx-auto text-stone-300" />
        <h2 className="mt-4 text-xl font-bold text-navy-900">Listing unavailable</h2>
        <p className="mt-1 text-stone-500 text-sm">{error}</p>
        <Link to="/browse" className="btn btn-navy mt-6">Browse other materials</Link>
      </div>
    );
  }
  if (!data) return <PageLoader label="Loading listing…" />;

  const { listing, seller, related, sellerActiveCount } = data;
  const images: string[] = Array.isArray(listing.images) && listing.images.length ? listing.images : [];
  const mine = profile?.id === listing.seller_id;
  const available = listing.status === 'ACTIVE';
  const maxQty = Number(listing.quantity);
  const total = Math.round(qty * Number(listing.price_per_unit) * 100) / 100;

  const startChat = async () => {
    if (!token) return navigate('/auth?redirect=' + encodeURIComponent(`/listing/${listing.id}`));
    setBusy(true);
    setActionError('');
    try {
      const convo = await apiFetch('/api/conversations', { method: 'POST', body: { listing_id: listing.id }, token });
      navigate(`/messages/${convo.id}`);
    } catch (e: any) {
      setActionError(e.message);
      setBusy(false);
    }
  };

  const toggleWatch = async () => {
    if (!token) return navigate('/auth?redirect=' + encodeURIComponent(`/listing/${listing.id}`));
    try {
      const d = await apiFetch('/api/watchlist', { method: 'POST', body: { listing_id: listing.id }, token });
      setSaved(d.saved);
    } catch (e: any) {
      setActionError(e.message);
    }
  };

  const placeOrder = async () => {
    setBusy(true);
    setActionError('');
    try {
      const txn = await apiFetch('/api/transactions', { method: 'POST', body: { listing_id: listing.id, quantity: qty }, token });
      navigate(`/checkout/${txn.id}`);
    } catch (e: any) {
      setActionError(e.message);
      setBusy(false);
    }
  };

  const specs = [
    { label: 'Condition', value: CONDITION_LABELS[listing.condition] || listing.condition, icon: BadgeCheck },
    { label: 'Available quantity', value: `${Number(listing.quantity).toLocaleString()} ${listing.unit}`, icon: Package },
    { label: 'Total lot value', value: formatETB(listing.total_price), icon: Tag },
    { label: 'Location', value: `${listing.city}${listing.region ? `, ${listing.region}` : ''}`, icon: MapPin },
    { label: 'Posted', value: `${timeAgo(listing.created_at)} (${fmtDate(listing.created_at)})`, icon: Calendar },
    { label: 'Views', value: String(listing.view_count ?? 0), icon: Eye },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-stone-500 hover:text-navy-800 transition-colors mb-5">
        <ArrowLeft size={15} /> Back to results
      </button>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Gallery */}
        <div>
          <div className="card overflow-hidden">
            <div className="relative aspect-[4/3] bg-stone-100">
              {images.length ? (
                <img src={images[imgIdx] || images[0]} alt={listing.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-navy-50 text-navy-200">
                  <Package size={80} />
                </div>
              )}
              <div className="absolute top-3 left-3 flex gap-2">
                {CONDITION_META[listing.condition] && <Chip meta={CONDITION_META[listing.condition]} className="!bg-white/95 shadow" />}
                {listing.featured && <span className="bg-gold-500 text-navy-900 rounded-full px-2.5 py-0.5 text-[11px] font-extrabold uppercase shadow">Featured</span>}
              </div>
              {listing.verification_status === 'VERIFIED' && (
                <div className="absolute top-3 right-3 bg-emerald-500 text-white rounded-full px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 shadow">
                  <ShieldCheck size={13} /> Agent Verified
                </div>
              )}
            </div>
            {images.length > 1 && (
              <div className="flex gap-2 p-3 overflow-x-auto no-scrollbar">
                {images.map((src, i) => (
                  <button key={i} onClick={() => setImgIdx(i)} className={`shrink-0 w-20 h-16 rounded-lg overflow-hidden border-2 transition-colors ${i === imgIdx ? 'border-gold-500' : 'border-transparent opacity-70 hover:opacity-100'}`}>
                    <img src={src} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="card mt-4 p-5">
            <h3 className="font-extrabold text-navy-900 mb-2">Description</h3>
            <p className="text-sm text-stone-600 leading-relaxed whitespace-pre-line">{listing.description}</p>
            {daysUntil(listing.expires_at) !== null && (
              <p className="mt-3 text-xs text-stone-400">Listing expires in {daysUntil(listing.expires_at)} days · {fmtDate(listing.expires_at)}</p>
            )}
          </div>
        </div>

        {/* Info */}
        <div>
          <div className="card p-6">
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-2xl font-extrabold text-navy-900 tracking-tight leading-snug">{listing.title}</h1>
              <button onClick={toggleWatch} className={`shrink-0 w-10 h-10 rounded-xl border flex items-center justify-center transition-colors ${saved ? 'bg-red-50 border-red-200 text-red-500' : 'border-stone-200 text-stone-400 hover:text-red-500 hover:border-red-200'}`} title="Save to watchlist">
                <Heart size={18} fill={saved ? 'currentColor' : 'none'} />
              </button>
            </div>

            <div className="mt-4 flex items-end gap-2">
              <span className="text-3xl font-extrabold text-navy-800">{formatETB(listing.price_per_unit)}</span>
              <span className="text-stone-500 font-medium mb-1">per {listing.unit}</span>
              {listing.is_negotiable && (
                <span className="mb-1 ml-1 inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 rounded-full px-2.5 py-1">
                  <HandCoins size={12} /> Negotiable
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-stone-500">
              Full lot: <span className="font-bold text-navy-800">{formatETB(listing.total_price)}</span> for {Number(listing.quantity).toLocaleString()} {listing.unit}
            </p>

            {actionError && <div className="mt-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{actionError}</div>}

            {available ? (
              mine ? (
                <div className="mt-6 bg-navy-50 border border-navy-100 rounded-xl p-4 text-sm text-navy-800 font-semibold">
                  This is your listing. Manage it from{' '}
                  <Link to="/dashboard?tab=my-listings" className="underline font-bold">My Listings</Link>.
                </div>
              ) : (
                <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button onClick={() => { if (!token) return navigate('/auth?redirect=' + encodeURIComponent(`/listing/${listing.id}`)); setQty(Math.min(1, maxQty)); setBuyOpen(true); }} className="btn btn-navy !py-3">
                    <ShoppingCart size={17} /> Buy with Escrow
                  </button>
                  <button onClick={startChat} disabled={busy} className="btn btn-outline !py-3">
                    <MessageSquare size={17} /> Message seller
                  </button>
                </div>
              )
            ) : (
              <div className="mt-6 bg-stone-100 rounded-xl p-4 text-sm font-bold text-stone-500 text-center">
                {listing.status === 'SOLD' ? 'This lot has been sold out' : `This listing is currently ${String(listing.status).replace('_', ' ').toLowerCase()}`}
              </div>
            )}

            <div className="mt-6 flex items-start gap-3 bg-gold-100/60 border border-gold-200 rounded-xl p-4">
              <ShieldCheck size={20} className="text-gold-700 shrink-0 mt-0.5" />
              <div className="text-xs leading-relaxed text-gold-700">
                <span className="font-extrabold">Escrow protected.</span> Your payment is held securely by SurplusSell and only released to the seller after you confirm the materials were delivered. Never pay sellers directly.
              </div>
            </div>
          </div>

          <div className="card mt-4 p-6">
            <h3 className="font-extrabold text-navy-900 mb-4">Specifications</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
              {specs.map((s) => (
                <div key={s.label} className="flex items-start gap-2.5">
                  <s.icon size={16} className="text-navy-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">{s.label}</p>
                    <p className="text-sm font-bold text-stone-700">{s.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Seller card */}
          {seller && (
            <div className="card mt-4 p-6">
              <div className="flex items-center gap-4">
                <Avatar name={seller.company_name || seller.full_name} size={52} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-extrabold text-navy-900 truncate">{seller.company_name || seller.full_name}</h3>
                    {seller.kyc_status === 'VERIFIED' && <VerifiedBadge small />}
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-stone-500">
                    <Stars value={seller.rating_avg} size={12} />
                    <span className="font-bold text-stone-600">{Number(seller.rating_avg || 0).toFixed(1)}</span>
                    <span>({seller.rating_count || 0} reviews)</span>
                    {seller.city && <>
                      <span className="text-stone-300">|</span>
                      <MapPin size={11} /> {seller.city}
                    </>}
                  </div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                <div className="bg-sand-50 rounded-xl py-2.5">
                  <p className="text-lg font-extrabold text-navy-800">{sellerActiveCount}</p>
                  <p className="text-[10px] font-semibold text-stone-400 uppercase">Active listings</p>
                </div>
                <div className="bg-sand-50 rounded-xl py-2.5">
                  <p className="text-lg font-extrabold text-navy-800">{seller.total_transactions || 0}</p>
                  <p className="text-[10px] font-semibold text-stone-400 uppercase">Orders done</p>
                </div>
                <div className="bg-sand-50 rounded-xl py-2.5">
                  <p className="text-lg font-extrabold text-navy-800">{new Date(seller.created_at || Date.now()).getFullYear()}</p>
                  <p className="text-[10px] font-semibold text-stone-400 uppercase">Member since</p>
                </div>
              </div>
              <Link to={`/seller/${seller.id}`} className="btn btn-outline w-full mt-4">
                View seller profile
              </Link>
            </div>
          )}

          <div className="card mt-4 p-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-navy-50 text-navy-700 flex items-center justify-center shrink-0">
              <Truck size={20} />
            </div>
            <div className="text-sm">
              <p className="font-bold text-navy-900">Pickup or arranged delivery</p>
              <p className="text-stone-500 text-xs mt-0.5">Materials are collected from the seller's yard in {listing.city}. Cross-city trucking can be coordinated in chat.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Related */}
      {related && related.length > 0 && (
        <div className="mt-14">
          <h2 className="text-xl font-extrabold text-navy-900 tracking-tight mb-5">Similar materials</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {related.map((r: any) => <ListingCard key={r.id} listing={{ ...r, images: r.images || (firstImage(r.images) ? [firstImage(r.images)] : []) }} />)}
          </div>
        </div>
      )}

      {/* Buy modal */}
      <Modal open={buyOpen} onClose={() => !busy && setBuyOpen(false)} title="Place purchase order">
        <div className="space-y-5">
          <div className="flex gap-3.5">
            {images[0] && <img src={images[0]} alt="" className="w-20 h-16 rounded-lg object-cover" />}
            <div>
              <p className="font-bold text-navy-900 text-sm leading-snug line-clamp-2">{listing.title}</p>
              <p className="text-xs text-stone-500 mt-1">{formatETB(listing.price_per_unit)} / {listing.unit}</p>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wide text-stone-400">Quantity ({listing.unit})</label>
            <div className="mt-2 flex items-center gap-3">
              <button onClick={() => setQty((v) => Math.max(1, Math.round((v - 1) * 1000) / 1000))} className="w-10 h-10 rounded-xl border border-stone-200 flex items-center justify-center hover:bg-stone-50">
                <Minus size={16} />
              </button>
              <input
                type="number"
                min={1}
                max={maxQty}
                step={1}
                value={qty}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (!Number.isNaN(v)) setQty(Math.min(Math.max(v, 1), maxQty));
                }}
                className="input !w-28 text-center !text-lg !font-extrabold"
              />
              <button onClick={() => setQty((v) => Math.min(maxQty, Math.round((v + 1) * 1000) / 1000))} className="w-10 h-10 rounded-xl border border-stone-200 flex items-center justify-center hover:bg-stone-50">
                <Plus size={16} />
              </button>
              <button onClick={() => setQty(maxQty)} className="text-xs font-bold text-navy-700 underline whitespace-nowrap">
                Take whole lot
              </button>
            </div>
            <p className="text-xs text-stone-400 mt-1.5">{maxQty.toLocaleString()} {listing.unit} available</p>
          </div>

          <div className="bg-sand-50 rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-stone-500">Subtotal</span><span className="font-bold">{formatETB(total)}</span></div>
            <div className="flex justify-between"><span className="text-stone-500">Platform commission (6%, min 200)</span><span className="font-bold">{formatETB(Math.max(Math.round(total * 0.06 * 100) / 100, total > 0 ? 200 : 0))}</span></div>
            <div className="border-t border-stone-200 pt-2 flex justify-between text-base">
              <span className="font-extrabold text-navy-900">You pay</span>
              <span className="font-extrabold text-navy-900">{formatETB(total)}</span>
            </div>
            <p className="text-[11px] text-stone-400 leading-relaxed">Commission is deducted from the seller's payout — you only pay the subtotal. Funds stay in escrow until you confirm delivery.</p>
          </div>

          <button onClick={placeOrder} disabled={busy} className="btn btn-navy w-full !py-3">
            {busy ? 'Placing order…' : 'Continue to secure payment'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
