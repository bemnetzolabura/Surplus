export interface BarRow {
  label: string;
  value: number;
  hint?: string;
  color?: string;
}

export function HBarChart({ rows, format }: { rows: BarRow[]; format?: (v: number) => string }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  const fmt = format || ((v: number) => String(v));
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-semibold text-stone-600">{r.label}</span>
            <span className="font-bold text-navy-800">{fmt(r.value)}{r.hint ? <span className="text-stone-400 font-medium ml-1">{r.hint}</span> : null}</span>
          </div>
          <div className="h-2.5 rounded-full bg-stone-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${r.color || 'bg-navy-800'}`}
              style={{ width: `${Math.max(3, (r.value / max) * 100)}%` }}
            />
          </div>
        </div>)
      )}
    </div>
  );
}
