export default function Logo({ size = 34, light = false }: { size?: number; light?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg width={size} height={size} viewBox="0 0 44 44" fill="none" aria-hidden>
        <rect width="44" height="44" rx="10" fill={light ? '#0D1D31' : '#1E3A5F'} />
        <rect x="9" y="24" width="6.5" height="11" rx="1.5" fill="#8CADD0" />
        <rect x="18.75" y="17" width="6.5" height="18" rx="1.5" fill="#ECC34C" />
        <rect x="28.5" y="9" width="6.5" height="26" rx="1.5" fill="#E8B931" />
      </svg>
      <span className={`font-extrabold tracking-tight leading-none ${light ? 'text-white' : 'text-navy-800'}`} style={{ fontSize: size * 0.52 }}>
        Surplus<span className="text-gold-500">Sell</span>
      </span>
    </span>
  );
}
