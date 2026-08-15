import { Link } from 'react-router-dom';
import { Mail, MapPin, Phone, ShieldCheck } from 'lucide-react';
import Logo from './Logo';

export default function Footer() {
  return (
    <footer className="no-print bg-navy-950 text-navy-200 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14 grid gap-10 md:grid-cols-4">
        <div>
          <Logo size={34} light />
          <p className="mt-4 text-sm leading-relaxed text-navy-300">
            Ethiopia's trusted marketplace for surplus construction materials. Buy verified cement, steel, lumber and more — protected by escrow.
          </p>
          <div className="mt-4 flex items-center gap-2 text-xs bg-navy-900 border border-navy-700 rounded-lg px-3 py-2 w-fit">
            <ShieldCheck size={14} className="text-gold-400" />
            <span>Escrow-protected transactions</span>
          </div>
        </div>
        <div>
          <h4 className="text-white font-bold text-sm uppercase tracking-wider mb-4">Marketplace</h4>
          <ul className="space-y-2.5 text-sm">
            <li><Link to="/browse" className="hover:text-gold-400 transition-colors">Browse materials</Link></li>
            <li><Link to="/browse?verified=true" className="hover:text-gold-400 transition-colors">Verified listings</Link></li>
            <li><Link to="/price-index" className="hover:text-gold-400 transition-colors">Price index</Link></li>
            <li><Link to="/auth?register=seller" className="hover:text-gold-400 transition-colors">Become a seller</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-white font-bold text-sm uppercase tracking-wider mb-4">Trust &amp; Safety</h4>
          <ul className="space-y-2.5 text-sm">
            <li><a href="/#how-it-works" className="hover:text-gold-400 transition-colors">How escrow works</a></li>
            <li><a href="/#how-it-works" className="hover:text-gold-400 transition-colors">Physical verification</a></li>
            <li><a href="/#how-it-works" className="hover:text-gold-400 transition-colors">Ratings &amp; reviews</a></li>
            <li><a href="/#how-it-works" className="hover:text-gold-400 transition-colors">Dispute resolution</a></li>
          </ul>
        </div>
        <div>
          <h4 className="text-white font-bold text-sm uppercase tracking-wider mb-4">Contact</h4>
          <ul className="space-y-3 text-sm">
            <li className="flex items-start gap-2.5"><MapPin size={16} className="text-gold-400 mt-0.5 shrink-0" /><span>Bole Sub-City, Woreda 03<br />Addis Ababa, Ethiopia</span></li>
            <li className="flex items-center gap-2.5"><Phone size={16} className="text-gold-400 shrink-0" /><span>+251 11 557 8900</span></li>
            <li className="flex items-center gap-2.5"><Mail size={16} className="text-gold-400 shrink-0" /><span>support@surplussell.et</span></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-navy-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-navy-400">
          <span>© {new Date().getFullYear()} SurplusSell PLC — Addis Ababa, Ethiopia. All rights reserved.</span>
          <span>ለእትዮጵጫችን በአመርኛ የቆጥያትችው ትርጅመ » Built for Ethiopia's builders</span>
        </div>
      </div>
    </footer>
  );
}
