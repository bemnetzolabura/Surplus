import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BookmarkPlus, CheckCircle2, Filter, PackageSearch, ShieldCheck, SlidersHorizontal, X } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { CITIES, CONDITIONS } from '../lib/constants';
import { useAuth } from '../contexts/AuthContext';
import ListingCard from '../components/ListingCard';
import { CategoryIcon, EmptyState, Modal, SkeletonCard } from '../components/ui';

const PAGE = 12;

export default function Browse() {
  const [params, setParams] = useSearchParams();
  const { token } = useAuth();
  const [categories, setCategories] = useState<any[]>([]);
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [mobileFilters, setMobileFilters] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [saveErr, setSaveErr] = useState('');

  const filters = useMemo(() => ({
    q: params.get('q') || '',
    category: params.get('category') || '',
    condition: params.get('condition') || '',
    city: params.get('city') || '',
    min: params.get('min') || '',
    max: params.get('max') || '',
    verified: params.get('verified') === 'true',
    negotiable: params.get('negotiable') === 'true',
    sort: params.get('sort') || 'newest',
  }), [params]);

  const [searchInput, setSearchInput] = useState(filters.q);
  useEffect(() => setSearchInput(filters.q), [filters.q]);

  useEffect(() => {
    apiFetch('/api/categories').then(setCategories).catch(() => {});
  }, []);

  const buildQuery = useCallback((off: number) => {
    const sp = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v && v !== 'newest') sp.set(k, String(v));
    });
    sp.set('limit', String(PAGE));
    sp.set('offset', String(off));
    return sp.toString();
  }, [filters]);

  const load = useCallback(async (off: number, append: boolean) => {
    setLoading(true);
    try {
      const d = await apiFetch(`/api/listings?${buildQuery(off)}`);
      setListings((prev) => (append ? [...prev, ...(d.listings || [])] : d.listings || []));
      setHasMore(!!d.hasMore);
      setOffset(off);
    } catch {
      if (!append) setListings([]);
    } finally {
      setLoading(false);
    }
  }, [buildQuery]);

  useEffect(() => {
    load(0, false);
  }, [load]);

  const setFilter = (key: string, value: string | boolean) => {
    const next = new URLSearchParams(params);
    if (value === '' || value === false || value === 'newest') next.delete(key);
    else next.set(key, String(value));
    setParams(next, { replace: false });
  };

  const clearAll = () => setParams(new URLSearchParams(), { replace: false });

  const activeCount = [filters.q, filters.category, filters.condition, filters.city, filters.min, filters.max, filters.verified, filters.negotiable].filter(Boolean).length;

  const FiltersPanel = (
    <div className="space-y-6">
      <div>
        <h4 className="text-xs font-extrabold uppercase tracking-wider text-stone-400 mb-3">Category</h4>
        <div className="space-y-1">
          <button onClick={() => setFilter('category', '')} className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${!filters.category ? 'bg-navy-800 text-white' : 'text-stone-600 hover:bg-stone-100'}`}>
            <PackageSearch size={16} /> All materials
          </button>
          {categories.map((c) => (
            <button key={c.slug} onClick={() => setFilter('category', filters.category === c.slug ? '' : c.slug)} className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${filters.category === c.slug ? 'bg-navy-800 text-white' : 'text-stone-600 hover:bg-stone-100'}`}>
              <CategoryIcon slug={c.slug} size={16} /> {c.name}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h4 className="text-xs font-extrabold uppercase tracking-wider text-stone-400 mb-3">Condition</h4>
        <div className="flex flex-wrap gap-1.5">
          {CONDITIONS.map((c) => (
            <button key={c.value} onClick={() => setFilter('condition', filters.condition === c.value ? '' : c.value)} className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${filters.condition === c.value ? 'bg-navy-800 text-white border-navy-800' : 'border-stone-200 text-stone-600 hover:border-navy-400'}`}>
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h4 className="text-xs font-extrabold uppercase tracking-wider text-stone-400 mb-3">City</h4>
        <select value={filters.city} onChange={(e) => setFilter('city', e.target.value)} className="input">
          <option value="">All cities</option>
          {CITIES.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
        </select>
      </div>

      <div>
        <h4 className="text-xs font-extrabold uppercase tracking-wider text-stone-400 mb-3">Price per unit (ETB)</h4>
        <div className="flex items-center gap-2">
          <input type="number" min="0" placeholder="Min" value={filters.min} onChange={(e) => setFilter('min', e.target.value)} className="input" />
          <span className="text-stone-400">—</span>
          <input type="number" min="0" placeholder="Max" value={filters.max} onChange={(e) => setFilter('max', e.target.value)} className="input" />
        </div>
      </div>

      <div className="space-y-2.5">
        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <input type="checkbox" checked={filters.verified} onChange={(e) => setFilter('verified', e.target.checked)} className="w-4 h-4 accent-[#1e3a5f]" />
          <span className="text-sm font-semibold text-stone-700 inline-flex items-center gap-1.5"><ShieldCheck size={15} className="text-emerald-600" /> Verified only</span>
        </label>
        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <input type="checkbox" checked={filters.negotiable} onChange={(e) => setFilter('negotiable', e.target.checked)} className="w-4 h-4 accent-[#1e3a5f]" />
          <span className="text-sm font-semibold text-stone-700">Price negotiable</span>
        </label>
      </div>

      {activeCount > 0 && (
        <div className="space-y-2">
          {token && (
            <button
              onClick={() => {
                const catName = categories.find((c) => c.slug === filters.category)?.name;
                setSaveName([filters.q ? `"${filters.q}"` : '', catName || '', filters.city].filter(Boolean).join(' · ') || 'My search');
                setSaveErr('');
                setSaveOpen(true);
              }}
              className="btn btn-gold w-full !justify-center text-sm"
            >
              <BookmarkPlus size={15} /> Save this search
            </button>
          )}
          {saveMsg && <p className="text-xs font-bold text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2 flex items-center gap-1.5"><CheckCircle2 size={13} /> {saveMsg}</p>}
          <button onClick={clearAll} className="btn btn-ghost w-full text-red-600 !justify-center hover:!bg-red-50">
            <X size={15} /> Clear all filters
          </button>
        </div>
      )}
    </div>
  );

  const saveSearch = async () => {
    setSaveBusy(true);
    setSaveErr('');
    try {
      const filtersToSave: Record<string, unknown> = {};
      if (filters.q) filtersToSave.q = filters.q;
      if (filters.category) filtersToSave.category = filters.category;
      if (filters.condition) filtersToSave.condition = filters.condition;
      if (filters.city) filtersToSave.city = filters.city;
      if (filters.min) filtersToSave.min = filters.min;
      if (filters.max) filtersToSave.max = filters.max;
      if (filters.verified) filtersToSave.verified = true;
      if (filters.negotiable) filtersToSave.negotiable = true;
      await apiFetch('/api/searches', { method: 'POST', body: { name: saveName, filters: filtersToSave }, token });
      setSaveOpen(false);
      setSaveMsg('Search saved — new matches will alert in your dashboard.');
      setTimeout(() => setSaveMsg(''), 5000);
    } catch (e: any) {
      setSaveErr(e.message);
    } finally {
      setSaveBusy(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar */}
        <aside className="hidden lg:block w-64 shrink-0">
          <div className="card p-5 sticky top-24">
            <div className="flex items-center gap-2 mb-5">
              <SlidersHorizontal size={16} className="text-navy-800" />
              <h3 className="font-extrabold text-navy-900">Filters</h3>
              {activeCount > 0 && <span className="ml-auto text-xs font-bold bg-gold-500 text-navy-900 rounded-full px-2 py-0.5">{activeCount}</span>}
            </div>
            {FiltersPanel}
          </div>
        </aside>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-3 mb-5">
            <form onSubmit={(e) => { e.preventDefault(); setFilter('q', searchInput.trim()); }} className="flex-1 min-w-[220px]">
              <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search listings…" className="input" />
            </form>
            <select value={filters.sort} onChange={(e) => setFilter('sort', e.target.value)} className="input !w-auto">
              <option value="newest">Newest first</option>
              <option value="price_asc">Price: low to high</option>
              <option value="price_desc">Price: high to low</option>
              <option value="popular">Most viewed</option>
            </select>
            <button onClick={() => setMobileFilters(true)} className="lg:hidden btn btn-outline !py-2.5">
              <Filter size={15} /> Filters {activeCount > 0 && `(${activeCount})`}
            </button>
          </div>

          <p className="text-sm text-stone-500 mb-4">
            <span className="font-bold text-navy-800">{listings.length}</span> {listings.length === 1 ? 'listing' : 'listings'} found
            {filters.q && <> for <span className="font-semibold text-navy-700">“{filters.q}”</span></>}
          </p>

          {loading && listings.length === 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : listings.length === 0 ? (
            <div className="card">
              <EmptyState
                icon={PackageSearch}
                title="No materials match your search"
                message="Try widening the price range, removing filters, or searching another material term."
                action={<button onClick={clearAll} className="btn btn-navy">Clear filters</button>}
              />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {listings.map((l) => <ListingCard key={l.id} listing={l} />)}
              </div>
              {hasMore && (
                <div className="text-center mt-8">
                  <button onClick={() => load(offset + PAGE, true)} disabled={loading} className="btn btn-outline !px-8">
                    {loading ? 'Loading…' : 'Load more listings'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Mobile filter drawer */}
      {mobileFilters && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-navy-950/60" onClick={() => setMobileFilters(false)} />
          <div className="absolute inset-y-0 left-0 w-[85%] max-w-sm bg-white shadow-2xl overflow-y-auto p-5">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-extrabold text-navy-900">Filters</h3>
              <button onClick={() => setMobileFilters(false)} className="w-9 h-9 rounded-lg hover:bg-stone-100 flex items-center justify-center">
                <X size={18} />
              </button>
            </div>
            {FiltersPanel}
            <button onClick={() => setMobileFilters(false)} className="btn btn-navy w-full mt-6">Show results</button>
          </div>
        </div>
      )}

      {/* Save search modal */}
      <Modal open={saveOpen} onClose={() => !saveBusy && setSaveOpen(false)} title="Save this search">
        <p className="text-sm text-stone-500 leading-relaxed">
          We will watch for new listings matching your current filters and flag them in your dashboard.
        </p>
        <label className="text-xs font-bold text-stone-500 mt-4 mb-1 block">Search name</label>
        <input value={saveName} onChange={(e) => setSaveName(e.target.value)} className="input" placeholder="e.g. Cement under 1,200 in Addis" />
        {saveErr && <div className="mt-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3.5 py-2.5">{saveErr}</div>}
        <button onClick={saveSearch} disabled={saveBusy || !saveName.trim()} className="btn btn-navy w-full mt-4">
          {saveBusy ? 'Saving…' : 'Save search'}
        </button>
      </Modal>
    </div>
  );
}
