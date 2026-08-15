import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeftRight, BadgeCheck, BarChart3, Bell, ClipboardCheck, Heart, LayoutDashboard, Package,
  SearchCheck, ShieldCheck, ShoppingBag, Store, Truck, User, Users, type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiFetch } from '../lib/api';
import { ROLE_LABELS } from '../lib/constants';
import { Avatar, PageLoader } from '../components/ui';
import Overview from './dash/Overview';
import OrdersPanel from './dash/OrdersPanel';
import ListingsPanel from './dash/ListingsPanel';
import EscrowPanel from './dash/EscrowPanel';
import VerificationPanel from './dash/VerificationPanel';
import AnalyticsPanel from './dash/AnalyticsPanel';
import DeliveriesPanel from './dash/DeliveriesPanel';
import SearchesPanel from './dash/SearchesPanel';
import { UsersPanel, ModerationPanel, TransactionsPanel } from './dash/AdminPanels';
import { NotificationsPanel, ProfilePanel, WatchlistPanel } from './dash/MiscPanels';

interface Tab { id: string; label: string; icon: LucideIcon }

export default function Dashboard() {
  const { profile, token, loading } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [unread, setUnread] = useState(0);

  const isSeller = profile?.role === 'SELLER';
  const isAgent = profile?.role === 'VERIFICATION_AGENT';
  const isDelivery = profile?.role === 'DELIVERY_AGENT';
  const isAdmin = profile?.role === 'ADMIN' || profile?.role === 'SUPER_ADMIN';

  const tabs: Tab[] = useMemo(() => {
    const t: Tab[] = [{ id: 'overview', label: 'Overview', icon: LayoutDashboard }];
    if (isSeller) t.push(
      { id: 'my-listings', label: 'My Listings', icon: Package },
      { id: 'sales', label: 'Incoming Orders', icon: Store },
      { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    );
    if (isDelivery) t.push({ id: 'deliveries', label: 'Deliveries', icon: Truck });
    if (isAgent) t.push({ id: 'inspections', label: 'Inspections', icon: ClipboardCheck });
    if (!isDelivery) t.push({ id: 'orders', label: isSeller ? 'My Purchases' : 'My Orders', icon: ShoppingBag });
    if (!isAdmin && !isAgent && !isDelivery) t.push(
      { id: 'watchlist', label: 'Watchlist', icon: Heart },
      { id: 'searches', label: 'Saved Searches', icon: SearchCheck },
    );
    if (isSeller) t.push(
      { id: 'escrow', label: 'Escrow', icon: ShieldCheck },
      { id: 'verification', label: 'Verification', icon: BadgeCheck },
    );
    if (isAdmin) t.push(
      { id: 'users', label: 'Users', icon: Users },
      { id: 'moderation', label: 'Moderation', icon: BadgeCheck },
      { id: 'all-transactions', label: 'Transactions', icon: ArrowLeftRight },
      { id: 'escrow', label: 'Escrow Ops', icon: ShieldCheck },
    );
    t.push(
      { id: 'notifications', label: 'Notifications', icon: Bell },
      { id: 'profile', label: 'Profile', icon: User },
    );
    return t;
  }, [isSeller, isAgent, isDelivery, isAdmin]);

  const activeTab = params.get('tab') && tabs.some((t) => t.id === params.get('tab')) ? params.get('tab')! : 'overview';

  useEffect(() => {
    if (!loading && !token) navigate('/auth?redirect=' + encodeURIComponent(`/dashboard?tab=${activeTab}`));
  }, [loading, token, navigate, activeTab]);

  useEffect(() => {
    if (!token) return;
    apiFetch('/api/notifications', { token })
      .then((d) => setUnread(d.unread || 0))
      .catch(() => {});
  }, [token, activeTab]);

  if (loading || !profile) return <PageLoader label="Loading your dashboard…" />;

  const select = (id: string) => setParams({ tab: id });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <div className="grid lg:grid-cols-[250px_1fr] gap-6 items-start">
        {/* Sidebar */}
        <aside>
          <div className="card p-5 mb-4">
            <div className="flex items-center gap-3">
              <Avatar name={profile.company_name || profile.full_name} size={46} />
              <div className="min-w-0">
                <p className="font-extrabold text-navy-900 truncate">{profile.company_name || profile.full_name}</p>
                <p className="text-xs text-stone-400 truncate">{profile.email}</p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider bg-gold-100 text-gold-700 px-2.5 py-1 rounded-full">
                {ROLE_LABELS[profile.role] || profile.role}
              </span>
              {profile.kyc_status === 'VERIFIED' && (
                <span className="text-[10px] font-extrabold uppercase tracking-wider bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full">
                  KYC Verified
                </span>
              )}
            </div>
          </div>
          <nav className="card p-2 space-y-0.5 lg:sticky lg:top-24">
            <div className="flex lg:flex-col gap-1 overflow-x-auto no-scrollbar">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => select(t.id)}
                  className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors ${
                    activeTab === t.id ? 'bg-navy-800 text-white shadow-sm' : 'text-stone-600 hover:bg-stone-100'
                  }`}
                >
                  <t.icon size={16} className={activeTab === t.id ? 'text-gold-400' : 'text-stone-400'} />
                  {t.label}
                  {t.id === 'notifications' && unread > 0 && (
                    <span className="ml-auto min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                      {unread}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </nav>
        </aside>

        {/* Content */}
        <div className="min-w-0">
          {activeTab === 'overview' && <Overview />}
          {activeTab === 'my-listings' && <ListingsPanel />}
          {activeTab === 'sales' && <OrdersPanel mode="sell" />}
          {activeTab === 'analytics' && <AnalyticsPanel />}
          {activeTab === 'deliveries' && <DeliveriesPanel />}
          {activeTab === 'orders' && <OrdersPanel mode="buy" />}
          {activeTab === 'watchlist' && <WatchlistPanel />}
          {activeTab === 'searches' && <SearchesPanel />}
          {activeTab === 'escrow' && <EscrowPanel />}
          {(activeTab === 'verification' || activeTab === 'inspections') && <VerificationPanel />}
          {activeTab === 'users' && <UsersPanel />}
          {activeTab === 'moderation' && <ModerationPanel />}
          {activeTab === 'all-transactions' && <TransactionsPanel />}
          {activeTab === 'notifications' && <NotificationsPanel />}
          {activeTab === 'profile' && <ProfilePanel />}
        </div>
      </div>
    </div>
  );
}
