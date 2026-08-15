import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, CheckCircle2, CreditCard, Download, Gavel, Package, Printer, ShoppingBag, Star, Store, Truck,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { apiFetch } from '../../lib/api';
import { ESCROW_STATUS_META, ROLE_LABELS, TXN_STATUS_META, TXN_STEPS } from '../../lib/constants';
import { fmtDateTime, firstImage, formatETB } from '../../lib/format';
import { Chip, EmptyState, Modal, PageLoader, Stars } from '../../components/ui';
import { DELIVERY_STATUS_META } from '../../lib/logistics';

function Timeline({ status }: { status: string }) {
  if (['CANCELLED', 'DISPUTED', 'REFUNDED'].includes(status)) return null;
  const idx = TXN_STEPS.indexOf(status);
  const labels = ['Ordered', 'Paid', 'Dispatched', 'Completed'];
  return (
    <div className="flex items-center gap-1.5 mt-3">
      {labels.map((l, i) => (
        <div key={l} className="flex items-center gap-1.5 flex-1 min-w-0">
          <div className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 ${i <= idx ? 'bg-emerald-500 text-white' : 'bg-stone-200 text-stone-400'}`}>
            {i < idx || (i === idx && status === 'COMPLETED') ? <CheckCircle2 size={13} /> : i + 1}
          </div>
          <span className={`text-[10px] font-bold truncate ${i <= idx ? 'text-emerald-700' : 'text-stone-400'}`}>{l}</span>
          {i < labels.length - 1 && <div className={`h-0.5 flex-1 rounded ${i < idx ? 'bg-emerald-400' : 'bg-stone-200'}`} />}
        </div>
      ))}
    </div>
  );
}

export default function OrdersPanel({ mode }: { mode: 'buy' | 'sell' }) {
  const { profile, token } = useAuth();
  const [txns, setTxns] = useState<any[] | null>(null);
  const [deliveries, setDeliveries] = useState<Record<string, any>>({});
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [disputeFor, setDisputeFor] = useState<any>(null);
  const [disputeReason, setDisputeReason] = useState('');
  const [rateFor, setRateFor] = useState<any>(null);
  const [stars, setStars] = useState(5);
  const [review, setReview] = useState('');
  const [ratedTxns, setRatedTxns] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const d = await apiFetch('/api/transactions', { token });
      setTxns(d || []);
      try {
        const jobs = await apiFetch('/api/deliveries', { token });
        const map: Record<string, any> = {};
        for (const j of jobs || []) if (j.transaction_id) map[j.transaction_id] = j;
        setDeliveries(map);
      } catch { /* not an agent concern */ }
    } catch (e: any) {
      setError(e.message);
      setTxns([]);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!token || !profile) return;
    apiFetch(`/api/ratings?user_id=${profile.id}`, { token }).catch(() => []);
  }, [token, profile]);

  const act = async (id: string, action: string, extra: Record<string, unknown> = {}) => {
    setBusyId(id + action);
    setError('');
    try {
      await apiFetch('/api/transactions', { method: 'PUT', body: { id, action, ...extra }, token });
      await load();
      return true;
    } catch (e: any) {
      setError(e.message);
      return false;
    } finally {
      setBusyId('');
    }
  };

  const submitRating = async () => {
    if (!rateFor) return;
    setBusyId(rateFor.id + 'rate');
    setError('');
    try {
      await apiFetch('/api/ratings', { method: 'POST', body: { transaction_id: rateFor.id, rating: stars, review }, token });
      setRatedTxns((s) => new Set(s).add(rateFor.id));
      setRateFor(null);
      setStars(5);
      setReview('');
    } catch (e: any) {
      setError(e.message);
      if (e.message.includes('already rated')) setRateFor(null);
    } finally {
      setBusyId('');
    }
  };

  if (!txns) return <PageLoader />;

  const myId = profile?.id;
  const mine = txns.filter((t) => (mode === 'buy' ? t.buyer_id === myId : t.seller_id === myId));
  const counterparty = (t: any) => (mode === 'buy' ? t.seller : t.buyer);

  const exportCSV = () => {
    const header = ['Order ID', 'Date', 'Listing', 'Counterparty', 'Qty', 'Unit price (ETB)', 'Total (ETB)', 'Commission (ETB)', 'Net (ETB)', 'Status', 'Delivery'];
    const rows = mine.map((t) => [
      t.id.slice(0, 8).toUpperCase(),
      fmtDateTime(t.created_at),
      (t.listing?.title || '').replace(/"/g, '""'),
      (counterparty(t)?.company_name || counterparty(t)?.full_name || '').replace(/"/g, '""'),
      t.quantity,
      t.unit_price,
      t.total_amount,
      t.commission_amount,
      t.net_amount,
      t.status,
      t.delivery_method,
    ]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c ?? '')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `surplussell-${mode === 'buy' ? 'orders' : 'sales'}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-xl font-extrabold text-navy-900">{mode === 'buy' ? 'My Orders' : 'Incoming Orders'}</h2>
          <p className="text-sm text-stone-500">
            {mode === 'buy' ? 'Track purchases, pay securely and confirm deliveries.' : 'Accept payments, dispatch materials and receive escrow payouts.'}
          </p>
        </div>
        <div className="flex gap-2">
          {mine.length > 0 && (
            <button onClick={exportCSV} className="btn btn-outline !py-2 text-xs">
              <Download size={14} /> Export CSV
            </button>
          )}
          {mode === 'buy' && <Link to="/browse" className="btn btn-navy !py-2 hidden sm:inline-flex">Browse materials</Link>}
        </div>
      </div>

      {error && <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3">{error}</div>}

      {mine.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={mode === 'buy' ? ShoppingBag : Store}
            title={mode === 'buy' ? 'No orders yet' : 'No incoming orders'}
            message={mode === 'buy' ? 'When you buy materials they will appear here with live escrow status.' : 'Share your listings — new purchase orders land here instantly.'}
            action={<Link to={mode === 'buy' ? '/browse' : '/dashboard?tab=my-listings'} className="btn btn-navy">{mode === 'buy' ? 'Browse materials' : 'My listings'}</Link>}
          />
        </div>
      ) : (
        <div className="space-y-4">
          {mine.map((t) => {
            const other = counterparty(t);
            const img = firstImage(t.listing?.images);
            const busy = (a: string) => busyId === t.id + a;
            return (
              <div key={t.id} className="card p-5">
                <div className="flex flex-wrap gap-4">
                  {img ? (
                    <img src={img} alt="" className="w-24 h-20 rounded-xl object-cover shrink-0" />
                  ) : (
                    <div className="w-24 h-20 rounded-xl bg-navy-50 flex items-center justify-center text-navy-300 shrink-0"><Package size={26} /></div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <Link to={`/listing/${t.listing_id}`} className="font-extrabold text-navy-900 hover:text-gold-600 transition-colors leading-snug">
                          {t.listing?.title || 'Listing removed'}
                        </Link>
                        <p className="text-xs text-stone-400 mt-0.5">
                          Order #{t.id.slice(0, 8).toUpperCase()} · {fmtDateTime(t.created_at)} · {mode === 'buy' ? 'Seller' : 'Buyer'}:{' '}
                          <span className="font-semibold text-stone-600">{other?.company_name || other?.full_name || 'Trader'}</span>
                          {other?.role && <span className="text-stone-300"> · {ROLE_LABELS[other.role] || ''}</span>}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {t.escrow && <Chip meta={ESCROW_STATUS_META[t.escrow.status] || { label: t.escrow.status, classes: 'bg-stone-200 text-stone-600' }} />}
                        <Chip meta={TXN_STATUS_META[t.status] || { label: t.status, classes: 'bg-stone-200 text-stone-600' }} />
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                      <span className="text-stone-500">Qty: <b className="text-navy-900">{Number(t.quantity).toLocaleString()} {t.listing?.unit || ''}</b></span>
                      <span className="text-stone-500">Unit price: <b className="text-navy-900">{formatETB(t.unit_price)}</b></span>
                      <span className="text-stone-500">Total: <b className="text-navy-900">{formatETB(t.total_amount)}</b></span>
                      {mode === 'sell' && ['PAID', 'DELIVERING', 'COMPLETED'].includes(t.status) && (
                        <span className="text-stone-500">You receive: <b className="text-emerald-700">{formatETB(t.net_amount)}</b></span>
                      )}
                    </div>
                    <Timeline status={t.status} />
                    {deliveries[t.id] && (
                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 bg-indigo-50/70 border border-indigo-100 rounded-lg px-3 py-2 text-xs">
                        <span className="inline-flex items-center gap-1.5 font-bold text-indigo-800">
                          <Truck size={13} />
                          {deliveries[t.id].pickup_city || '?'} → {deliveries[t.id].delivery_city || '?'}
                        </span>
                        <Chip meta={DELIVERY_STATUS_META[deliveries[t.id].status] || { label: deliveries[t.id].status, classes: 'bg-stone-200 text-stone-600' }} />
                        <span className="text-indigo-700 font-semibold">
                          Driver: {deliveries[t.id].agent?.company_name || 'awaiting assignment'}
                        </span>
                        <span className="text-indigo-600">Fee: <b>{formatETB(deliveries[t.id].fee)}</b> (cash on delivery)</span>
                      </div>
                    )}
                    {t.status === 'DISPUTED' && t.dispute_reason && (
                      <div className="mt-3 flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                        <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                        <span><b>Dispute reason:</b> {t.dispute_reason}. SurplusSell admins will resolve this case and either release or refund the escrow.</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-4 pt-4 border-t border-stone-100 flex flex-wrap gap-2">
                  {['PAID', 'DELIVERING', 'COMPLETED', 'DISPUTED', 'REFUNDED'].includes(t.status) && (
                    <Link to={`/receipt/${t.id}`} className="btn btn-ghost !py-2 text-xs">
                      <Printer size={13} /> Receipt
                    </Link>
                  )}
                  {mode === 'buy' && t.status === 'PAYMENT_PENDING' && (
                    <>
                      <Link to={`/checkout/${t.id}`} className="btn btn-navy !py-2 text-xs">
                        <CreditCard size={14} /> Pay {formatETB(t.total_amount)}
                      </Link>
                      <button onClick={() => act(t.id, 'cancel')} disabled={busy('cancel')} className="btn btn-ghost !py-2 text-xs text-red-600 hover:!bg-red-50">
                        {busy('cancel') ? 'Cancelling…' : 'Cancel order'}
                      </button>
                    </>
                  )}
                  {mode === 'sell' && t.status === 'PAYMENT_PENDING' && (
                    <span className="text-xs font-semibold text-amber-700 bg-amber-50 rounded-lg px-3 py-2 inline-flex items-center gap-1.5">
                      <CreditCard size={13} /> Waiting for buyer to pay into escrow
                    </span>
                  )}
                  {mode === 'sell' && t.status === 'PAID' && (
                    <>
                      <button onClick={() => act(t.id, 'ship')} disabled={busy('ship')} className="btn btn-navy !py-2 text-xs">
                        {busy('ship') ? 'Updating…' : <><Truck size={14} /> Mark as dispatched</>}
                      </button>
                      <button onClick={() => { setDisputeFor(t); setDisputeReason(''); }} className="btn btn-ghost !py-2 text-xs text-red-600 hover:!bg-red-50">
                        <Gavel size={13} /> Open dispute
                      </button>
                    </>
                  )}
                  {mode === 'buy' && t.status === 'PAID' && (
                    <span className="text-xs font-semibold text-sky-700 bg-sky-50 rounded-lg px-3 py-2 inline-flex items-center gap-1.5">
                      <Truck size={13} /> Payment secured — waiting for seller to dispatch. You can confirm delivery once received.
                    </span>
                  )}
                  {mode === 'buy' && t.status === 'DELIVERING' && (
                    <>
                      <button onClick={() => act(t.id, 'confirm_delivery')} disabled={busy('confirm')} className="btn btn-gold !py-2 text-xs">
                        {busy('confirm') ? 'Confirming…' : <><CheckCircle2 size={14} /> Confirm delivery & release escrow</>}
                      </button>
                      <button onClick={() => { setDisputeFor(t); setDisputeReason(''); }} className="btn btn-ghost !py-2 text-xs text-red-600 hover:!bg-red-50">
                        <Gavel size={13} /> Open dispute
                      </button>
                    </>
                  )}
                  {mode === 'sell' && t.status === 'DELIVERING' && (
                    <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 rounded-lg px-3 py-2 inline-flex items-center gap-1.5">
                      <Truck size={13} /> In transit — escrow releases when the buyer confirms receipt
                    </span>
                  )}
                  {t.status === 'COMPLETED' && !ratedTxns.has(t.id) && (
                    <button onClick={() => { setRateFor(t); setStars(5); setReview(''); }} className="btn btn-outline !py-2 text-xs">
                      <Star size={14} /> Rate this {mode === 'buy' ? 'seller' : 'buyer'}
                    </button>
                  )}
                  {t.status === 'COMPLETED' && ratedTxns.has(t.id) && (
                    <span className="text-xs font-semibold text-emerald-700 inline-flex items-center gap-1.5 px-3 py-2">
                      <CheckCircle2 size={13} /> Rating submitted
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dispute modal */}
      <Modal open={!!disputeFor} onClose={() => setDisputeFor(null)} title="Open a dispute">
        <p className="text-sm text-stone-500 leading-relaxed">
          Describe the problem with order <b>#{disputeFor?.id.slice(0, 8).toUpperCase()}</b>. The escrow will be frozen and an admin
          will review evidence from both parties, then either release or refund the funds.
        </p>
        <textarea
          value={disputeReason}
          onChange={(e) => setDisputeReason(e.target.value)}
          rows={4}
          className="input mt-4"
          placeholder="e.g. Delivered 80 bags instead of 100, several torn…"
        />
        <button
          onClick={async () => {
            if (!disputeReason.trim() || !disputeFor) return;
            const ok = await act(disputeFor.id, 'dispute', { reason: disputeReason });
            if (ok) setDisputeFor(null);
          }}
          disabled={!disputeReason.trim() || busyId.startsWith(disputeFor?.id || '')}
          className="btn btn-danger w-full mt-4"
        >
          Submit dispute
        </button>
      </Modal>

      {/* Rating modal */}
      <Modal open={!!rateFor} onClose={() => setRateFor(null)} title="Rate your trading partner">
        <p className="text-sm text-stone-500">
          How was your experience with <b>{(mode === 'buy' ? rateFor?.seller : rateFor?.buyer)?.company_name || 'this trader'}</b>? Ratings build marketplace trust.
        </p>
        <div className="flex items-center justify-center gap-2 my-6">
          {[1, 2, 3, 4, 5].map((s) => (
            <button key={s} onClick={() => setStars(s)} className="transition-transform hover:scale-110">
              <Star size={34} className={s <= stars ? 'text-gold-500' : 'text-stone-200'} fill="currentColor" strokeWidth={0} />
            </button>
          ))}
        </div>
        <div className="text-center mb-4"><Stars value={stars} size={16} /></div>
        <textarea
          value={review}
          onChange={(e) => setReview(e.target.value)}
          rows={3}
          className="input"
          placeholder="Optional: describe the communication, material accuracy, delivery…"
        />
        <button onClick={submitRating} disabled={busyId === rateFor?.id + 'rate'} className="btn btn-navy w-full mt-4">
          {busyId === rateFor?.id + 'rate' ? 'Submitting…' : 'Submit rating'}
        </button>
      </Modal>
    </div>
  );
}
