import { useEffect, useState } from 'react';
import { Eye, ListFilter, PackageCheck, Percent, TrendingUp, Wallet } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { apiFetch } from '../../lib/api';
import { compactETB, formatETB } from '../../lib/format';
import { PageLoader } from '../../components/ui';
import { HBarChart } from '../../components/charts';

function Card({ icon: Icon, label, value, sub, gold }: { icon: any; label: string; value: string; sub?: string; gold?: boolean }) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wide text-stone-400">{label}</span>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${gold ? 'bg-gold-100 text-gold-700' : 'bg-navy-50 text-navy-700'}`}>
          <Icon size={17} />
        </div>
      </div>
      <p className="mt-2 text-2xl font-extrabold text-navy-900">{value}</p>
      {sub && <p className="text-xs text-stone-400 mt-0.5">{sub}</p>}
    </div>
  );
}

const FUNNEL = ['PAYMENT_PENDING', 'PAID', 'DELIVERING', 'COMPLETED'];

export default function AnalyticsPanel() {
  const { profile, token } = useAuth();
  const txns = useState<any[] | null>(null);
  const [sales, setSales] = txns;
  const [listings, setListings] = useState<any[]>([]);
  const [escrows, setEscrows] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      apiFetch('/api/transactions', { token }).catch(() => []),
      apiFetch('/api/listings?mine=true', { token }).catch(() => ({ listings: [] })),
      apiFetch('/api/escrows', { token }).catch(() => []),
    ]).then(([t, l, e]) => {
      setSales((t || []).filter((x: any) => x.seller_id === profile?.id));
      setListings(l.listings || []);
      setEscrows(e || []);
      setLoaded(true);
    });
  }, [token, profile?.id]);

  if (!loaded || !sales) return <PageLoader />;

  const totalViews = listings.reduce((s, l) => s + (l.view_count || 0), 0);
  const completed = sales.filter((t) => t.status === 'COMPLETED');
  const revenue = escrows.filter((e) => e.status === 'RELEASED').reduce((s, e) => s + Number(e.net_amount || 0), 0);
  const pendingPayout = escrows.filter((e) => ['HELD', 'PENDING'].includes(e.status)).reduce((s, e) => s + Number(e.net_amount || 0), 0);
  const aov = completed.length ? completed.reduce((s, t) => s + Number(t.total_amount || 0), 0) / completed.length : 0;
  const conversion = totalViews > 0 ? (sales.length / totalViews) * 100 : 0;

  const topListings = [...listings].sort((a, b) => (b.view_count || 0) - (a.view_count || 0)).slice(0, 8);
  const categories = [...new Set(listings.map((l) => l.category))];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-extrabold text-navy-900">Sales Analytics</h2>
        <p className="text-sm text-stone-500">Views, conversion and payout performance across your {listings.length} listings.</p>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <Card icon={Wallet} label="Revenue released" value={compactETB(revenue)} sub="net of 6% commission" gold />
        <Card icon={PackageCheck} label="Pending payout" value={compactETB(pendingPayout)} sub="held in escrow, on the way" />
        <Card icon={Eye} label="Total listing views" value={totalViews.toLocaleString()} sub={`${listings.length ? Math.round(totalViews / listings.length) : 0} avg per listing`} />
        <Card icon={Percent} label="View → order rate" value={`${conversion.toFixed(2)}%`} sub={`${sales.length} orders from ${totalViews.toLocaleString()} views`} />
        <Card icon={TrendingUp} label="Completed orders" value={String(completed.length)} sub={completed.length ? `avg order ${formatETB(aov)}` : 'no completed orders yet'} />
        <Card icon={ListFilter} label="Categories listed" value={String(categories.length)} sub={categories.slice(0, 3).join(', ')} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card p-6">
          <h3 className="font-extrabold text-navy-900 mb-5">Views by listing</h3>
          {topListings.length === 0 ? (
            <p className="text-sm text-stone-400 py-6 text-center">Create listings to see view analytics.</p>
          ) : (
            <HBarChart
              rows={topListings.map((l) => ({
                label: l.title.length > 26 ? l.title.slice(0, 26) + '\u2026' : l.title,
                value: l.view_count || 0,
              }))}
            />
          )}
        </div>
        <div className="card p-6">
          <h3 className="font-extrabold text-navy-900 mb-5">Order funnel</h3>
          {sales.length === 0 ? (
            <p className="text-sm text-stone-400 py-6 text-center">Orders appear here as buyers check out.</p>
          ) : (
            <HBarChart
              rows={FUNNEL.map((s) => ({
                label: s.replace('_', ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase()),
                value: sales.filter((t) => t.status === s).length,
                color: s === 'COMPLETED' ? 'bg-emerald-500' : 'bg-navy-800',
              }))}
            />
          )}
          <div className="mt-6 pt-4 border-t border-stone-100 grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-lg font-extrabold text-navy-800">{sales.filter((t) => ['CANCELLED'].includes(t.status)).length}</p>
              <p className="text-[10px] font-semibold text-stone-400 uppercase">Cancelled</p>
            </div>
            <div>
              <p className="text-lg font-extrabold text-red-600">{sales.filter((t) => t.status === 'DISPUTED').length}</p>
              <p className="text-[10px] font-semibold text-stone-400 uppercase">Disputed</p>
            </div>
            <div>
              <p className="text-lg font-extrabold text-emerald-600">{escrows.filter((e) => e.status === 'RELEASED').length}</p>
              <p className="text-[10px] font-semibold text-stone-400 uppercase">Payouts</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
