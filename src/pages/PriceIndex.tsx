import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BarChart3, Building2, Clock3, MapPin, TrendingUp } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { compactETB, formatETB } from '../lib/format';
import { CategoryIcon, PageLoader } from '../components/ui';

export default function PriceIndex() {
  const [stats, setStats] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);

  useEffect(() => {
    apiFetch('/api/stats').then(setStats).catch(() => {});
    apiFetch('/api/categories').then(setCategories).catch(() => {});
  }, []);

  if (!stats) return <PageLoader label="Computing live market prices…" />;

  const rows = stats.price_index || [];
  const globalAvg = rows.length ? rows.reduce((s: number, r: any) => s + r.avg_price, 0) / rows.length : 0;

  return (
    <div>
      {/* Header */}
      <section className="bg-navy-900 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-15" style={{ backgroundImage: 'radial-gradient(circle at 75% 25%, #E8B931 0%, transparent 45%)' }} />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-14 sm:py-16">
          <span className="inline-flex items-center gap-2 bg-gold-500/15 border border-gold-500/40 text-gold-300 rounded-full px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider">
            <TrendingUp size={13} /> Live market transparency
          </span>
          <h1 className="mt-4 text-3xl sm:text-4xl font-extrabold tracking-tight max-w-2xl text-balance">
            Ethiopian construction price index
          </h1>
          <p className="mt-3 text-navy-100 text-sm sm:text-base max-w-2xl leading-relaxed">
            Real-time asking prices computed from every active listing on SurplusSell.
            Never negotiate blind again — know the fair price before you make the call.
          </p>
          <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl">
            {[
              { icon: BarChart3, label: 'Categories tracked', value: String(rows.length) },
              { icon: TrendingUp, label: 'Active listings priced', value: String(stats.active_listings) },
              { icon: MapPin, label: 'Cities covered', value: String(stats.cities) },
              { icon: Clock3, label: 'Updated', value: 'Real-time' },
            ].map((c) => (
              <div key={c.label} className="bg-navy-800/60 border border-navy-700 rounded-2xl px-4 py-4">
                <c.icon size={17} className="text-gold-400" />
                <p className="mt-2 text-xl font-extrabold">{c.value}</p>
                <p className="text-[11px] text-navy-200 font-medium">{c.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        {/* Index table */}
        <div className="card overflow-hidden">
          <div className="hidden md:grid grid-cols-[1.6fr_0.8fr_2fr_0.7fr_0.5fr] gap-4 px-6 py-3.5 bg-sand-50 border-b border-stone-200 text-[11px] font-extrabold uppercase tracking-widest text-stone-400">
            <span>Material category</span>
            <span>Basis</span>
            <span>Price range (ETB)</span>
            <span className="text-right">Avg price</span>
            <span className="text-right">Trade</span>
          </div>
          {rows.map((row: any) => {
            const cat = categories.find((c) => c.slug === row.category);
            const range = Math.max(row.max_price - row.min_price, 1);
            const avgPos = Math.min(96, Math.max(4, ((row.avg_price - row.min_price) / range) * 100));
            const vsGlobal = globalAvg ? ((row.avg_price - globalAvg) / globalAvg) * 100 : 0;
            return (
              <div key={row.category} className="grid md:grid-cols-[1.6fr_0.8fr_2fr_0.7fr_0.5fr] gap-4 items-center px-6 py-5 border-b border-stone-100 hover:bg-stone-50/60 transition-colors">
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-xl bg-navy-800 text-gold-400 flex items-center justify-center shrink-0">
                    <CategoryIcon slug={row.category} size={20} />
                  </div>
                  <div>
                    <p className="font-extrabold text-navy-900">{cat?.name || row.category}</p>
                    {cat?.name_am && <p className="text-[11px] text-stone-400">{cat.name_am}</p>}
                  </div>
                  <span className="ml-2 hidden lg:inline-flex text-[11px] font-bold bg-stone-100 text-stone-500 rounded-full px-2.5 py-1">
                    {row.count} listings · {row.cities} {row.cities === 1 ? 'city' : 'cities'}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-bold text-stone-600">per {row.unit}</p>
                  <p className={`text-[11px] font-bold ${vsGlobal >= 0 ? 'text-emerald-600' : 'text-sky-600'}`}>
                    {vsGlobal >= 0 ? '+' : ''}{Math.round(vsGlobal)}% vs index
                  </p>
                </div>
                <div>
                  <div className="flex justify-between text-[11px] font-bold text-stone-400 mb-1.5">
                    <span>{compactETB(row.min_price)}</span>
                    <span className="text-navy-700">{formatETB(row.avg_price)}</span>
                    <span>{compactETB(row.max_price)}</span>
                  </div>
                  <div className="relative h-2 rounded-full bg-gradient-to-r from-sky-200 via-gold-400 to-red-300">
                    <span className="absolute -top-1 w-4 h-4 rounded-full bg-white border-[3px] border-navy-800 shadow" style={{ left: `calc(${avgPos}% - 8px)` }} />
                  </div>
                </div>
                <p className="text-lg font-extrabold text-navy-900 md:text-right">{formatETB(row.avg_price)}</p>
                <div className="md:text-right">
                  <Link to={`/browse?category=${row.category}`} className="btn btn-outline !py-2 !px-4 text-xs">
                    Trade <ArrowRight size={13} />
                  </Link>
                </div>
              </div>
            );
          })}
          {rows.length === 0 && (
            <p className="px-6 py-12 text-center text-stone-400 text-sm">No live market data yet — listings create the index.</p>
          )}
        </div>

        {/* City coverage */}
        {(stats.city_index || []).length > 0 && (
          <div className="mt-8 card p-6">
            <h3 className="font-extrabold text-navy-900 mb-4 flex items-center gap-2">
              <Building2 size={17} /> Supply by city
            </h3>
            <div className="flex flex-wrap gap-2.5">
              {stats.city_index.map((c: any) => (
                <Link key={c.city} to={`/browse?city=${encodeURIComponent(c.city)}`} className="inline-flex items-center gap-2 rounded-full border border-stone-200 px-4 py-2 text-sm font-semibold text-stone-600 hover:border-gold-400 hover:bg-gold-100/40 transition-colors">
                  <MapPin size={13} className="text-navy-600" />
                  {c.city}
                  <span className="text-xs font-bold text-gold-700">{c.count}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        <p className="mt-6 text-xs text-stone-400 leading-relaxed max-w-2xl">
          The index reflects asking prices from active listings (per dominant unit of each category) and refreshes on every page load.
          It is a negotiation compass, not a quote — final prices depend on quantity, condition and location.
        </p>
      </div>
    </div>
  );
}
