import { useCallback, useEffect, useState } from 'react';
import { BadgeCheck, ClipboardCheck, MapPin, Package, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { apiFetch } from '../../lib/api';
import { CONDITIONS, VREQ_STATUS_META } from '../../lib/constants';
import { fmtDateTime, firstImage } from '../../lib/format';
import { Chip, EmptyState, Modal, PageLoader } from '../../components/ui';

export default function VerificationPanel() {
  const { profile, token } = useAuth();
  const [requests, setRequests] = useState<any[] | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState('');
  const [reportFor, setReportFor] = useState<any>(null);
  const [condition, setCondition] = useState('GOOD');
  const [qtyVerified, setQtyVerified] = useState('');
  const [notes, setNotes] = useState('');

  const isAgent = profile?.role === 'VERIFICATION_AGENT';
  const isAdmin = profile?.role === 'ADMIN' || profile?.role === 'SUPER_ADMIN';

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const d = await apiFetch('/api/verification', { token });
      setRequests(d || []);
    } catch (e: any) {
      setError(e.message);
      setRequests([]);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const put = async (body: Record<string, unknown>, successMsg: string) => {
    setBusyId(String(body.request_id));
    setError('');
    try {
      await apiFetch('/api/verification', { method: 'PUT', body, token });
      setNotice(successMsg);
      setReportFor(null);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusyId('');
    }
  };

  if (!requests) return <PageLoader />;

  const queue = requests.filter((r) => r.status === 'PENDING');
  const mine = requests.filter((r) => ['ASSIGNED', 'IN_PROGRESS'].includes(r.status));
  const history = requests.filter((r) => ['COMPLETED', 'REJECTED'].includes(r.status));

  const RequestCard = ({ r, children }: { r: any; children?: React.ReactNode }) => (
    <div className="card p-4 sm:p-5">
      <div className="flex flex-wrap gap-4 items-start">
        {firstImage(r.listing?.images) ? (
          <img src={firstImage(r.listing?.images)!} alt="" className="w-20 h-16 rounded-xl object-cover shrink-0" />
        ) : (
          <div className="w-20 h-16 rounded-xl bg-navy-50 flex items-center justify-center text-navy-300 shrink-0"><Package size={22} /></div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2 flex-wrap">
            <p className="font-extrabold text-navy-900 leading-snug">{r.listing?.title || 'Listing'}</p>
            <Chip meta={VREQ_STATUS_META[r.status] || { label: r.status, classes: 'bg-stone-200 text-stone-600' }} />
          </div>
          <p className="text-xs text-stone-400 mt-1">
            Seller: <b className="text-stone-600">{r.seller?.company_name || r.seller?.full_name || '—'}</b>
            {r.listing?.city && <span className="inline-flex items-center gap-1 ml-2"><MapPin size={11} /> {r.listing.city}</span>}
            {' · '}Requested {fmtDateTime(r.created_at)}
          </p>
          <p className="text-xs text-stone-500 mt-1">
            Declared: {r.listing?.quantity != null ? Number(r.listing.quantity).toLocaleString() : '—'} {r.listing?.unit || ''} · condition {r.listing?.condition?.replace('_', ' ') || '—'}
          </p>
          {r.agent && <p className="text-xs text-stone-500 mt-1">Agent: <b>{r.agent.full_name}</b></p>}
          {r.status === 'COMPLETED' && (
            <div className="mt-2.5 text-xs bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 text-emerald-800">
              <b>Report:</b> verified condition {r.condition_verified?.replace('_', ' ') || '—'} · verified qty {r.quantity_verified ?? '—'} {r.listing?.unit || ''}
              {r.inspection_notes && <> · {r.inspection_notes}</>}
            </div>
          )}
          {r.status === 'REJECTED' && r.inspection_notes && (
            <div className="mt-2.5 text-xs bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-red-700">
              <b>Rejected:</b> {r.inspection_notes}
            </div>
          )}
        </div>
        {children}
      </div>
    </div>
  );

  if (!isAgent && !isAdmin) {
    // SELLER VIEW
    return (
      <div>
        <h2 className="text-xl font-extrabold text-navy-900">Verification Requests</h2>
        <p className="text-sm text-stone-500 mb-5">Verified listings sell 3× faster. Request physical inspection from My Listings — reports land here.</p>
        {notice && <div className="mb-4 text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-4 py-3">{notice}</div>}
        {error && <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3">{error}</div>}
        {requests.length === 0 ? (
          <div className="card">
            <EmptyState
              icon={BadgeCheck}
              title="No verification requests"
              message="Go to My Listings and tap ‘Request verification’ on any active listing to get the green Verified badge."
            />
          </div>
        ) : (
          <div className="space-y-3">{requests.map((r) => <RequestCard key={r.id} r={r} />)}</div>
        )}
      </div>
    );
  }

  // AGENT / ADMIN VIEW
  return (
    <div>
      <h2 className="text-xl font-extrabold text-navy-900">{isAdmin ? 'Verification Queue (all agents)' : 'Inspection Queue'}</h2>
      <p className="text-sm text-stone-500 mb-5">
        {isAgent ? 'Accept inspections, visit the yard, then submit your report with photos/GPS (report form below).' : 'Monitor the platform-wide inspection pipeline.'}
      </p>

      {notice && <div className="mb-4 text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-4 py-3">{notice}</div>}
      {error && <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3">{error}</div>}

      <h3 className="text-sm font-extrabold text-navy-800 uppercase tracking-wide mb-3 flex items-center gap-2">
        <ClipboardCheck size={15} /> Awaiting an agent ({queue.length})
      </h3>
      {queue.length === 0 ? (
        <div className="card mb-8"><EmptyState icon={ShieldCheck} title="Queue is clear" message="New verification requests will appear here." /></div>
      ) : (
        <div className="space-y-3 mb-8">
          {queue.map((r) => (
            <RequestCard key={r.id} r={r}>
              {isAgent && (
                <button
                  onClick={() => put({ request_id: r.id, action: 'assign' }, 'Inspection assigned to you.')}
                  disabled={busyId === r.id}
                  className="btn btn-navy !py-2 !px-4 text-xs shrink-0"
                >
                  {busyId === r.id ? 'Assigning…' : 'Accept inspection'}
                </button>
              )}
            </RequestCard>
          ))}
        </div>
      )}

      <h3 className="text-sm font-extrabold text-navy-800 uppercase tracking-wide mb-3">Active inspections ({mine.length})</h3>
      {mine.length === 0 ? (
        <p className="text-sm text-stone-400 mb-8">Nothing on your bench right now.</p>
      ) : (
        <div className="space-y-3 mb-8">
          {mine.map((r) => (
            <RequestCard key={r.id} r={r}>
              {isAgent && (
                <button
                  onClick={() => { setReportFor(r); setCondition('GOOD'); setQtyVerified(String(r.listing?.quantity ?? '')); setNotes(''); }}
                  className="btn btn-gold !py-2 !px-4 text-xs shrink-0"
                >
                  Submit report
                </button>
              )}
            </RequestCard>
          ))}
        </div>
      )}

      <h3 className="text-sm font-extrabold text-navy-800 uppercase tracking-wide mb-3">History ({history.length})</h3>
      <div className="space-y-3">
        {history.length === 0 ? (
          <p className="text-sm text-stone-400">No completed inspections yet.</p>
        ) : (
          history.map((r) => <RequestCard key={r.id} r={r} />)
        )}
      </div>

      {/* Report modal */}
      <Modal open={!!reportFor} onClose={() => setReportFor(null)} title="Submit inspection report">
        {reportFor && (
          <div className="space-y-4">
            <div className="bg-sand-50 rounded-xl p-4 text-sm">
              <p className="font-bold text-navy-900">{reportFor.listing?.title}</p>
              <p className="text-xs text-stone-500 mt-1">
                Declared: {Number(reportFor.listing?.quantity ?? 0).toLocaleString()} {reportFor.listing?.unit} · {reportFor.listing?.condition?.replace('_', ' ')}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-stone-500 mb-1 block">Verified condition</label>
                <select value={condition} onChange={(e) => setCondition(e.target.value)} className="input">
                  {CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-stone-500 mb-1 block">Verified quantity</label>
                <input type="number" step="any" value={qtyVerified} onChange={(e) => setQtyVerified(e.target.value)} className="input" />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-stone-500 mb-1 block">Inspection notes</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="input" placeholder="Storage state, moisture, packaging, discrepancies found…" />
            </div>
            <p className="text-[11px] text-stone-400">GPS coordinates and yard photos attach automatically in the mobile agent app.</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => put({ request_id: reportFor.id, action: 'complete', result: 'VERIFIED', condition_verified: condition, quantity_verified: Number(qtyVerified) || null, inspection_notes: notes }, 'Report submitted — listing is now Verified.')}
                disabled={busyId === reportFor.id}
                className="btn btn-navy"
              >
                Approve &amp; verify
              </button>
              <button
                onClick={() => put({ request_id: reportFor.id, action: 'complete', result: 'REJECTED', condition_verified: condition, quantity_verified: Number(qtyVerified) || null, inspection_notes: notes }, 'Report submitted — listing rejected.')}
                disabled={busyId === reportFor.id || !notes.trim()}
                className="btn btn-danger"
                title={!notes.trim() ? 'Notes are required for rejection' : ''}
              >
                Reject listing
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
