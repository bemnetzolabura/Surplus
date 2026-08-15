import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, MapPin, Package, PackageCheck, Route, Truck, Wallet } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { apiFetch } from '../../lib/api';
import { compactETB, fmtDateTime, firstImage, formatETB } from '../../lib/format';
import { Avatar, Chip, EmptyState, PageLoader } from '../../components/ui';
import { DELIVERY_STATUS_META } from '../../lib/logistics';

export default function DeliveriesPanel() {
  const { profile, token } = useAuth();
  const [jobs, setJobs] = useState<any[] | null>(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const d = await apiFetch('/api/deliveries', { token });
      setJobs(d || []);
    } catch (e: any) {
      setError(e.message);
      setJobs([]);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [load]);

  const act = async (jid: string, action: string) => {
    setBusyId(jid);
    setError('');
    try {
      await apiFetch('/api/deliveries', { method: 'PUT', body: { job_id: jid, action }, token });
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusyId('');
    }
  };

  if (!jobs) return <PageLoader />;

  const mine = jobs.filter((j) => j.agent_id === profile?.id);
  const open = jobs.filter((j) => j.status === 'PENDING' && !j.agent_id);
  const active = mine.filter((j) => ['ACCEPTED', 'PICKED_UP'].includes(j.status));
  const done = mine.filter((j) => j.status === 'DELIVERED');
  const earnings = done.reduce((s, j) => s + Number(j.fee || 0), 0);

  const JobCard = ({ j, children }: { j: any; children?: React.ReactNode }) => {
    const t = j.transaction;
    const img = firstImage(t?.listing?.images);
    return (
      <div className="card p-4 sm:p-5">
        <div className="flex flex-wrap gap-4">
          {img ? (
            <img src={img} alt="" className="w-20 h-16 rounded-xl object-cover shrink-0" />
          ) : (
            <div className="w-20 h-16 rounded-xl bg-navy-50 flex items-center justify-center text-navy-300 shrink-0"><Package size={20} /></div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2 flex-wrap">
              <p className="font-extrabold text-navy-900 leading-snug">{t?.listing?.title || 'Delivery job'}</p>
              <Chip meta={DELIVERY_STATUS_META[j.status] || { label: j.status, classes: 'bg-stone-200 text-stone-600' }} />
            </div>
            <div className="mt-2 grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs text-stone-500">
              <span className="inline-flex items-start gap-1.5">
                <MapPin size={12} className="text-emerald-600 mt-0.5 shrink-0" />
                <span><b>Pickup:</b> {j.pickup_address} ({j.pickup_city})<br /><span className="text-stone-400">Seller: {t?.seller?.company_name || t?.seller?.full_name || '\u2014'}</span></span>
              </span>
              <span className="inline-flex items-start gap-1.5">
                <MapPin size={12} className="text-gold-600 mt-0.5 shrink-0" />
                <span><b>Dropoff:</b> {j.delivery_address}<br /><span className="text-stone-400">Buyer: {t?.buyer?.company_name || t?.buyer?.full_name || '\u2014'}</span></span>
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
              <span className="inline-flex items-center gap-1.5 text-stone-500"><Route size={14} /><b className="text-navy-800">{Number(j.distance_km || 0).toLocaleString()} km</b></span>
              <span className="text-stone-500">Fee: <b className="text-emerald-700">{formatETB(j.fee)}</b></span>
              <span className="text-stone-500">Load: <b className="text-navy-800">{Number(t?.quantity || 0).toLocaleString()} {t?.listing?.unit || ''}</b></span>
              <span className="text-xs text-stone-400">posted {fmtDateTime(j.created_at)}</span>
            </div>
          </div>
          {children && <div className="shrink-0 flex items-center">{children}</div>}
        </div>
      </div>
    );
  };

  return (
    <div>
      <h2 className="text-xl font-extrabold text-navy-900">Delivery Jobs</h2>
      <p className="text-sm text-stone-500 mb-5">Accept loads, haul materials between cities, get paid per job.</p>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {[
          { icon: Truck, label: 'Open jobs', value: String(open.length), accent: open.length > 0 },
          { icon: Package, label: 'My active runs', value: String(active.length) },
          { icon: PackageCheck, label: 'Delivered', value: String(done.length) },
          { icon: Wallet, label: 'Fees earned', value: compactETB(earnings) },
        ].map((c) => (
          <div key={c.label} className="card p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wide text-stone-400">{c.label}</span>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${c.accent ? 'bg-gold-100 text-gold-700' : 'bg-navy-50 text-navy-700'}`}>
                <c.icon size={17} />
              </div>
            </div>
            <p className="mt-2 text-2xl font-extrabold text-navy-900">{c.value}</p>
          </div>
        ))}
      </div>

      {error && <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3">{error}</div>}

      <h3 className="text-sm font-extrabold text-navy-800 uppercase tracking-wide mb-3 flex items-center gap-2">
        <Truck size={15} /> Available jobs ({open.length})
      </h3>
      {open.length === 0 ? (
        <div className="card mb-8">
          <EmptyState icon={Truck} title="No open jobs" message="New delivery requests broadcast here the moment buyers pay with delivery." />
        </div>
      ) : (
        <div className="space-y-3 mb-8">
          {open.map((j) => (
            <JobCard key={j.id} j={j}>
              <button onClick={() => act(j.id, 'accept')} disabled={busyId === j.id} className="btn btn-gold !py-2.5">
                {busyId === j.id ? 'Accepting\u2026' : <>Accept job <ArrowRight size={14} /></>}
              </button>
            </JobCard>
          ))}
        </div>
      )}

      <h3 className="text-sm font-extrabold text-navy-800 uppercase tracking-wide mb-3">My active runs ({active.length})</h3>
      {active.length === 0 ? (
        <p className="text-sm text-stone-400 mb-8">Nothing on the road right now.</p>
      ) : (
        <div className="space-y-3 mb-8">
          {active.map((j) => (
            <JobCard key={j.id} j={j}>
              {j.status === 'ACCEPTED' ? (
                <button onClick={() => act(j.id, 'pickup')} disabled={busyId === j.id} className="btn btn-navy !py-2.5">
                  {busyId === j.id ? 'Updating\u2026' : 'Mark picked up'}
                </button>
              ) : (
                <button onClick={() => act(j.id, 'deliver')} disabled={busyId === j.id} className="btn btn-gold !py-2.5">
                  {busyId === j.id ? 'Updating\u2026' : <><CheckCircle2 size={15} /> Mark delivered</>}
                </button>
              )}
            </JobCard>
          ))}
        </div>
      )}

      <h3 className="text-sm font-extrabold text-navy-800 uppercase tracking-wide mb-3">Delivery history ({done.length})</h3>
      {done.length === 0 ? (
        <p className="text-sm text-stone-400">Completed deliveries will show here with fees earned.</p>
      ) : (
        <div className="space-y-3">
          {done.map((j) => (
            <JobCard key={j.id} j={j}>
              <div className="text-right text-xs">
                <p className="font-extrabold text-emerald-700 text-sm">+{formatETB(j.fee)}</p>
                <p className="text-stone-400 mt-0.5">delivered {fmtDateTime(j.delivered_at)}</p>
              </div>
            </JobCard>
          ))}
        </div>
      )}

      {mine.length > 0 && (
        <div className="card mt-8 p-5 flex items-center gap-4">
          <Avatar name={profile?.company_name || profile?.full_name} size={44} />
          <div>
            <p className="font-extrabold text-navy-900">{profile?.company_name || profile?.full_name}</p>
            <p className="text-xs text-stone-500 mt-0.5">{profile?.phone || 'Contact via SurplusSell'} · rated {Number(profile?.rating_avg || 0).toFixed(1)} ({profile?.rating_count || 0} jobs reviewed)</p>
          </div>
        </div>
      )}
    </div>
  );
}
