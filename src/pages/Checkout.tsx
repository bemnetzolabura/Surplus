import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, CheckCircle2, Lock, PackageOpen, PartyPopper, Phone, QrCode, ShieldCheck, Smartphone, Truck, Wallet,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiFetch } from '../lib/api';
import { CITIES, TXN_STATUS_META } from '../lib/constants';
import { fmtDateTime, firstImage, formatETB } from '../lib/format';
import { Chip, PageLoader, Spinner } from '../components/ui';
import { deliveryFeeETB, distanceKm } from '../lib/logistics';

function MockQR({ seed }: { seed: string }) {
  const cells = useMemo(() => {
    let h = 2166136261;
    const rand = () => {
      h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
      return Math.abs(h) % 1000 / 1000;
    };
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
    const grid: boolean[] = [];
    for (let i = 0; i < 21 * 21; i++) grid.push(rand() > 0.52);
    const finder = (r: number, c: number) => (r < 7 && c < 7) || (r < 7 && c >= 14) || (r >= 14 && c < 7);
    for (let i = 0; i < 21 * 21; i++) {
      const r = Math.floor(i / 21), c = i % 21;
      if (finder(r, c)) {
        const inSquare = (rr: number, cc: number) => {
          const lr = r - (r < 7 ? 0 : 14), lc = c - (c < 7 ? 0 : 14);
          return lr === rr || lr === 6 - rr || lc === cc || lc === 6 - cc;
        };
        grid[i] = inSquare(0, 0) || (r % 6 >= 2 && r % 6 <= 4 && c % 6 >= 2 && c % 6 <= 4 && finder(r, c) && r < 14 ? true : grid[i]);
        const lr = r >= 14 ? r - 14 : r;
        const lc = c >= 14 ? c - 14 : c;
        grid[i] = lr === 0 || lr === 6 || lc === 0 || lc === 6 || (lr >= 2 && lr <= 4 && lc >= 2 && lc <= 4);
      }
    }
    return grid;
  }, [seed]);
  return (
    <svg viewBox="0 0 21 21" className="w-full h-full" shapeRendering="crispEdges">
      <rect width="21" height="21" fill="white" />
      {cells.map((on, i) => on ? <rect key={i} x={i % 21} y={Math.floor(i / 21)} width="1" height="1" fill="#0D1D31" /> : null)}
    </svg>
  );
}

export default function Checkout() {
  const { transactionId } = useParams();
  const navigate = useNavigate();
  const { profile, token, loading: authLoading } = useAuth();
  const [txn, setTxn] = useState<any>(null);
  const [error, setError] = useState('');
  const [payment, setPayment] = useState<any>(null);
  const [phase, setPhase] = useState<'review' | 'awaiting' | 'done'>('review');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [method, setMethod] = useState<'PICKUP' | 'DELIVERY_AGENT'>('PICKUP');
  const [destCity, setDestCity] = useState('Addis Ababa');
  const [addrLine, setAddrLine] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!token) {
      navigate('/auth?redirect=' + encodeURIComponent(`/checkout/${transactionId}`));
      return;
    }
    apiFetch(`/api/transactions?id=${transactionId}`, { token })
      .then((t) => {
        setTxn(t);
        if (t.delivery_method === 'DELIVERY_AGENT') setMethod('DELIVERY_AGENT');
        if (t.status === 'PAID' || t.status === 'DELIVERING' || t.status === 'COMPLETED') setPhase('done');
      })
      .catch((e) => setError(e.message));
  }, [token, authLoading, transactionId, navigate]);

  const initiate = async () => {
    if (!phone.trim()) {
      setError('Enter the Telebirr phone number to debit.');
      return;
    }
    if (method === 'DELIVERY_AGENT' && !addrLine.trim()) {
      setError('Enter the delivery address for the driver.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      // Lock in the delivery choice before initiating payment
      await apiFetch('/api/transactions', {
        method: 'PUT',
        body: {
          id: transactionId,
          action: 'set_delivery',
          delivery_method: method,
          delivery_city: method === 'DELIVERY_AGENT' ? destCity : null,
          delivery_address_line: method === 'DELIVERY_AGENT' ? addrLine.trim() : null,
        },
        token,
      });
      const p = await apiFetch('/api/payments', { method: 'POST', body: { transaction_id: transactionId }, token });
      setPayment(p);
      setPhase('awaiting');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    setBusy(true);
    setError('');
    try {
      const d = await apiFetch('/api/payments', { method: 'PUT', body: { payment_id: payment.id }, token });
      setPayment(d.payment);
      setTxn((t: any) => ({ ...t, status: 'PAID', escrow: d.escrow }));
      setPhase('done');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (authLoading || (!txn && !error)) return <PageLoader label="Preparing secure checkout…" />;

  if (error && !txn) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <h2 className="text-xl font-bold text-navy-900">Checkout unavailable</h2>
        <p className="mt-1 text-stone-500 text-sm">{error}</p>
        <Link to="/browse" className="btn btn-navy mt-6">Back to marketplace</Link>
      </div>
    );
  }

  const listing = txn.listing;
  const img = firstImage(listing?.images);
  const escrow = txn.escrow;
  const km = distanceKm(listing?.city, destCity);
  const deliveryFee = method === 'DELIVERY_AGENT' ? deliveryFeeETB(km) : 0;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <Link to="/dashboard?tab=orders" className="inline-flex items-center gap-1.5 text-sm font-semibold text-stone-500 hover:text-navy-800 mb-5">
        <ArrowLeft size={15} /> My orders
      </Link>

      <div className="grid lg:grid-cols-5 gap-6 items-start">
        {/* Payment flow */}
        <div className="lg:col-span-3">
          {phase === 'done' ? (
            <motion.div initial={{ scale: 0.94, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', damping: 18 }} className="card p-8 text-center">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.15, type: 'spring', damping: 12 }} className="w-20 h-20 mx-auto rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                {txn.status === 'PAID' ? <PartyPopper size={36} /> : <CheckCircle2 size={36} />}
              </motion.div>
              <h1 className="mt-5 text-2xl font-extrabold text-navy-900">
                {txn.status === 'PAID' ? 'Payment secured in escrow!' : `Order ${String(txn.status).replace('_', ' ').toLowerCase()}`}
              </h1>
              <p className="mt-2 text-sm text-stone-500 max-w-md mx-auto leading-relaxed">
                {txn.status === 'PAID'
                  ? 'Your money is held safely by SurplusSell. The seller has been notified to dispatch the materials — funds release only after you confirm delivery.'
                  : 'Track this order from your dashboard.'}
              </p>
              {escrow && (
                <div className="mt-6 bg-navy-50 border border-navy-100 rounded-2xl p-5 text-left max-w-sm mx-auto space-y-2.5 text-sm">
                  <div className="flex justify-between"><span className="text-stone-500">Escrow amount</span><span className="font-bold text-navy-900">{formatETB(escrow.amount)}</span></div>
                  <div className="flex justify-between"><span className="text-stone-500">Platform commission</span><span className="font-bold">{formatETB(escrow.commission_amount)}</span></div>
                  <div className="flex justify-between"><span className="text-stone-500">Seller receives</span><span className="font-extrabold text-emerald-700">{formatETB(escrow.net_amount)}</span></div>
                  <div className="flex justify-between"><span className="text-stone-500">Escrow status</span><Chip meta={{ label: escrow.status, classes: 'bg-sky-100 text-sky-800' }} /></div>
                </div>
              )}
              <div className="mt-7 flex flex-wrap justify-center gap-3">
                <Link to="/dashboard?tab=orders" className="btn btn-navy">Track my order</Link>
                <Link to="/browse" className="btn btn-outline">Continue shopping</Link>
              </div>
            </motion.div>
          ) : (
            <div className="card p-6 sm:p-8">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-[#5B2C8E]/10 text-[#5B2C8E] flex items-center justify-center">
                  <Smartphone size={22} />
                </div>
                <div>
                  <h1 className="text-xl font-extrabold text-navy-900">Telebirr secure payment</h1>
                  <p className="text-xs text-stone-500 font-semibold">MOCK GATEWAY — sandbox simulation, no real money moves</p>
                </div>
                <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 rounded-full px-2.5 py-1">
                  <Lock size={11} /> Escrow on
                </span>
              </div>

              {phase === 'review' && (
                <div className="mt-7 space-y-5">
                  <div>
                    <label className="text-xs font-bold text-stone-500 mb-2 block">Fulfillment method</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setMethod('PICKUP')}
                        className={`rounded-xl border-2 p-4 text-left transition-all ${method === 'PICKUP' ? 'border-navy-800 bg-navy-50' : 'border-stone-200 hover:border-stone-300'}`}
                      >
                        <PackageOpen size={19} className={method === 'PICKUP' ? 'text-navy-700' : 'text-stone-400'} />
                        <p className="mt-2 text-sm font-bold text-navy-900">Self pickup</p>
                        <p className="text-[11px] text-stone-500 mt-0.5 leading-relaxed">Collect from seller yard in {listing?.city}. Free.</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => setMethod('DELIVERY_AGENT')}
                        className={`rounded-xl border-2 p-4 text-left transition-all ${method === 'DELIVERY_AGENT' ? 'border-gold-500 bg-gold-100/40' : 'border-stone-200 hover:border-stone-300'}`}
                      >
                        <Truck size={19} className={method === 'DELIVERY_AGENT' ? 'text-gold-600' : 'text-stone-400'} />
                        <p className="mt-2 text-sm font-bold text-navy-900">Hire delivery agent</p>
                        <p className="text-[11px] text-stone-500 mt-0.5 leading-relaxed">
                          {method === 'DELIVERY_AGENT'
                            ? `${km.toLocaleString()} km route · ${formatETB(deliveryFee)} paid to driver on delivery`
                            : 'A verified driver hauls it to your site.'}
                        </p>
                      </button>
                    </div>
                    {method === 'DELIVERY_AGENT' && (
                      <div className="mt-3 grid sm:grid-cols-[160px_1fr] gap-3 bg-gold-100/40 border border-gold-200 rounded-xl p-3.5">
                        <select value={destCity} onChange={(e) => setDestCity(e.target.value)} className="input !py-2.5">
                          {CITIES.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
                        </select>
                        <input value={addrLine} onChange={(e) => setAddrLine(e.target.value)} placeholder="Site address, e.g. Meskel Flower project, Leghar" className="input !py-2.5" />
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-bold text-stone-500 mb-1.5 block">Telebirr phone number</label>
                    <div className="relative">
                      <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                      <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+251 9…" className="input !pl-9 !py-3" />
                    </div>
                  </div>
                  <div className="bg-sand-50 rounded-xl p-4 text-xs text-stone-500 leading-relaxed flex items-start gap-2.5">
                    <QrCode size={16} className="shrink-0 text-navy-600 mt-0.5" />
                    On the real gateway you would scan the merchant QR inside the Telebirr app. In this sandbox, confirming below simulates a successful mobile-money authorization.
                  </div>
                  {error && <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3.5 py-2.5">{error}</div>}
                  <button onClick={initiate} disabled={busy} className="btn btn-navy w-full !py-3.5 !text-base">
                    {busy ? <Spinner size={18} /> : <><Wallet size={17} /> Pay {formatETB(txn.total_amount)}</>}
                  </button>
                </div>
              )}

              {phase === 'awaiting' && payment && (
                <div className="mt-7">
                  <div className="bg-navy-950 rounded-2xl p-6 text-white text-center">
                    <p className="text-xs font-bold uppercase tracking-widest text-navy-300">Scan with Telebirr (mock)</p>
                    <div className="w-44 h-44 mx-auto mt-4 bg-white rounded-xl p-2.5">
                      <MockQR seed={payment.gateway_reference || payment.id} />
                    </div>
                    <p className="mt-4 text-lg font-extrabold text-gold-400">{formatETB(payment.amount)}</p>
                    <p className="mt-1 text-xs text-navy-200">Reference: <span className="font-mono font-bold text-white">{payment.gateway_reference}</span></p>
                  </div>
                  <div className="mt-5 flex items-center gap-3 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-sm text-amber-800">
                    <Spinner size={15} />
                    Waiting for gateway confirmation… sandbox payments auto-confirm below.
                  </div>
                  {error && <div className="mt-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3.5 py-2.5">{error}</div>}
                  <button onClick={confirm} disabled={busy} className="btn btn-gold w-full !py-3.5 !text-base mt-4">
                    {busy ? <Spinner size={18} /> : 'Confirm payment (simulate gateway success)'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Order summary */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card p-5">
            <h3 className="font-extrabold text-navy-900 mb-4">Order summary</h3>
            <div className="flex gap-3.5">
              {img ? <img src={img} alt="" className="w-20 h-16 rounded-lg object-cover" /> : <div className="w-20 h-16 rounded-lg bg-navy-50" />}
              <div className="min-w-0">
                <p className="font-bold text-sm text-navy-900 leading-snug line-clamp-2">{listing?.title}</p>
                <p className="text-xs text-stone-500 mt-1">{Number(txn.quantity).toLocaleString()} {listing?.unit || txn.unit} × {formatETB(txn.unit_price)}</p>
                <Chip meta={TXN_STATUS_META[txn.status] || { label: txn.status, classes: 'bg-stone-200 text-stone-600' }} className="mt-1.5" />
              </div>
            </div>
            <div className="mt-5 space-y-2.5 text-sm border-t border-stone-100 pt-4">
              <div className="flex justify-between"><span className="text-stone-500">Subtotal</span><span className="font-bold">{formatETB(txn.total_amount)}</span></div>
              <div className="flex justify-between">
                <span className="text-stone-500">Delivery</span>
                <span className="font-bold text-emerald-700">
                  {method === 'DELIVERY_AGENT'
                    ? `${formatETB(deliveryFee)} (paid to driver)`
                    : 'Pickup (free)'}
                </span>
              </div>
              {method === 'DELIVERY_AGENT' && (
                <p className="text-[11px] text-stone-400 leading-relaxed">
                  {km.toLocaleString()} km · {listing?.city} → {destCity}. The driver fee is cash-on-delivery — only materials go through escrow.
                </p>
              )}
              <div className="flex justify-between border-t border-stone-100 pt-2.5 text-base">
                <span className="font-extrabold text-navy-900">Pay now</span>
                <span className="font-extrabold text-navy-900">{formatETB(txn.total_amount)}</span>
              </div>
            </div>
            <div className="mt-4 border-t border-stone-100 pt-4 space-y-1.5 text-xs text-stone-500">
              <p><span className="font-bold text-stone-600">Order ID:</span> <span className="font-mono">{txn.id?.slice(0, 8).toUpperCase()}</span></p>
              <p><span className="font-bold text-stone-600">Placed:</span> {fmtDateTime(txn.created_at)}</p>
              <p><span className="font-bold text-stone-600">Seller:</span> {txn.seller?.company_name || txn.seller?.full_name}</p>
              {profile && <p><span className="font-bold text-stone-600">Buyer:</span> {profile.company_name || profile.full_name}</p>}
            </div>
          </div>

          <div className="card p-5 flex items-start gap-3.5">
            <ShieldCheck size={22} className="text-gold-600 shrink-0 mt-0.5" />
            <div className="text-xs text-stone-500 leading-relaxed">
              <p className="font-extrabold text-navy-900 text-sm mb-1">Your money is protected</p>
              Funds sit in SurplusSell escrow (max 7 days). If the seller never delivers, you get a full refund automatically. Commission (6%, min 200 ETB) is paid by the seller.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
