import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff, KeyRound, Mail, ShieldCheck, Store, UserRound } from 'lucide-react';
import supabase from '../lib/supabase';
import { signInWithGoogle } from '../lib/googleAuth';
import { useAuth } from '../contexts/AuthContext';
import Logo from '../components/Logo';
import { Spinner } from '../components/ui';

const DEMO_ACCOUNTS = [
  { label: 'Buyer demo', email: 'buyer@surplussell.et', role: 'Contractor buying materials' },
  { label: 'Seller demo', email: 'seller@surplussell.et', role: 'Supplier with 8 listings' },
  { label: 'Agent demo', email: 'agent@surplussell.et', role: 'Field verification agent' },
  { label: 'Driver demo', email: 'delivery@surplussell.et', role: 'Logistics delivery agent' },
  { label: 'Admin demo', email: 'admin@surplussell.et', role: 'Platform administration' },
];

export default function AuthPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { profile, loading } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>(params.get('register') ? 'register' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'BUYER' | 'SELLER'>(params.get('register') === 'seller' ? 'SELLER' : 'BUYER');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const redirect = params.get('redirect') || '/dashboard';

  useEffect(() => {
    if (!loading && profile) navigate(redirect, { replace: true });
  }, [profile, loading, navigate, redirect]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    if (mode === 'register' && password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'login') {
        const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (err) throw new Error(err.message === 'Invalid login credentials' ? 'Incorrect email or password.' : err.message);
        navigate(redirect, { replace: true });
      } else {
        const { data, error: err } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: fullName.trim(), company_name: company.trim(), phone: phone.trim(), role } },
        });
        if (err) throw new Error(err.message);
        if (data.session) {
          navigate(redirect, { replace: true });
        } else {
          setNotice('Account created! Please check your email to confirm your address, then sign in.');
          setMode('login');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setBusy(false);
    }
  };

  const quickLogin = async (demoEmail: string) => {
    setError('');
    setBusy(true);
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email: demoEmail, password: 'password123' });
      if (err) throw new Error('Demo account unavailable. Please try manual sign in.');
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] grid lg:grid-cols-2">
      {/* Brand panel */}
      <div className="hidden lg:flex relative overflow-hidden bg-navy-900 text-white flex-col justify-between p-12">
        <img src="/images/hero.jpg" alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-br from-navy-950/90 via-navy-900/80 to-navy-800/60" />
        <div className="relative">
          <Logo size={38} light />
        </div>
        <div className="relative max-w-md">
          <h2 className="text-3xl font-extrabold tracking-tight leading-tight">
            Trade surplus materials with <span className="text-gold-400">total confidence</span>.
          </h2>
          <ul className="mt-8 space-y-4">
            {[
              'Escrow holds every birr until you confirm delivery',
              'Field agents physically verify quantity and condition',
              'Live price index across 10+ Ethiopian cities',
              'Ratings on every trader after each completed deal',
            ].map((t) => (
              <li key={t} className="flex items-start gap-3 text-sm text-navy-100">
                <ShieldCheck size={17} className="text-gold-400 mt-0.5 shrink-0" />
                {t}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-navy-300">© {new Date().getFullYear()} SurplusSell PLC · Addis Ababa</p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center px-4 py-10 sm:px-8">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="w-full max-w-md">
          <div className="card p-7 sm:p-8">
            <div className="flex bg-stone-100 rounded-xl p-1 mb-7">
              {(['login', 'register'] as const).map((m) => (
                <button key={m} onClick={() => { setMode(m); setError(''); setNotice(''); }} className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${mode === m ? 'bg-white text-navy-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}>
                  {m === 'login' ? 'Sign in' : 'Create account'}
                </button>
              ))}
            </div>

            <h1 className="text-2xl font-extrabold text-navy-900 tracking-tight">
              {mode === 'login' ? 'Welcome back' : 'Join SurplusSell'}
            </h1>
            <p className="text-sm text-stone-500 mt-1">
              {mode === 'login' ? 'Sign in to trade, message and track orders.' : 'Free to join. Start buying or selling in minutes.'}
            </p>

            <form onSubmit={submit} className="mt-6 space-y-4">
              {mode === 'register' && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { v: 'BUYER', icon: UserRound, t: 'I buy materials', s: 'Contractor / developer' },
                      { v: 'SELLER', icon: Store, t: 'I sell surplus', s: 'Supplier / dealer' },
                    ] as const).map((r) => (
                      <button type="button" key={r.v} onClick={() => setRole(r.v)} className={`rounded-xl border-2 p-3.5 text-left transition-all ${role === r.v ? 'border-gold-500 bg-gold-100/40' : 'border-stone-200 hover:border-stone-300'}`}>
                        <r.icon size={18} className={role === r.v ? 'text-gold-600' : 'text-stone-400'} />
                        <p className="mt-1.5 text-sm font-bold text-navy-900">{r.t}</p>
                        <p className="text-[11px] text-stone-400">{r.s}</p>
                      </button>
                    ))}
                  </div>
                  <div>
                    <label className="text-xs font-bold text-stone-500 mb-1 block">Full name *</label>
                    <input required value={fullName} onChange={(e) => setFullName(e.target.value)} className="input" placeholder="e.g. Fitsum Alemayehu" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-stone-500 mb-1 block">Company name</label>
                    <input value={company} onChange={(e) => setCompany(e.target.value)} className="input" placeholder="e.g. Fitsum General Contractor PLC" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-stone-500 mb-1 block">Phone number</label>
                    <input value={phone} onChange={(e) => setPhone(e.target.value)} className="input" placeholder="+251 9…" />
                  </div>
                </>
              )}
              <div>
                <label className="text-xs font-bold text-stone-500 mb-1 block">Email address *</label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                  <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input !pl-9" placeholder="you@company.et" />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-stone-500 mb-1 block">Password *</label>
                <div className="relative">
                  <KeyRound size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                  <input required type={showPw ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} className="input !pl-9 !pr-10" placeholder={mode === 'register' ? 'Min. 6 characters' : 'Your password'} />
                  <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {error && <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3.5 py-2.5">{error}</div>}
              {notice && <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3.5 py-2.5">{notice}</div>}

              <button type="submit" disabled={busy} className="btn btn-navy w-full !py-3">
                {busy ? <Spinner size={17} /> : mode === 'login' ? 'Sign in' : `Create ${role === 'SELLER' ? 'seller' : 'buyer'} account`}
              </button>
            </form>

            <div className="flex items-center gap-3 my-5">
              <div className="h-px flex-1 bg-stone-200" />
              <span className="text-xs font-semibold text-stone-400">or</span>
              <div className="h-px flex-1 bg-stone-200" />
            </div>

            <button onClick={() => signInWithGoogle('SurplusSell')} className="btn btn-outline w-full !py-3">
              <svg width="17" height="17" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.3-2.2H12v4.3h6.4c-.1 1.1-.8 2.7-2.4 3.8l3.7 2.8c2.2-2 3.8-5.1 3.8-8.7z"/><path fill="#34A853" d="M12 24c3.2 0 5.9-1 7.9-2.9l-3.7-2.8c-1 .7-2.4 1.2-4.1 1.2-3.2 0-5.9-2.1-6.8-5H1.3v2.9C3.3 21.3 7.3 24 12 24z"/><path fill="#FBBC05" d="M5.2 14.5c-.2-.7-.4-1.5-.4-2.5s.2-1.8.4-2.5V6.6H1.3C.5 8.3 0 10.1 0 12s.5 3.7 1.3 5.4l3.9-2.9z"/><path fill="#EA4335" d="M12 4.7c1.8 0 3 .8 3.7 1.4l3.3-3.1C17.9 1.1 15.2 0 12 0 7.3 0 3.3 2.7 1.3 6.6l3.9 2.9c.9-2.9 3.6-4.8 6.8-4.8z"/></svg>
              Continue with Google
            </button>

            {mode === 'login' && (
              <div className="mt-7">
                <p className="text-[11px] font-bold uppercase tracking-wider text-stone-400 mb-2.5 text-center">One-click demo accounts</p>
                <div className="grid grid-cols-2 gap-2">
                  {DEMO_ACCOUNTS.map((d) => (
                    <button key={d.email} onClick={() => quickLogin(d.email)} disabled={busy} className="rounded-xl border border-stone-200 px-3 py-2.5 text-left hover:border-gold-400 hover:bg-gold-100/30 transition-colors">
                      <p className="text-xs font-extrabold text-navy-800">{d.label}</p>
                      <p className="text-[10px] text-stone-400 mt-0.5 leading-tight">{d.role}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <p className="text-center text-xs text-stone-400 mt-5">
            By continuing you agree to SurplusSell's terms. Never pay outside escrow.
            {mode === 'login' && <> New here? <Link to="/auth?register=1" className="font-bold text-navy-700 underline">Create an account</Link></>}
          </p>
        </motion.div>
      </div>
    </div>
  );
}
