import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Printer, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiFetch } from '../lib/api';
import { ESCROW_STATUS_META, TXN_STATUS_META } from '../lib/constants';
import { fmtDateTime, firstImage, formatETB } from '../lib/format';
import Logo from '../components/Logo';
import { Chip, PageLoader } from '../components/ui';
import { DELIVERY_STATUS_META } from '../lib/logistics';

const DELIVERY_LABELS: Record<string, string> = {
  PICKUP: 'Self pickup at seller yard',
  SELF_ARRANGED: 'Self-arranged transport',
  DELIVERY_AGENT: 'SurplusSell delivery agent',
};

export default function Receipt() {
  const { transactionId } = useParams();
  const navigate = useNavigate();
  const { profile, token, loading } = useAuth();
  const [txn, setTxn] = useState<any>(null);
  const [job, setJob] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (loading) return;
    if (!token) {
      navigate('/auth?redirect=' + encodeURIComponent(`/receipt/${transactionId}`));
      return;
    }
    apiFetch(`/api/transactions?id=${transactionId}`, { token })
      .then(async (t) => {
        setTxn(t);
        try {
          const jobs = await apiFetch('/api/deliveries', { token });
          setJob((jobs || []).find((j: any) => j.transaction_id === t.id) || null);
        } catch { /* no delivery job */ }
      })
      .catch((e) => setError(e.message));
  }, [token, loading, transactionId, navigate]);

  if (loading || (!txn && !error)) return <PageLoader label="Loading receipt…" />;

  if (error || !txn) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <h2 className="text-xl font-bold text-navy-900">Receipt unavailable</h2>
        <p className="mt-1 text-stone-500 text-sm">{error || 'Order not found.'}</p>
        <Link to="/dashboard?tab=orders" className="btn btn-navy mt-6">Back to orders</Link>
      </div>
    );
  }

  const payable = ['PAID', 'DELIVERING', 'DELIVERED', 'COMPLETED', 'DISPUTED', 'REFUNDED'].includes(txn.status);
  const img = firstImage(txn.listing?.images);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="no-print flex items-center justify-between mb-6">
        <Link to="/dashboard?tab=orders" className="inline-flex items-center gap-1.5 text-sm font-semibold text-stone-500 hover:text-navy-800">
          <ArrowLeft size={15} /> My orders
        </Link>
        <button onClick={() => window.print()} className="btn btn-navy">
          <Printer size={16} /> Print / Save PDF
        </button>
      </div>

      {!payable && (
        <div className="no-print mb-4 text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-4 py-3">
          This order has not been paid yet — the receipt becomes final once payment lands in escrow.
        </div>
      )}

      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        {/* Letterhead */}
        <div className="bg-navy-900 text-white px-8 py-6 flex items-center justify-between">
          <Logo size={32} light />
          <div className="text-right">
            <p className="text-gold-400 font-extrabold tracking-widest text-sm uppercase">Sales Receipt</p>
            <p className="text-navy-200 text-xs mt-1 font-mono">#{txn.id.slice(0, 8).toUpperCase()}</p>
          </div>
        </div>

        <div className="px-8 py-7">
          {/* Parties */}
          <div className="grid sm:grid-cols-3 gap-6 pb-6 border-b border-stone-100">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-stone-400 mb-1.5">Seller</p>
              <p className="font-bold text-navy-900 text-sm">{txn.seller?.company_name || txn.seller?.full_name || '—'}</p>
              <p className="text-xs text-stone-500 mt-0.5">{txn.listing?.city || ''}</p>
            </div>
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-stone-400 mb-1.5">Buyer</p>
              <p className="font-bold text-navy-900 text-sm">{txn.buyer?.company_name || txn.buyer?.full_name || '—'}</p>
              <p className="text-xs text-stone-500 mt-0.5">{profile?.email || ''}</p>
            </div>
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-stone-400 mb-1.5">Order date</p>
              <p className="font-bold text-navy-900 text-sm">{fmtDateTime(txn.created_at)}</p>
              <div className="mt-1.5"><Chip meta={TXN_STATUS_META[txn.status] || { label: txn.status, classes: 'bg-stone-200 text-stone-600' }} /></div>
            </div>
          </div>

          {/* Line items */}
          <table className="w-full mt-6 text-sm">
            <thead>
              <tr className="text-left border-b-2 border-navy-800">
                <th className="py-2.5 text-[10px] font-extrabold uppercase tracking-widest text-stone-400">Item</th>
                <th className="py-2.5 text-[10px] font-extrabold uppercase tracking-widest text-stone-400 text-right">Qty</th>
                <th className="py-2.5 text-[10px] font-extrabold uppercase tracking-widest text-stone-400 text-right">Unit price</th>
                <th className="py-2.5 text-[10px] font-extrabold uppercase tracking-widest text-stone-400 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-stone-100">
                <td className="py-4">
                  <div className="flex items-center gap-3">
                    {img && <img src={img} alt="" className="w-12 h-10 rounded-lg object-cover" />}
                    <div>
                      <p className="font-bold text-navy-900 leading-snug">{txn.listing?.title || 'Construction materials'}</p>
                      <p className="text-xs text-stone-400 mt-0.5">Surplus building materials · escrow trade</p>
                    </div>
                  </div>
                </td>
                <td className="py-4 text-right font-semibold">{Number(txn.quantity).toLocaleString()} {txn.listing?.unit || ''}</td>
                <td className="py-4 text-right font-semibold">{formatETB(txn.unit_price)}</td>
                <td className="py-4 text-right font-extrabold text-navy-900">{formatETB(txn.total_amount)}</td>
              </tr>
              <tr className="border-b border-stone-100">
                <td className="py-3.5">
                  <p className="font-semibold text-stone-600 text-sm">Delivery</p>
                  <p className="text-xs text-stone-400 mt-0.5">{DELIVERY_LABELS[txn.delivery_method] || txn.delivery_method}{job ? ` \u00b7 ${job.pickup_city || '?'} \u2192 ${job.delivery_city || '?'}` : ''}</p>
                </td>
                <td className="py-3.5" />
                <td className="py-3.5" />
                <td className="py-3.5 text-right font-semibold text-stone-600">
                  {job ? `${formatETB(job.fee)}` : txn.delivery_method === 'DELIVERY_AGENT' ? 'quoted' : 'Free'}
                  {job && <span className="block text-[10px] text-stone-400 font-normal">paid to driver, cash on delivery</span>}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Totals */}
          <div className="flex justify-end mt-5">
            <div className="w-72 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-stone-500">Materials subtotal</span>
                <span className="font-bold">{formatETB(txn.total_amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Payment method</span>
                <span className="font-bold">Telebirr (mock)</span>
              </div>
              {txn.payment?.gateway_reference && (
                <div className="flex justify-between">
                  <span className="text-stone-500">Gateway reference</span>
                  <span className="font-mono text-xs font-bold">{txn.payment.gateway_reference}</span>
                </div>
              )}
              <div className="border-t-2 border-navy-800 pt-2.5 flex justify-between text-base">
                <span className="font-extrabold text-navy-900">Total paid</span>
                <span className="font-extrabold text-navy-900">{formatETB(txn.total_amount)}</span>
              </div>
            </div>
          </div>

          {/* Escrow box */}
          {txn.escrow && (
            <div className="mt-8 bg-navy-50 border border-navy-100 rounded-xl p-5">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-navy-400 mb-3 flex items-center gap-1.5">
                <ShieldCheck size={13} /> Escrow settlement record
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-[11px] text-stone-400">Escrow amount</p>
                  <p className="font-extrabold text-navy-800">{formatETB(txn.escrow.amount)}</p>
                </div>
                <div>
                  <p className="text-[11px] text-stone-400">Commission (6%)</p>
                  <p className="font-extrabold text-navy-800">{formatETB(txn.escrow.commission_amount)}</p>
                </div>
                <div>
                  <p className="text-[11px] text-stone-400">Seller payout</p>
                  <p className="font-extrabold text-emerald-700">{formatETB(txn.escrow.net_amount)}</p>
                </div>
                <div>
                  <p className="text-[11px] text-stone-400">Escrow status</p>
                  <Chip meta={ESCROW_STATUS_META[txn.escrow.status] || { label: txn.escrow.status, classes: 'bg-stone-200 text-stone-600' }} className="mt-0.5" />
                </div>
              </div>
            </div>
          )}

          {job && (
            <div className="mt-4 bg-sand-50 border border-stone-200 rounded-xl p-5 text-sm">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-stone-400 mb-2">Delivery record</p>
              <div className="flex flex-wrap gap-x-8 gap-y-2">
                <span><b>Route:</b> {job.pickup_city || '?'} → {job.delivery_city || '?'}</span>
                <span><b>Distance:</b> {Number(job.distance_km || 0).toLocaleString()} km</span>
                <span><b>Fee:</b> {formatETB(job.fee)}</span>
                <span><b>Driver:</b> {job.agent?.company_name || job.agent?.full_name || 'awaiting assignment'}</span>
                <Chip meta={DELIVERY_STATUS_META[job.status] || { label: job.status, classes: 'bg-stone-200 text-stone-600' }} />
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="mt-10 pt-5 border-t border-stone-100 flex flex-col sm:flex-row justify-between gap-3 text-[11px] text-stone-400 leading-relaxed">
            <div>
              <p className="font-bold text-stone-500">SurplusSell PLC</p>
              <p>Bole Sub-City, Woreda 03, Addis Ababa, Ethiopia · support@surplussell.et</p>
              <p>Escrow receipts are generated electronically and valid without signature.</p>
            </div>
            <p className="text-right shrink-0">Printed {fmtDateTime(new Date().toISOString())}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
