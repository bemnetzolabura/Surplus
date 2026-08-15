import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BellRing, Play, SearchCheck, Trash2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { apiFetch } from '../../lib/api';
import { CONDITIONS } from '../../lib/constants';
import { fmtDate } from '../../lib/format';
import { EmptyState, PageLoader } from '../../components/ui';

function filterSummary(filters: any, categories: any[]): string {
  const parts: string[] = [];
  if (filters.q) parts.push(`"${filters.q}"`);
  if (filters.category) parts.push(categories.find((c) => c.slug === filters.category)?.name || filters.category);
  if (filters.condition) parts.push(CONDITIONS.find((c) => c.value === filters.condition)?.label || filters.condition);
  if (filters.city) parts.push(filters.city);
  if (filters.min || filters.max) parts.push(`${filters.min || '0'}\u2013${filters.max || '\u221e'} ETB`);
  if (filters.verified) parts.push('Verified only');
  if (filters.negotiable) parts.push('Negotiable');
  return parts.join(' \u00b7 ') || 'All listings';
}

function buildUrl(filters: any): string {
  const sp = new URLSearchParams();
  Object.entries(filters || {}).forEach(([k, v]) => {
    if (v !== '' && v !== false && v != null) sp.set(k, String(v));
  });
  return `/browse?${sp.toString()}`;
}

export default function SearchesPanel() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [searches, setSearches] = useState<any[] | null>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const d = await apiFetch('/api/searches', { token });
      setSearches(d || []);
    } catch {
      setSearches([]);
    }
  }, [token]);

  useEffect(() => {
    load();
    apiFetch('/api/categories').then(setCategories).catch(() => {});
  }, [load]);

  const remove = async (id: string) => {
    setBusyId(id);
    await apiFetch('/api/searches', { method: 'DELETE', body: { id }, token }).catch(() => {});
    setBusyId('');
    load();
  };

  if (!searches) return <PageLoader />;

  const totalNew = searches.reduce((s, x) => s + (x.new_count || 0), 0);

  return (
    <div>
      <h2 className="text-xl font-extrabold text-navy-900">Saved Searches</h2>
      <p className="text-sm text-stone-500 mb-5">
        We track new listings against your saved filters. {totalNew > 0 ? <b className="text-gold-700">{totalNew} new match{totalNew === 1 ? '' : 'es'} waiting!</b> : 'Save filters from the Browse page to get alerts.'}
      </p>

      {searches.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={SearchCheck}
            title="No saved searches yet"
            message="Apply filters on the Browse page and tap 'Save this search' — new matching stock will ping here."
            action={<Link to="/browse" className="btn btn-navy">Browse materials</Link>}
          />
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {searches.map((s) => (
            <div key={s.id} className="card p-5 flex flex-col">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-extrabold text-navy-900">{s.name}</h3>
                  <p className="text-xs text-stone-500 mt-1 leading-relaxed">{filterSummary(s.filters, categories)}</p>
                </div>
                {(s.new_count || 0) > 0 && (
                  <span className="shrink-0 inline-flex items-center gap-1.5 bg-gold-500 text-navy-900 rounded-full px-3 py-1.5 text-xs font-extrabold">
                    <BellRing size={12} /> {s.new_count} new
                  </span>
                )}
              </div>
              <p className="text-[11px] text-stone-400 mt-2">Saved {fmtDate(s.created_at)}</p>
              <div className="mt-4 pt-4 border-t border-stone-100 flex gap-2">
                <button
                  onClick={() => {
                    // Running the search resets the "new" window naturally over time
                    navigate(buildUrl(s.filters));
                  }}
                  className="btn btn-navy flex-1 !py-2 text-xs"
                >
                  <Play size={13} /> Run search
                </button>
                <button onClick={() => remove(s.id)} disabled={busyId === s.id} className="btn btn-ghost !py-2 text-xs text-red-500 hover:!bg-red-50">
                  <Trash2 size={13} /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
