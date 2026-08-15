import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeftRight, BadgeCheck, Ban, CheckCircle2, Package, Search, ShieldCheck, Star, UserRound, Users,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { apiFetch } from '../../lib/api';
import { LISTING_STATUS_META, ROLE_LABELS, TXN_STATUS_META, VERIF_STATUS_META } from '../../lib/constants';
import { compactETB, fmtDateTime, firstImage, formatETB } from '../../lib/format';
import { Avatar, Chip, EmptyState, PageLoader, Stars } from '../../components/ui';

const ROLES = ['BUYER', 'SELLER', 'VERIFICATION_AGENT', 'DELIVERY_AGENT', 'ADMIN'];

export function UsersPanel() {
  const { token, profile } = useAuth();
  const [users, setUsers] = useState<any[] | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    try {
      const d = await apiFetch('/api/admin?resource=users', { token });
      setUsers(d || []);
    } catch (e: any) {
      setError(e.message);
      setUsers([]);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const act = async (id: string, action: string, value?: string) => {
    setBusyId(id + action);
    setError('');
    setNotice('');
    try {
      await apiFetch('/api/admin', { method: 'PUT', body: { resource: 'user', id, action, value }, token });
      setNotice('User updated.');
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusyId('');
    }
  };

  if (!users) return <PageLoader />;

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    const matchQ = !q || [u.full_name, u.company_name, u.email].filter(Boolean).some((s) => String(s).toLowerCase().includes(q));
    const matchR = !roleFilter || u.role === roleFilter;
    return matchQ && matchR;
  });

  return (
    <div>
      <h2 className="text-xl font-extrabold text-navy-900">User Management</h2>
      <p className="text-sm text-stone-500 mb-5">{users.length} registered accounts · suspend bad actors, change roles, verify KYC.</p>

      {notice && <div className="mb-4 text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-4 py-3">{notice}</div>}
      {error && <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3">{error}</div>}

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, company or email…" className="input !pl-9" />
        </div>
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="input !w-auto">
          <option value="">All roles</option>
          {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </select>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead>
            <tr className="border-b border-stone-100 text-left">
              <th className="px-4 py-3 text-xs font-extrabold uppercase tracking-wide text-stone-400">User</th>
              <th className="px-4 py-3 text-xs font-extrabold uppercase tracking-wide text-stone-400">Rating</th>
              <th className="px-4 py-3 text-xs font-extrabold uppercase tracking-wide text-stone-400">Orders</th>
              <th className="px-4 py-3 text-xs font-extrabold uppercase tracking-wide text-stone-400">Role</th>
              <th className="px-4 py-3 text-xs font-extrabold uppercase tracking-wide text-stone-400">Status</th>
              <th className="px-4 py-3 text-xs font-extrabold uppercase tracking-wide text-stone-400 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id} className="border-b border-stone-50 hover:bg-stone-50/60">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={u.company_name || u.full_name} size={34} />
                    <div className="min-w-0">
                      <p className="font-bold text-navy-900 truncate max-w-[200px]">{u.company_name || u.full_name}</p>
                      <p className="text-xs text-stone-400 truncate max-w-[200px]">{u.email || u.phone || '—'}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  {Number(u.rating_avg) > 0 ? (
                    <span className="inline-flex items-center gap-1"><Star size={13} className="text-gold-500" fill="currentColor" strokeWidth={0} /><b>{Number(u.rating_avg).toFixed(1)}</b><span className="text-xs text-stone-400">({u.rating_count})</span></span>
                  ) : <span className="text-stone-300">{'\u2014'}</span>}
                </td>
                <td className="px-4 py-3 font-bold text-navy-800">{u.total_transactions || 0}</td>
                <td className="px-4 py-3">
                  <select
                    value={u.role}
                    disabled={u.id === profile?.id || busyId === u.id + 'set_role'}
                    onChange={(e) => act(u.id, 'set_role', e.target.value)}
                    className="input !py-1.5 !px-2 !text-xs !w-auto font-bold"
                  >
                    {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <Chip meta={u.status === 'SUSPENDED'
                    ? { label: 'Suspended', classes: 'bg-red-100 text-red-700' }
                    : { label: 'Active', classes: 'bg-emerald-100 text-emerald-800' }} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1.5">
                    {u.kyc_status !== 'VERIFIED' && (
                      <button onClick={() => act(u.id, 'verify_kyc')} disabled={busyId === u.id + 'verify_kyc'} className="btn btn-ghost !py-1.5 !px-2.5 text-xs !text-emerald-700 hover:!bg-emerald-50" title="Verify KYC">
                        <BadgeCheck size={14} />
                      </button>
                    )}
                    {u.status === 'SUSPENDED' ? (
                      <button onClick={() => act(u.id, 'activate')} disabled={busyId === u.id + 'activate'} className="btn btn-ghost !py-1.5 !px-2.5 text-xs text-emerald-700 hover:!bg-emerald-50" title="Reactivate">
                        <CheckCircle2 size={14} />
                      </button>
                    ) : u.id !== profile?.id ? (
                      <button onClick={() => act(u.id, 'suspend')} disabled={busyId === u.id + 'suspend'} className="btn btn-ghost !py-1.5 !px-2.5 text-xs text-red-500 hover:!bg-red-50" title="Suspend">
                        <Ban size={14} />
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-stone-400 text-sm">No users match the current filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ModerationPanel() {
  const { token } = useAuth();
  const [listings, setListings] = useState<any[] | null>(null);
  const [filter, setFilter] = useState('PENDING_APPROVAL');
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    try {
      const d = await apiFetch('/api/admin?resource=listings', { token });
      setListings(d || []);
    } catch (e: any) {
      setError(e.message);
      setListings([]);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const act = async (id: string, action: string) => {
    setBusyId(id + action);
    setError('');
    setNotice('');
    try {
      await apiFetch('/api/admin', { method: 'PUT', body: { resource: 'listing', id, action }, token });
      setNotice(`Listing ${action === 'approve' || action === 'activate' ? 'activated' : action + 'ed'}.`);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusyId('');
    }
  };

  if (!listings) return <PageLoader />;

  const counts = listings.reduce((m: any, l) => { m[l.status] = (m[l.status] || 0) + 1; return m; }, {});
  const filtered = listings.filter((l) => {
    const matchF = !filter || l.status === filter;
    const q = search.toLowerCase();
    const matchQ = !q || l.title.toLowerCase().includes(q) || (l.seller?.company_name || '').toLowerCase().includes(q);
    return matchF && matchQ;
  });

  return (
    <div>
      <h2 className="text-xl font-extrabold text-navy-900">Listing Moderation</h2>
      <p className="text-sm text-stone-500 mb-5">Lots above {formatETB(10000, { suffix: false })} ETB need approval · approve, reject, feature or suspend.</p>

      {notice && <div className="mb-4 text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-4 py-3">{notice}</div>}
      {error && <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3">{error}</div>}

      <div className="flex flex-wrap gap-2 mb-4">
        {['PENDING_APPROVAL', 'ACTIVE', 'SUSPENDED', 'REJECTED', 'SOLD', ''].map((s) => (
          <button key={s || 'all'} onClick={() => setFilter(s)} className={`px-3.5 py-2 rounded-full text-xs font-bold border transition-colors ${filter === s ? 'bg-navy-800 text-white border-navy-800' : 'border-stone-200 text-stone-600 hover:border-navy-400'}`}>
            {s === '' ? `All (${listings.length})` : `${(LISTING_STATUS_META[s]?.label || s)} (${counts[s] || 0})`}
          </button>
        ))}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search title or seller…" className="input !pl-9 !py-2" />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState icon={ShieldCheck} title="Nothing to review" message={filter === 'PENDING_APPROVAL' ? 'The approval queue is empty — all caught up.' : 'No listings in this state.'} />
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((l) => (
            <div key={l.id} className="card p-4 flex flex-wrap gap-4">
              {firstImage(l.images) ? (
                <img src={firstImage(l.images)!} alt="" className="w-24 h-20 rounded-xl object-cover shrink-0" />
              ) : (
                <div className="w-24 h-20 rounded-xl bg-navy-50 flex items-center justify-center text-navy-300 shrink-0"><Package size={24} /></div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-2 flex-wrap">
                  <Link to={`/listing/${l.id}`} className="font-extrabold text-navy-900 hover:text-gold-600 leading-snug">{l.title}</Link>
                  <Chip meta={LISTING_STATUS_META[l.status] || { label: l.status, classes: 'bg-stone-200 text-stone-600' }} />
                  <Chip meta={VERIF_STATUS_META[l.verification_status] || { label: l.verification_status, classes: 'bg-stone-200 text-stone-600' }} />
                  {l.featured && <span className="bg-gold-500 text-navy-900 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase">Featured</span>}
                </div>
                <p className="text-xs text-stone-400 mt-1">
                  {l.seller?.company_name || l.seller?.full_name || '—'} · {l.city} · posted {fmtDateTime(l.created_at)}
                </p>
                <p className="text-xs text-stone-500 mt-1">
                  Lot value: <b className="text-navy-800">{formatETB(l.total_price)}</b> · {Number(l.quantity).toLocaleString()} {l.unit} × {formatETB(l.price_per_unit)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {l.status === 'PENDING_APPROVAL' && (
                  <>
                    <button onClick={() => act(l.id, 'approve')} disabled={busyId === l.id + 'approve'} className="btn btn-navy !py-2 !px-4 text-xs">Approve</button>
                    <button onClick={() => act(l.id, 'reject')} disabled={busyId === l.id + 'reject'} className="btn btn-outline !py-2 !px-4 text-xs !text-red-600 !border-red-200 hover:!bg-red-50">Reject</button>
                  </>
                )}
                {l.status === 'ACTIVE' && (
                  <>
                    <button onClick={() => act(l.id, l.featured ? 'unfeature' : 'feature')} disabled={busyId.startsWith(l.id)} className="btn btn-outline !py-2 !px-4 text-xs !text-gold-700 !border-gold-300 hover:!bg-gold-100">
                      {l.featured ? 'Unfeature' : 'Feature'}
                    </button>
                    <button onClick={() => act(l.id, 'suspend')} disabled={busyId === l.id + 'suspend'} className="btn btn-outline !py-2 !px-4 text-xs !text-red-600 !border-red-200 hover:!bg-red-50">Suspend</button>
                  </>
                )}
                {['SUSPENDED', 'REJECTED'].includes(l.status) && (
                  <button onClick={() => act(l.id, 'activate')} disabled={busyId === l.id + 'activate'} className="btn btn-navy !py-2 !px-4 text-xs">Reactivate</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function TransactionsPanel() {
  const { token } = useAuth();
  const [txns, setTxns] = useState<any[] | null>(null);
  const [filter, setFilter] = useState('');

  const load = useCallback(async () => {
    try {
      const d = await apiFetch('/api/admin?resource=transactions', { token });
      setTxns(d || []);
    } catch {
      setTxns([]);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  if (!txns) return <PageLoader />;

  const statuses = Object.keys(TXN_STATUS_META);
  const filtered = txns.filter((t) => !filter || t.status === filter);
  const gmv = filtered.reduce((s, t) => s + Number(t.total_amount || 0), 0);

  return (
    <div>
      <h2 className="text-xl font-extrabold text-navy-900">All Transactions</h2>
      <p className="text-sm text-stone-500 mb-5">
        {filtered.length} order(s) · GMV <b className="text-navy-800">{compactETB(gmv)}</b> shown below · resolve disputes from the Escrow Ops tab.
      </p>

      <div className="flex flex-wrap gap-2 mb-4">
        <button onClick={() => setFilter('')} className={`px-3.5 py-2 rounded-full text-xs font-bold border transition-colors ${!filter ? 'bg-navy-800 text-white border-navy-800' : 'border-stone-200 text-stone-600'}`}>
          All ({txns.length})
        </button>
        {statuses.filter((s) => txns.some((t) => t.status === s)).map((s) => (
          <button key={s} onClick={() => setFilter(filter === s ? '' : s)} className={`px-3.5 py-2 rounded-full text-xs font-bold border transition-colors ${filter === s ? `${s === 'DISPUTED' ? 'bg-red-600 border-red-600' : 'bg-navy-800 border-navy-800'} text-white` : 'border-stone-200 text-stone-600'}`}>
            {TXN_STATUS_META[s].label} ({txns.filter((t) => t.status === s).length})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="card"><EmptyState icon={ArrowLeftRight} title="No transactions" message="Orders will appear here as buyers check out." /></div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm min-w-[820px]">
            <thead>
              <tr className="border-b border-stone-100 text-left">
                <th className="px-4 py-3 text-xs font-extrabold uppercase tracking-wide text-stone-400">Order</th>
                <th className="px-4 py-3 text-xs font-extrabold uppercase tracking-wide text-stone-400">Buyer</th>
                <th className="px-4 py-3 text-xs font-extrabold uppercase tracking-wide text-stone-400">Seller</th>
                <th className="px-4 py-3 text-xs font-extrabold uppercase tracking-wide text-stone-400">Amount</th>
                <th className="px-4 py-3 text-xs font-extrabold uppercase tracking-wide text-stone-400">Commission</th>
                <th className="px-4 py-3 text-xs font-extrabold uppercase tracking-wide text-stone-400">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id} className={`border-b border-stone-50 ${t.status === 'DISPUTED' ? 'bg-red-50/50' : 'hover:bg-stone-50/60'}`}>
                  <td className="px-4 py-3">
                    <p className="font-bold text-navy-900 max-w-[220px] truncate">{t.listing?.title || '—'}</p>
                    <p className="text-xs text-stone-400">#{t.id.slice(0, 8).toUpperCase()} · {fmtDateTime(t.created_at)} · {Number(t.quantity).toLocaleString()} units</p>
                  </td>
                  <td className="px-4 py-3 text-stone-600 max-w-[160px] truncate">{t.buyer?.company_name || t.buyer?.full_name || '—'}</td>
                  <td className="px-4 py-3 text-stone-600 max-w-[160px] truncate">{t.seller?.company_name || t.seller?.full_name || '—'}</td>
                  <td className="px-4 py-3 font-extrabold text-navy-900">{formatETB(t.total_amount, { suffix: false })}</td>
                  <td className="px-4 py-3 font-bold text-gold-700">{formatETB(t.commission_amount, { suffix: false })}</td>
                  <td className="px-4 py-3"><Chip meta={TXN_STATUS_META[t.status] || { label: t.status, classes: 'bg-stone-200 text-stone-600' }} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-stone-400 mt-3 flex items-center gap-1.5">
        <UserRound size={13} /> Disputed rows are highlighted in red — resolve them from the Escrow Ops tab (release or refund).
      </p>
    </div>
  );
}

export function StarsRow({ value }: { value: number }) {
  return <Stars value={value} size={13} />;
}
