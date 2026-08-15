import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Eye, Gavel, Heart, Package, PackageCheck, ShieldCheck, ShoppingBag, Store, TrendingUp, Truck, Users, Wallet,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { apiFetch } from '../../lib/api';
import { compactETB, formatETB } from '../../lib/format';
import { TXN_STATUS_META } from '../../lib/constants';
import { Chip, PageLoader } from '../../components/ui';
import { HBarChart } from '../../components/charts';
import ListingCard from '../../components/ListingCard';

function StatCard({ icon: Icon, label, value, sub, accent }: { icon: any; label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wide text-stone-400">{label}</span>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${accent ? 'bg-gold-100 text-gold-700' : 'bg-navy-50 text-navy-700'}`}>
          <Icon size={17} />
        </div>
      </div>
      <p className="mt-2 text-2xl font-extrabold text-navy-900">{value}</p>
      {sub && <p className="text-xs text-stone-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function Overview() {
  const { profile, token } = useAuth();
  const [txns, setTxns] = useState<any[] | null>(null);
  const [listings, setListings] = useState<any[]>([]);
  const [escrows, setEscrows] = useState<any[]>([]);
  const [watch, setWatch] = useState<any[]>([]);
  const [adminStats, setAdminStats] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);

  const isAdmin = profile?.role === 'ADMIN' || profile?.role === 'SUPER_ADMIN';
  const isSeller = profile?.role === 'SELLER';
  const isAgent = profile?.role === 'VERIFICATION_AGENT';
  const isDelivery = profile?.role === 'DELIVERY_AGENT';

  useEffect(() => {
    if (!token) return;
    apiFetch('/api/transactions', { token }).then(setTxns).catch(() => setTxns([]));
    if (isSeller) {
      apiFetch('/api/listings?mine=true', { token }).then((d) => setListings(d.listings || [])).catch(() => {});
      apiFetch('/api/escrows', { token }).then(setEscrows).catch(() => {});
    }
    apiFetch('/api/watchlist', { token }).then((d) => setWatch(d.listings || [])).catch(() => {});
    if (isAdmin) {
      apiFetch('/api/stats?scope=admin', { token }).then(setAdminStats).catch(() => {});
      apiFetch('/api/categories').then(setCategories).catch(() => {});
    }
  }, [token, isSeller, isAdmin]);

  if (!txns) return <PageLoader />;

  if (isAdmin) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard icon={Users} label="Total users" value={adminStats ? String(adminStats.users_total) : '—'} sub={adminStats ? `${adminStats.users_suspended} suspended` : ''} />
          <StatCard icon={Package} label="Listings" value={adminStats ? String(adminStats.listings_total) : '—'} sub={adminStats ? `${adminStats.listings_verified} verified` : ''} />
          <StatCard icon={TrendingUp} label="GMV traded" value={adminStats ? compactETB(adminStats.gmv_total) : '—'} sub="all-time order volume" />
          <StatCard icon={Wallet} label="Commission earned" value={adminStats ? compactETB(adminStats.commission_earned) : '—'} sub="6% · min 200 ETB per deal" accent />
          <StatCard icon={ShieldCheck} label="Escrow held" value={adminStats ? compactETB(adminStats.escrow_held) : '—'} sub="awaiting delivery confirmation" />
          <StatCard icon={PackageCheck} label="Escrow released" value={adminStats ? compactETB(adminStats.escrow_released_total) : '—'} sub="paid out to sellers" />
          <StatCard icon={Gavel} label="Open disputes" value={adminStats ? String(adminStats.disputes_open ?? 0) : '—'} sub="need admin resolution" accent />
          <StatCard icon={Store} label="Active listings" value={adminStats ? String(adminStats.active_listings) : '—'} sub={adminStats ? `in ${adminStats.cities} cities` : ''} />
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <div className="card p-6">
            <h3 className="font-extrabold text-navy-900 mb-5">Listings by status</h3>
            {adminStats ? (
              <HBarChart rows={Object.entries(adminStats.listings_by_status || {}).map(([k, v]) => ({ label: String(k).replace('_', ' '), value: v as number }))} />
            ) : <PageLoader />}
          </div>
          <div className="card p-6">
            <h3 className="font-extrabold text-navy-900 mb-5">Transactions by status</h3>
            {adminStats ? (
              <HBarChart rows={Object.entries(adminStats.transactions_by_status || {}).map(([k, v]) => ({ label: String(k).replace('_', ' '), value: v as number, color: k === 'DISPUTED' ? 'bg-red-500' : k === 'COMPLETED' ? 'bg-emerald-500' : 'bg-navy-800' }))} />
            ) : <PageLoader />}
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-extrabold text-navy-900">Live price index — average asking price</h3>
            <TrendingUp size={18} className="text-gold-600" />
          </div>
          {adminStats ? (
            <HBarChart
              rows={(adminStats.price_index || []).slice(0, 8).map((p: any) => ({
                label: categories.find((c) => c.slug === p.category)?.name || p.category,
                value: p.avg_price,
                hint: `/ ${p.unit}`,
                color: 'bg-gold-500',
              }))}
              format={(v) => compactETB(v)}
            />
          ) : <PageLoader />}
        </div>
      </div>
    );
  }

  if (isAgent) {
    return <AgentHome txns={txns} />;
  }

  if (isDelivery) {
    return <DeliveryHome />;
  }

  const myId = profile?.id;
  const purchases = txns.filter((t) => t.buyer_id === myId);
  const sales = isSeller ? txns.filter((t) => t.seller_id === myId) : [];
  const activeListings = listings.filter((l) => l.status === 'ACTIVE');
  const totalViews = listings.reduce((s, l) => s + (l.view_count || 0), 0);
  const held = escrows.filter((e) => ['HELD', 'PENDING'].includes(e.status));
  const released = escrows.filter((e) => e.status === 'RELEASED');
  const spent = purchases.filter((t) => t.status === 'COMPLETED').reduce((s, t) => s + Number(t.total_amount || 0), 0);
  const recentTxns = [...txns].slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {isSeller ? (
          <>
            <StatCard icon={Package} label="Active listings" value={String(activeListings.length)} sub={`${listings.length} total`} />
            <StatCard icon={Eye} label="Total views" value={totalViews.toLocaleString()} sub="across all listings" />
            <StatCard icon={ShieldCheck} label="Escrow held" value={compactETB(held.reduce((s, e) => s + Number(e.amount || 0), 0))} sub={`${held.length} order(s) in transit`} />
            <StatCard icon={Wallet} label="Released to you" value={compactETB(released.reduce((s, e) => s + Number(e.net_amount || 0), 0))} sub="net of commission" accent />
          </>
        ) : (
          <>
            <StatCard icon={ShoppingBag} label="Orders placed" value={String(purchases.length)} />
            <StatCard icon={PackageCheck} label="Completed" value={String(purchases.filter((t) => t.status === 'COMPLETED').length)} />
            <StatCard icon={Heart} label="Watchlist" value={String(watch.length)} />
            <StatCard icon={Wallet} label="Total spent" value={compactETB(spent)} sub="via escrow" accent />
          </>
        )}
      </div>

      {isSeller && sales.filter((t) => t.status === 'PAID').length > 0 && (
        <div className="card p-4 border-l-4 !border-l-amber-400 bg-amber-50/50 flex items-center gap-3">
          <PackageCheck size={20} className="text-amber-600 shrink-0" />
          <p className="text-sm font-semibold text-amber-800">
            {sales.filter((t) => t.status === 'PAID').length} paid order(s) waiting to be dispatched.
          </p>
          <Link to="/dashboard?tab=sales" className="ml-auto btn btn-navy !py-1.5 text-xs">Dispatch now</Link>
        </div>
      )}

      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-extrabold text-navy-900">Recent activity</h3>
          <Link to="/dashboard?tab=orders" className="text-xs font-bold text-navy-700 hover:text-gold-600 inline-flex items-center gap-1">
            View all <ArrowRight size={13} />
          </Link>
        </div>
        {recentTxns.length === 0 ? (
          <div className="text-center py-8">
            <ShoppingBag size={28} className="mx-auto text-stone-200" />
            <p className="mt-2 text-sm text-stone-500">No orders yet. {isSeller ? 'Share your listings to get your first sale.' : 'Start browsing verified surplus materials.'}</p>
            <Link to={isSeller ? '/dashboard?tab=my-listings' : '/browse'} className="btn btn-navy mt-4">
              {isSeller ? 'Manage listings' : 'Browse materials'}
            </Link>
          </div>
        ) : (
          <div className="space-y-2.5">
            {recentTxns.map((t) => (
              <div key={t.id} className="flex items-center gap-3 rounded-xl border border-stone-100 px-4 py-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${t.buyer_id === myId ? 'bg-sky-50 text-sky-600' : 'bg-emerald-50 text-emerald-600'}`}>
                  {t.buyer_id === myId ? <ShoppingBag size={16} /> : <Store size={16} />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-stone-700 truncate">{t.listing?.title || 'Order'}</p>
                  <p className="text-xs text-stone-400">
                    {t.buyer_id === myId ? 'Purchase' : 'Sale'} · {Number(t.quantity).toLocaleString()} {t.listing?.unit || ''} · {formatETB(t.total_amount)}
                  </p>
                </div>
                <Chip meta={TXN_STATUS_META[t.status] || { label: t.status, classes: 'bg-stone-200 text-stone-600' }} />
              </div>
            ))}
          </div>
        )}
      </div>

      {watch.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-extrabold text-navy-900">From your watchlist</h3>
            <Link to="/dashboard?tab=watchlist" className="text-xs font-bold text-navy-700 hover:text-gold-600 inline-flex items-center gap-1">
              View all <ArrowRight size={13} />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {watch.slice(0, 4).map((l) => <ListingCard key={l.id} listing={l} />)}
          </div>
        </div>
      )}
    </div>
  );
}

function DeliveryHome() {
  const { profile, token } = useAuth();
  const [jobs, setJobs] = useState<any[]>([]);
  useEffect(() => {
    if (!token) return;
    apiFetch('/api/deliveries', { token }).then(setJobs).catch(() => {});
  }, [token]);
  const open = jobs.filter((j) => j.status === 'PENDING' && !j.agent_id);
  const mine = jobs.filter((j) => j.agent_id === profile?.id);
  const active = mine.filter((j) => ['ACCEPTED', 'PICKED_UP'].includes(j.status));
  const done = mine.filter((j) => j.status === 'DELIVERED');
  const earnings = done.reduce((s, j) => s + Number(j.fee || 0), 0);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon={Truck} label="Open jobs" value={String(open.length)} sub="broadcast to all drivers" accent={open.length > 0} />
        <StatCard icon={Package} label="My active runs" value={String(active.length)} sub="pickup or in transit" />
        <StatCard icon={PackageCheck} label="Deliveries completed" value={String(done.length)} />
        <StatCard icon={Wallet} label="Fees earned" value={done.length ? done.reduce((s, j) => s + Number(j.fee || 0), 0).toLocaleString() + ' ETB' : '0 ETB'} sub={`${earnings ? 'across ' + done.length + ' jobs' : 'complete a run to earn'}`} />
      </div>
      {open.length > 0 && (
        <div className="card p-4 border-l-4 !border-l-gold-500 bg-gold-100/40 flex items-center gap-3">
          <Truck size={20} className="text-gold-700 shrink-0" />
          <p className="text-sm font-semibold text-gold-700">{open.length} paid load(s) waiting for a driver right now.</p>
          <Link to="/dashboard?tab=deliveries" className="ml-auto btn btn-navy !py-1.5 text-xs">Grab a job</Link>
        </div>
      )}
      <div className="card p-6">
        <h3 className="font-extrabold text-navy-900 mb-2">Your logistics network</h3>
        <p className="text-sm text-stone-500 leading-relaxed">
          Buyers pay your delivery fee in cash on delivery — materials money never touches your account,
          it stays in SurplusSell escrow between buyer and seller. You handle the haul, we handle the trust.
        </p>
        <Link to="/dashboard?tab=deliveries" className="btn btn-navy mt-5">
          Open job board <ArrowRight size={15} />
        </Link>
      </div>
    </div>
  );
}

function AgentHome({ txns }: { txns: any[] }) {
  const { token } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  useEffect(() => {
    if (!token) return;
    apiFetch('/api/verification', { token }).then(setRequests).catch(() => {});
  }, [token]);
  const queue = requests.filter((r) => r.status === 'PENDING');
  const mine = requests.filter((r) => ['ASSIGNED', 'IN_PROGRESS'].includes(r.status));
  const done = requests.filter((r) => ['COMPLETED', 'REJECTED'].includes(r.status));
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon={Package} label="In queue" value={String(queue.length)} sub="awaiting an agent" />
        <StatCard icon={ShieldCheck} label="Assigned to me" value={String(mine.length)} sub="need inspection" accent />
        <StatCard icon={PackageCheck} label="Completed reports" value={String(done.length)} />
        <StatCard icon={TrendingUp} label="Linked orders" value={String(txns.length)} />
      </div>
      <div className="card p-6">
        <h3 className="font-extrabold text-navy-900 mb-2">How verification works</h3>
        <p className="text-sm text-stone-500 leading-relaxed">
          Accept a request from the queue, visit the seller's yard, verify quantity and physical condition,
          then submit your report. Verified listings carry the green badge buyers trust most.
        </p>
        <Link to="/dashboard?tab=inspections" className="btn btn-navy mt-5">
          Open inspection queue <ArrowRight size={15} />
        </Link>
      </div>
    </div>
  );
}
