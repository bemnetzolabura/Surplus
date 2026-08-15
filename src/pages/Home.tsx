import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight, BadgeCheck, Building2, ClipboardCheck, Handshake, History, MapPin, PackageCheck,
  Search, ShieldCheck, Star, TrendingUp, Truck,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { compactETB, formatETB } from '../lib/format';
import { getRecent, type RecentItem } from '../lib/recent';
import ListingCard from '../components/ListingCard';
import { CategoryIcon, SkeletonCard } from '../components/ui';

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center sm:text-left">
      <p className="text-2xl sm:text-3xl font-extrabold text-white">{value}</p>
      <p className="text-xs sm:text-sm text-navy-200 font-medium mt-0.5">{label}</p>
    </div>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [stats, setStats] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [featured, setFeatured] = useState<any[]>([]);
  const [loadingFeatured, setLoadingFeatured] = useState(true);
  const [recent, setRecent] = useState<RecentItem[]>([]);

  useEffect(() => {
    setRecent(getRecent());
  }, []);

  useEffect(() => {
    apiFetch('/api/stats').then(setStats).catch(() => {});
    apiFetch('/api/categories').then(setCategories).catch(() => {});
    apiFetch('/api/listings?featured=true&limit=4')
      .then((d) => setFeatured(d.listings || []))
      .catch(() => {})
      .finally(() => setLoadingFeatured(false));
  }, []);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(q.trim() ? `/browse?q=${encodeURIComponent(q.trim())}` : '/browse');
  };

  return (
    <div>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <img src="/images/hero.jpg" alt="Construction site at sunset" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 hero-overlay" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-16 pb-20 sm:pt-24 sm:pb-28">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="max-w-2xl">
            <span className="inline-flex items-center gap-2 bg-gold-500/15 border border-gold-500/40 text-gold-300 rounded-full px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider">
              <ShieldCheck size={13} /> Escrow-protected marketplace · Ethiopia
            </span>
            <h1 className="mt-5 text-4xl sm:text-5xl lg:text-[3.4rem] font-extrabold text-white leading-[1.08] tracking-tight text-balance">
              Turn surplus materials into <span className="text-gold-400">working capital</span>.
            </h1>
            <p className="mt-5 text-base sm:text-lg text-navy-100 leading-relaxed max-w-xl">
              Buy and sell verified cement, rebar, steel, lumber and more — 15–40% below retail,
              with physical inspection and escrow payment protection on every deal.
            </p>

            <form onSubmit={submitSearch} className="mt-8">
              <div className="flex bg-white rounded-2xl sm:rounded-full p-1.5 shadow-2xl max-w-xl">
                <div className="relative flex-1">
                  <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="What material are you looking for?"
                    className="w-full bg-transparent outline-none pl-10 pr-3 py-2.5 text-sm text-stone-800 placeholder:text-stone-400"
                  />
                </div>
                <button type="submit" className="btn btn-gold !rounded-xl sm:!rounded-full !px-6">
                  Search
                </button>
              </div>
            </form>

            <div className="mt-9 grid grid-cols-2 sm:grid-cols-4 gap-5 max-w-xl">
              <Stat value={stats ? String(stats.active_listings) + '+' : '—'} label="Active listings" />
              <Stat value={stats ? String(stats.sellers) : '—'} label="Material suppliers" />
              <Stat value={stats ? compactETB(stats.gmv) : '—'} label="Traded via escrow" />
              <Stat value={stats ? String(stats.cities) : '—'} label="Cities covered" />
            </div>
          </motion.div>
        </div>
      </section>

      {/* TRUST STRIP */}
      <section className="border-b border-stone-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 grid grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            { icon: ShieldCheck, title: 'Escrow protection', text: 'Funds held safely until you confirm delivery' },
            { icon: BadgeCheck, title: 'Physical verification', text: 'Field agents inspect quantity & condition' },
            { icon: Star, title: 'Rated traders', text: 'Transparent reviews after every transaction' },
            { icon: TrendingUp, title: 'Live price index', text: 'Real market prices across Ethiopian cities' },
          ].map((f) => (
            <div key={f.title} className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-navy-50 text-navy-800 flex items-center justify-center shrink-0">
                <f.icon size={19} />
              </div>
              <div>
                <p className="text-sm font-bold text-navy-900">{f.title}</p>
                <p className="text-xs text-stone-500 mt-0.5 leading-relaxed">{f.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CATEGORIES */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-14">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-navy-900 tracking-tight">Browse by category</h2>
            <p className="text-stone-500 text-sm mt-1">Every major construction material class, in one place.</p>
          </div>
          <Link to="/browse" className="hidden sm:inline-flex items-center gap-1.5 text-sm font-bold text-navy-700 hover:text-gold-600 transition-colors">
            View all <ArrowRight size={15} />
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {categories.map((c, i) => (
            <motion.div key={c.slug} initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.04, duration: 0.35 }}>
              <Link to={`/browse?category=${c.slug}`} className="card p-4 flex flex-col items-center text-center gap-2.5 hover:shadow-md hover:border-gold-300 hover:-translate-y-0.5 transition-all h-full">
                <div className="w-12 h-12 rounded-2xl bg-navy-800 text-gold-400 flex items-center justify-center">
                  <CategoryIcon slug={c.slug} size={22} />
                </div>
                <div>
                  <p className="text-sm font-bold text-navy-900 leading-tight">{c.name}</p>
                  {c.name_am && <p className="text-[11px] text-stone-400 mt-0.5">{c.name_am}</p>}
                </div>
                {stats?.price_index?.find((p: any) => p.category === c.slug) && (
                  <span className="text-[11px] font-semibold bg-stone-100 text-stone-600 rounded-full px-2 py-0.5">
                    {stats.price_index.find((p: any) => p.category === c.slug).count} listings
                  </span>
                )}
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* FEATURED LISTINGS */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-14">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-navy-900 tracking-tight">Featured surplus deals</h2>
            <p className="text-stone-500 text-sm mt-1">Hand-picked verified inventory from top-rated suppliers.</p>
          </div>
          <Link to="/browse" className="hidden sm:inline-flex items-center gap-1.5 text-sm font-bold text-navy-700 hover:text-gold-600 transition-colors">
            Browse all <ArrowRight size={15} />
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {loadingFeatured
            ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
            : featured.map((l) => <ListingCard key={l.id} listing={l} />)}
        </div>
        {!loadingFeatured && featured.length === 0 && (
          <div className="card p-10 text-center text-stone-500 text-sm">No featured listings right now. Check back soon.</div>
        )}
      </section>

      {/* RECENTLY VIEWED */}
      {recent.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-14">
          <h2 className="text-xl font-extrabold text-navy-900 tracking-tight flex items-center gap-2 mb-5">
            <History size={19} className="text-navy-600" /> Recently viewed
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
            {recent.map((r) => (
              <Link key={r.id} to={`/listing/${r.id}`} className="card shrink-0 w-60 p-3 flex items-center gap-3 hover:shadow-md transition-shadow">
                {r.img ? (
                  <img src={r.img} alt="" className="w-16 h-14 rounded-lg object-cover shrink-0" />
                ) : (
                  <div className="w-16 h-14 rounded-lg bg-navy-50 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-xs font-bold text-navy-900 line-clamp-2 leading-snug">{r.title}</p>
                  <p className="text-xs text-gold-700 font-extrabold mt-1">{formatETB(r.price)} <span className="text-stone-400 font-medium">/ {r.unit}</span></p>
                  <p className="text-[10px] text-stone-400">{r.city}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="max-w-7xl mx-auto px-4 sm:px-6 pt-16">
        <div className="text-center max-w-xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-navy-900 tracking-tight">How SurplusSell works</h2>
          <p className="text-stone-500 text-sm mt-2">A trust-first trading flow built for Ethiopia's construction industry — from listing to released funds.</p>
        </div>
        <div className="mt-10 grid md:grid-cols-3 gap-5">
          {[
            {
              icon: ClipboardCheck, step: '01', title: 'List or find surplus',
              text: 'Sellers post idle inventory in minutes. Buyers search real stock across cities with live market prices and condition grades.',
            },
            {
              icon: ShieldCheck, step: '02', title: 'Verify & pay into escrow',
              text: 'Field agents can inspect materials physically. Buyer payment is locked in SurplusSell escrow — never direct to strangers.',
            },
            {
              icon: PackageCheck, step: '03', title: 'Deliver & release funds',
              text: 'Materials are dispatched, buyer confirms receipt, and escrow releases instantly — minus a small 6% platform commission.',
            },
          ].map((s, i) => (
            <motion.div key={s.step} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1, duration: 0.45 }} className="card p-7 relative overflow-hidden">
              <span className="absolute -top-3 -right-1 text-[88px] font-black text-navy-50 select-none">{s.step}</span>
              <div className="relative">
                <div className="w-12 h-12 rounded-2xl bg-gold-500 text-navy-900 flex items-center justify-center">
                  <s.icon size={22} />
                </div>
                <h3 className="mt-4 text-lg font-extrabold text-navy-900">{s.title}</h3>
                <p className="mt-2 text-sm text-stone-500 leading-relaxed">{s.text}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* PRICE INDEX */}
      <section id="price-index" className="max-w-7xl mx-auto px-4 sm:px-6 pt-16">
        <div className="card overflow-hidden">
          <div className="grid lg:grid-cols-5">
            <div className="lg:col-span-2 bg-navy-900 text-white p-8 lg:p-10 flex flex-col justify-between relative overflow-hidden">
              <div className="absolute -bottom-10 -right-10 w-48 h-48 rounded-full bg-gold-500/10" />
              <div className="relative">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-gold-400">
                  <TrendingUp size={13} /> Live market data
                </span>
                <h2 className="mt-3 text-2xl sm:text-3xl font-extrabold tracking-tight">Ethiopian construction price index</h2>
                <p className="mt-3 text-sm text-navy-200 leading-relaxed">
                  Average asking prices computed in real time from active marketplace listings.
                  Know the fair price before you negotiate.
                </p>
              </div>
              <Link to="/browse" className="relative mt-8 btn btn-gold w-fit">
                Trade at market prices <ArrowRight size={15} />
              </Link>
            </div>
            <div className="lg:col-span-3 p-6 sm:p-8">
              <div className="grid sm:grid-cols-2 gap-x-8 gap-y-1">
                {(stats?.price_index || []).slice(0, 10).map((row: any) => {
                  const cat = categories.find((c) => c.slug === row.category);
                  return (
                    <Link to={`/browse?category=${row.category}`} key={row.category} className="flex items-center gap-3 py-3 border-b border-stone-100 group">
                      <div className="w-9 h-9 rounded-xl bg-navy-50 text-navy-700 flex items-center justify-center shrink-0">
                        <CategoryIcon slug={row.category} size={17} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-navy-900 truncate group-hover:text-gold-600 transition-colors">{cat?.name || row.category}</p>
                        <p className="text-[11px] text-stone-400">{row.count} active listings</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-extrabold text-navy-800">{formatETB(row.avg_price)}</p>
                        <p className="text-[11px] text-stone-400">per {row.unit}</p>
                      </div>
                    </Link>
                  );
                })}
                {!stats && <div className="col-span-2 py-10 text-center text-stone-400 text-sm">Loading market data…</div>}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-16">
        <div className="grid md:grid-cols-2 gap-5">
          <motion.div initial={{ opacity: 0, x: -18 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} className="card p-8 sm:p-10 bg-gradient-to-br from-navy-900 to-navy-700 !border-navy-800 text-white relative overflow-hidden">
            <Truck className="absolute -bottom-6 -right-6 text-navy-700/60" size={150} />
            <div className="relative">
              <Handshake size={26} className="text-gold-400" />
              <h3 className="mt-4 text-2xl font-extrabold tracking-tight">Have surplus sitting at your yard?</h3>
              <p className="mt-2 text-sm text-navy-100 leading-relaxed max-w-sm">
                Idle cement, rebar and formwork tie up capital. List them free and reach 50,000+ contractors — payment guaranteed through escrow.
              </p>
              <Link to="/auth?register=seller" className="mt-6 btn btn-gold">
                Start selling free <ArrowRight size={15} />
              </Link>
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, x: 18 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} className="card p-8 sm:p-10 relative overflow-hidden">
            <Building2 className="absolute -bottom-6 -right-6 text-stone-100" size={150} />
            <div className="relative">
              <MapPin size={26} className="text-navy-700" />
              <h3 className="mt-4 text-2xl font-extrabold text-navy-900 tracking-tight">Sourcing for your next project?</h3>
              <p className="mt-2 text-sm text-stone-500 leading-relaxed max-w-sm">
                Cut material costs 15–40% with inspected surplus stock in Addis Ababa, Hawassa, Adama, Bahir Dar and beyond.
              </p>
              <Link to="/browse" className="mt-6 btn btn-navy">
                Browse materials <ArrowRight size={15} />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
