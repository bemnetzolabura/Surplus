import { useCallback, useEffect, useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, Gavel, Hourglass, ShieldCheck, Wallet } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { apiFetch } from '../../lib/api';
import { ESCROW_STATUS_META } from '../../lib/constants';
import { compactETB, daysUntil, fmtDate, firstImage, formatETB } from '../../lib/format';
import { Chip, EmptyState, Modal, PageLoader } from '../../components/ui';

export default function EscrowPanel() {
  const { profile, token } = useAuth();
  const [escrows, setEscrows] = useState<any[] | null>(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [confirm, setConfirm] = useState<{ escrow: any; action: 'release' | 'refund' } | null>(null);

  const isAdmin = profile?.role === 'ADMIN' || profile?.role === 'SUPER_ADMIN';
  const myId = profile?.id;

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const d = await apiFetch('/api/escrows', { token });
      setEscrows(d || []);
    } catch (e: any) {
      setError(e.message);
      setEscrows([]);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const resolve = async () => {
    if (!confirm) return;
    setBusyId(confirm.escrow.id);
    setError('');
    try {
      await apiFetch('/api/escrows', { method: 'PUT', body: { escrow_id: confirm.escrow.id, action: confirm.action }, token });
      setConfirm(null);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusyId('');
    }
  };

  if (!escrows) return <PageLoader />;

  const held = escrows.filter((e) => ['HELD', 'PENDING'].includes(e.status));
  const disputed = escrows.filter((e) => e.status === 'DISPUTED');
  const released = escrows.filter((e) => e.status === 'RELEASED');
  const myReleasedNet = released
    .filter((e) => e.transaction?.seller_id === myId)
    .reduce((s, e) => s + Number(e.net_amount || 0), 0);

  const cards = isAdmin
    ? [
        { icon: Hourglass, label: 'Currently held', value: compactETB(held.reduce((s, e) => s + Number(e.amount || 0), 0)), sub: `${held.length} escrow(s)` },
        { icon: Gavel, label: 'Disputed funds', value: compactETB(disputed.reduce((s, e) => s + Number(e.amount || 0), 0)), sub: `${disputed.length} case(s) to resolve`, accent: true },
        { icon: Wallet, label: 'Released (all-time)', value: compactETB(released.reduce((s, e) => s + Number(e.net_amount || 0), 0)), sub: 'net to sellers' },
        { icon: ShieldCheck, label: 'Total escrows', value: String(escrows.length), sub: 'platform-wide' },
      ]
    : [
        { icon: Hourglass, label: 'Held in escrow', value: compactETB(held.reduce((s, e) => s + Number(e.amount || 0), 0)), sub: `${held.length} active order(s)` },
        { icon: Gavel, label: 'Disputed', value: compactETB(disputed.reduce((s, e) => s + Number(e.amount || 0), 0)), sub: `${disputed.length} case(s)`, accent: disputed.length > 0 },
        { icon: Wallet, label: 'Released to me', value: compactETB(myReleasedNet), sub: 'net of commission' },
        { icon: ShieldCheck, label: 'Total escrows', value: String(escrows.length), sub: 'as buyer & seller' },
      ];

  return (
    <div>
      <h2 className="text-xl font-extrabold text-navy-900">{isAdmin ? 'Escrow Operations' : 'Escrow Status'}</h2>
      <p className="text-sm text-stone-500 mb-5">
        {isAdmin ? 'Release or refund held funds. All actions are logged (4-eyes principle in production).' : 'Your money sits safely here until deliveries are confirmed.'}
      </p>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {cards.map((c) => (
          <div key={c.label} className="card p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wide text-stone-400">{c.label}</span>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${c.accent ? 'bg-red-50 text-red-500' : 'bg-navy-50 text-navy-700'}`}>
                <c.icon size={17} />
              </div>
            </div>
            <p className="mt-2 text-2xl font-extrabold text-navy-900">{c.value}</p>
            <p className="text-xs text-stone-400 mt-0.5">{c.sub}</p>
          </div>
        ))}
      </div>

      {error && <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3">{error}</div>}

      {escrows.length === 0 ? (
        <div className="card">
          <EmptyState icon={ShieldCheck} title="No escrow activity" message="Escrows appear here automatically when payments are made into the protected pool." />
        </div>
      ) : (
        <div className="space-y-3">
          {escrows.map((e) => {
            const t = e.transaction;
            const img = firstImage(t?.listing?.images);
            const iAmSeller = t?.seller_id === myId;
            const days = daysUntil(e.hold_until);
            return (
              <div key={e.id} className="card p-4 sm:p-5">
                <div className="flex flex-wrap gap-4 items-start">
                  {img ? <img src={img} alt="" className="w-20 h-16 rounded-xl object-cover shrink-0" /> : <div className="w-20 h-16 rounded-xl bg-navy-50 shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2 flex-wrap">
                      <p className="font-extrabold text-navy-900 leading-snug">{t?.listing?.title || 'Order'} </p>
                      <Chip meta={ESCROW_STATUS_META[e.status] || { label: e.status, classes: 'bg-stone-200 text-stone-600' }} />
                    </div>
                    <p className="text-xs text-stone-400 mt-1">
                      Buyer: <b className="text-stone-600">{t?.buyer?.company_name || t?.buyer?.full_name || '—'}</b>
                      {' · '}Seller: <b className="text-stone-600">{t?.seller?.company_name || t?.seller?.full_name || '—'}</b>
                      {' · '}{fmtDate(e.created_at)}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                      <span className="text-stone-500">Escrow: <b className="text-navy-900">{formatETB(e.amount)}</b></span>
                      <span className="text-stone-500">Commission: <b className="text-navy-900">{formatETB(e.commission_amount)}</b></span>
                      <span className="text-stone-500">Seller net: <b className="text-emerald-700">{formatETB(e.net_amount)}</b></span>
                      {['HELD', 'PENDING'].includes(e.status) && days !== null && (
                        <span className="inline-flex items-center gap-1 text-stone-500">
                          <Hourglass size={13} /> {days > 0 ? `${days} days to auto-release window` : 'release window reached'}
                        </span>
                      )}
                      {e.released_at && <span className="text-stone-500">Released: {fmtDate(e.released_at)}</span>}
                    </div>
                  </div>
                  {!isAdmin && ['HELD', 'PENDING'].includes(e.status) && (
                    <div className={`shrink-0 inline-flex items-center gap-1.5 text-xs font-bold rounded-lg px-3 py-2 ${iAmSeller ? 'bg-sky-50 text-sky-700' : 'bg-emerald-50 text-emerald-700'}`}>
                      {iAmSeller ? <ArrowUpFromLine size={13} /> : <ArrowDownToLine size={13} />}
                      {iAmSeller ? 'Incoming after delivery' : 'Your funds are safe'}
                    </div>
                  )}
                  {isAdmin && ['HELD', 'DISPUTED', 'PENDING'].includes(e.status) && (
                    <div className="shrink-0 flex gap-2">
                      <button onClick={() => setConfirm({ escrow: e, action: 'release' })} className="btn btn-navy !py-2 !px-3 text-xs">
                        Release to seller
                      </button>
                      <button onClick={() => setConfirm({ escrow: e, action: 'refund' })} className="btn btn-outline !py-2 !px-3 text-xs !text-violet-700 !border-violet-200 hover:!bg-violet-50">
                        Refund buyer
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Admin confirm modal */}
      <Modal open={!!confirm} onClose={() => setConfirm(null)} title={confirm?.action === 'release' ? 'Release escrow to seller' : 'Refund escrow to buyer'}>
        {confirm && (
          <div className="space-y-4">
            <div className="bg-sand-50 rounded-xl p-4 text-sm space-y-2">
              <div className="flex justify-between"><span className="text-stone-500">Escrow amount</span><b>{formatETB(confirm.escrow.amount)}</b></div>
              <div className="flex justify-between"><span className="text-stone-500">Net after commission</span><b className="text-emerald-700">{formatETB(confirm.escrow.net_amount)}</b></div>
              <div className="flex justify-between"><span className="text-stone-500">Escrow status</span><b>{confirm.escrow.status}</b></div>
            </div>
            <p className="text-xs text-stone-500 leading-relaxed">
              {confirm.action === 'release'
                ? 'The seller will be paid the net amount immediately. Use this after successful delivery or to resolve a dispute in the seller\u2019s favor.'
                : 'The full amount returns to the buyer and the order is marked refunded. Use this for failed deliveries or disputes in the buyer\u2019s favor.'}
              {' '}In production this action requires dual authorization (4-eyes) and is audit-logged.
            </p>
            <button onClick={resolve} disabled={busyId === confirm.escrow.id} className={`btn w-full ${confirm.action === 'release' ? 'btn-navy' : 'btn-danger'}`}>
              {busyId === confirm.escrow.id ? 'Processing…' : `Confirm ${confirm.action === 'release' ? 'release' : 'refund'}`}
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
