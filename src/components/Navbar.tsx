import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Bell, ChevronDown, LayoutDashboard, LogOut, Menu, MessageSquare, PlusCircle, Search, User, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiFetch } from '../lib/api';
import Logo from './Logo';
import { Avatar } from './ui';

export default function Navbar() {
  const { profile, token, signOut } = useAuth();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const [q, setQ] = useState('');
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!token) { setUnread(0); return; }
    let alive = true;
    const load = async () => {
      try {
        const d = await apiFetch('/api/notifications', { token });
        if (alive) setUnread(d.unread || 0);
      } catch { /* ignore */ }
    };
    load();
    const t = setInterval(load, 30000);
    return () => { alive = false; clearInterval(t); };
  }, [token]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenu(false);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(q.trim() ? `/browse?q=${encodeURIComponent(q.trim())}` : '/browse');
    setMenuOpen(false);
  };

  return (
    <header className="no-print sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-stone-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center gap-3 h-16">
          <Link to="/" className="shrink-0">
            <Logo size={34} />
          </Link>

          <form onSubmit={submitSearch} className="hidden md:flex flex-1 max-w-xl mx-2">
            <div className="relative w-full">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search cement, rebar, lumber, tiles…"
                className="input pl-9 pr-20 rounded-full bg-sand-50"
              />
              <button type="submit" className="absolute right-1 top-1/2 -translate-y-1/2 btn-navy btn !rounded-full !px-4 !py-1.5 text-xs">
                Search
              </button>
            </div>
          </form>

          <nav className="hidden lg:flex items-center gap-1 ml-auto">
            <NavLink to="/browse" className={({ isActive }) => `px-3 py-2 rounded-lg text-sm font-semibold ${isActive ? 'text-navy-800 bg-navy-50' : 'text-stone-600 hover:text-navy-800 hover:bg-stone-100'}`}>
              Browse
            </NavLink>
            <NavLink to="/price-index" className={({ isActive }) => `px-3 py-2 rounded-lg text-sm font-semibold ${isActive ? 'text-navy-800 bg-navy-50' : 'text-stone-600 hover:text-navy-800 hover:bg-stone-100'}`}>
              Price Index
            </NavLink>
            <a href="/#how-it-works" className="px-3 py-2 rounded-lg text-sm font-semibold text-stone-600 hover:text-navy-800 hover:bg-stone-100">
              How it works
            </a>
          </nav>

          <div className="flex items-center gap-1.5 ml-auto lg:ml-2">
            {profile ? (
              <>
                <Link to="/messages" className="relative w-10 h-10 rounded-xl hover:bg-stone-100 flex items-center justify-center text-stone-600" title="Messages">
                  <MessageSquare size={19} />
                </Link>
                <Link to="/dashboard?tab=notifications" className="relative w-10 h-10 rounded-xl hover:bg-stone-100 flex items-center justify-center text-stone-600" title="Notifications">
                  <Bell size={19} />
                  {unread > 0 && (
                    <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                      {unread > 9 ? '9+' : unread}
                    </span>
                  )}
                </Link>
                <Link to={profile.role === 'SELLER' ? '/dashboard?tab=my-listings' : '/auth?register=seller'} className="hidden sm:inline-flex btn btn-gold !py-2 ml-1">
                  <PlusCircle size={16} /> Sell
                </Link>
                <div className="relative" ref={userMenuRef}>
                  <button onClick={() => setUserMenu((v) => !v)} className="flex items-center gap-1.5 pl-1.5 pr-2 py-1.5 rounded-xl hover:bg-stone-100">
                    <Avatar name={profile.company_name || profile.full_name} size={30} />
                    <ChevronDown size={14} className="text-stone-400" />
                  </button>
                  {userMenu && (
                    <div className="absolute right-0 mt-2 w-60 card !rounded-xl overflow-hidden shadow-xl">
                      <div className="px-4 py-3 bg-navy-50 border-b border-stone-100">
                        <p className="font-bold text-sm text-navy-800 truncate">{profile.company_name || profile.full_name}</p>
                        <p className="text-xs text-stone-500 truncate">{profile.email}</p>
                        <span className="inline-block mt-1.5 text-[10px] font-bold uppercase tracking-wider bg-gold-100 text-gold-700 px-2 py-0.5 rounded-full">
                          {profile.role?.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="p-1.5">
                        <Link to="/dashboard" onClick={() => setUserMenu(false)} className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-stone-700 hover:bg-navy-50 hover:text-navy-800">
                          <LayoutDashboard size={16} /> Dashboard
                        </Link>
                        <Link to="/dashboard?tab=profile" onClick={() => setUserMenu(false)} className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-stone-700 hover:bg-navy-50 hover:text-navy-800">
                          <User size={16} /> My Profile
                        </Link>
                        <button
                          onClick={async () => { setUserMenu(false); await signOut(); navigate('/'); }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50"
                        >
                          <LogOut size={16} /> Sign out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link to="/auth" className="btn btn-outline !py-2 hidden sm:inline-flex">Sign in</Link>
                <Link to="/auth?register=1" className="btn btn-navy !py-2">Join free</Link>
              </>
            )}
            <button onClick={() => setMenuOpen((v) => !v)} className="lg:hidden w-10 h-10 rounded-xl hover:bg-stone-100 flex items-center justify-center text-stone-600">
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </div>

      {menuOpen && (
        <div className="lg:hidden border-t border-stone-100 bg-white px-4 py-3 space-y-2">
          <form onSubmit={submitSearch} className="md:hidden">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search materials…" className="input pl-9" />
            </div>
          </form>
          <Link to="/browse" onClick={() => setMenuOpen(false)} className="block px-3 py-2.5 rounded-lg font-semibold text-stone-700 hover:bg-navy-50">Browse listings</Link>
          <Link to="/price-index" onClick={() => setMenuOpen(false)} className="block px-3 py-2.5 rounded-lg font-semibold text-stone-700 hover:bg-navy-50">Price Index</Link>
          <a href="/#how-it-works" onClick={() => setMenuOpen(false)} className="block px-3 py-2.5 rounded-lg font-semibold text-stone-700 hover:bg-navy-50">How it works</a>
          {profile && (
            <>
              <Link to="/dashboard" onClick={() => setMenuOpen(false)} className="block px-3 py-2.5 rounded-lg font-semibold text-stone-700 hover:bg-navy-50">Dashboard</Link>
              <Link to="/messages" onClick={() => setMenuOpen(false)} className="block px-3 py-2.5 rounded-lg font-semibold text-stone-700 hover:bg-navy-50">Messages</Link>
            </>
          )}
        </div>
      )}
    </header>
  );
}
