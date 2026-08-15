import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BadgeCheck, Bell, CheckCheck, CreditCard, Gavel, Heart, Mail, MapPin, MessageSquare, Package, Save,
  Star, Store, UserRound,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { apiFetch } from '../../lib/api';
import { CITIES, ROLE_LABELS } from '../../lib/constants';
import { fmtDate, timeAgo } from '../../lib/format';
import { Avatar, Chip, EmptyState, PageLoader, Stars } from '../../components/ui';
import ListingCard from '../../components/ListingCard';

const NOTIF_ICONS: Record<string, any> = {
  ORDER: Package,
  PAYMENT: CreditCard,
  ESCROW: BadgeCheck,
  MESSAGE: MessageSquare,
  VERIFICATION: BadgeCheck,
  RATING: Star,
  DISPUTE: Gavel,
  MODERATION: Store,
  ADMIN: Bell,
};

export function NotificationsPanel() {
  const { token } = useAuth();
  const [data, setData] = useState<any | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const d = await apiFetch('/api/notifications', { token });
      setData(d);
    } catch {
      setData({ notifications: [], unread: 0 });
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const markAll = async () => {
    await apiFetch('/api/notifications', { method: 'PUT', body: { all: true }, token }).catch(() => {});
    load();
  };

  const markOne = async (id: string) => {
    await apiFetch('/api/notifications', { method: 'PUT', body: { ids: [id] }, token }).catch(() => {});
    load();
  };

  if (!data) return <PageLoader />;
  const notifs = data.notifications || [];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-extrabold text-navy-900">Notifications</h2>
          <p className="text-sm text-stone-500">{data.unread} unread</p>
        </div>
        {data.unread > 0 && (
          <button onClick={markAll} className="btn btn-outline !py-2 text-xs">
            <CheckCheck size={14} /> Mark all read
          </button>
        )}
      </div>

      {notifs.length === 0 ? (
        <div className="card">
          <EmptyState icon={Bell} title="Nothing yet" message="Order updates, messages and escrow events will show up here in real time." />
        </div>
      ) : (
        <div className="space-y-2">
          {notifs.map((n: any) => {
            const Icon = NOTIF_ICONS[n.type] || Bell;
            return (
              <button
                key={n.id}
                onClick={() => !n.is_read && markOne(n.id)}
                className={`w-full text-left card !rounded-xl px-4 py-3.5 flex items-start gap-3.5 transition-colors ${n.is_read ? 'opacity-70' : 'border-l-4 !border-l-gold-500'}`}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${n.is_read ? 'bg-stone-100 text-stone-400' : 'bg-navy-50 text-navy-700'}`}>
                  <Icon size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm ${n.is_read ? 'font-semibold text-stone-600' : 'font-extrabold text-navy-900'}`}>{n.title}</p>
                  <p className="text-xs text-stone-500 leading-relaxed mt-0.5">{n.message}</p>
                </div>
                <span className="text-[10px] text-stone-400 shrink-0 mt-1">{timeAgo(n.created_at)}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function WatchlistPanel() {
  const { token } = useAuth();
  const [listings, setListings] = useState<any[] | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const d = await apiFetch('/api/watchlist', { token });
      setListings(d.listings || []);
    } catch {
      setListings([]);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const remove = async (id: string) => {
    await apiFetch('/api/watchlist', { method: 'POST', body: { listing_id: id }, token }).catch(() => {});
    load();
  };

  if (!listings) return <PageLoader />;

  return (
    <div>
      <h2 className="text-xl font-extrabold text-navy-900">Watchlist</h2>
      <p className="text-sm text-stone-500 mb-5">Materials you bookmarked — tap the heart on any listing to save it here.</p>
      {listings.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Heart}
            title="Watchlist is empty"
            message="Save listings you are evaluating and compare them here before committing."
            action={<Link to="/browse" className="btn btn-navy">Discover materials</Link>}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {listings.map((l) => (
            <div key={l.id} className="relative">
              <ListingCard listing={l} />
              <button
                onClick={() => remove(l.id)}
                className="absolute top-2.5 right-2.5 w-8 h-8 rounded-lg bg-white/95 shadow flex items-center justify-center text-red-500 hover:bg-red-50 transition-colors"
                title="Remove from watchlist"
              >
                <Heart size={15} fill="currentColor" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ProfilePanel() {
  const { profile, token, refreshProfile } = useAuth();
  const [form, setForm] = useState({ full_name: '', company_name: '', phone: '', city: 'Addis Ababa' });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name || '',
        company_name: profile.company_name || '',
        phone: profile.phone || '',
        city: profile.city || 'Addis Ababa',
      });
    }
  }, [profile]);

  if (!profile) return <PageLoader />;

  const save = async () => {
    if (!form.full_name.trim()) {
      setError('Full name is required.');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await apiFetch('/api/profiles', { method: 'PUT', body: form, token });
      await refreshProfile();
      setNotice('Profile updated successfully.');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-2 gap-6 items-start">
      <div className="card p-6">
        <h2 className="text-xl font-extrabold text-navy-900 mb-1">Edit Profile</h2>
        <p className="text-sm text-stone-500 mb-5">This info shows on your public seller profile and in chats.</p>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-stone-500 mb-1 block">Full name *</label>
            <input value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} className="input" />
          </div>
          <div>
            <label className="text-xs font-bold text-stone-500 mb-1 block">Company / trade name</label>
            <input value={form.company_name} onChange={(e) => setForm((f) => ({ ...f, company_name: e.target.value }))} className="input" />
          </div>
          <div>
            <label className="text-xs font-bold text-stone-500 mb-1 block">Phone</label>
            <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className="input" placeholder="+251 9…" />
          </div>
          <div>
            <label className="text-xs font-bold text-stone-500 mb-1 block">City</label>
            <select value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} className="input">
              {CITIES.map((c) => <option key={c.name} value={c.name}>{c.name}, {c.region}</option>)}
            </select>
          </div>
          {error && <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3.5 py-2.5">{error}</div>}
          {notice && <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3.5 py-2.5">{notice}</div>}
          <button onClick={save} disabled={busy} className="btn btn-navy w-full">
            <Save size={16} /> {busy ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="card p-6">
          <h3 className="font-extrabold text-navy-900 mb-4">Account</h3>
          <div className="flex items-center gap-4">
            <Avatar name={profile.company_name || profile.full_name} size={56} />
            <div>
              <p className="font-extrabold text-navy-900">{profile.company_name || profile.full_name}</p>
              <p className="text-sm text-stone-500 flex items-center gap-1.5"><Mail size={13} /> {profile.email}</p>
              <p className="text-sm text-stone-500 flex items-center gap-1.5 mt-0.5"><MapPin size={13} /> {profile.city || 'Location not set'}</p>
            </div>
          </div>
          <div className="mt-5 space-y-2.5 text-sm">
            <div className="flex justify-between"><span className="text-stone-500">Role</span><Chip meta={{ label: ROLE_LABELS[profile.role] || profile.role, classes: 'bg-gold-100 text-gold-700' }} /></div>
            <div className="flex justify-between"><span className="text-stone-500">KYC status</span><Chip meta={profile.kyc_status === 'VERIFIED' ? { label: 'Verified', classes: 'bg-emerald-100 text-emerald-800' } : { label: 'Unverified', classes: 'bg-stone-200 text-stone-600' }} /></div>
            <div className="flex justify-between"><span className="text-stone-500">Rating</span><span className="inline-flex items-center gap-1.5"><Stars value={profile.rating_avg} size={13} /><b>{Number(profile.rating_avg || 0).toFixed(1)}</b> ({profile.rating_count || 0})</span></div>
            <div className="flex justify-between"><span className="text-stone-500">Completed orders</span><b className="text-navy-800">{profile.total_transactions || 0}</b></div>
            <div className="flex justify-between"><span className="text-stone-500">Member since</span><b className="text-navy-800">{fmtDate(profile.created_at)}</b></div>
          </div>
        </div>

        <div className="card p-5 flex items-start gap-3">
          <UserRound size={20} className="text-navy-600 shrink-0 mt-0.5" />
          <p className="text-xs text-stone-500 leading-relaxed">
            <b className="text-navy-800">Need a different role?</b> Verification and delivery agents are onboarded by the SurplusSell
            team after background checks and training — contact support@surplussell.et from your registered email.
          </p>
        </div>

        <Link to={`/seller/${profile.id}`} className="btn btn-outline w-full">
          View my public profile
        </Link>
      </div>
    </div>
  );
}
