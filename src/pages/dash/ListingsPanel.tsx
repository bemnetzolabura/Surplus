import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BadgeCheck, Eye, FileSpreadsheet, ImagePlus, Loader2, Package, Pencil, PlusCircle, RefreshCw, ShieldQuestion, Sparkles, Trash2, X,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { apiFetch } from '../../lib/api';
import { CITIES, CONDITIONS, LISTING_STATUS_META, PRESET_IMAGES, UNITS, VERIF_STATUS_META } from '../../lib/constants';
import { firstImage, formatETB, timeAgo } from '../../lib/format';
import { Chip, EmptyState, Modal, PageLoader, Spinner } from '../../components/ui';

interface FormState {
  title: string;
  description: string;
  category: string;
  condition: string;
  quantity: string;
  unit: string;
  price_per_unit: string;
  is_negotiable: boolean;
  city: string;
  images: string[];
}

const emptyForm = (city = 'Addis Ababa'): FormState => ({
  title: '',
  description: '',
  category: 'cement',
  condition: 'GOOD',
  quantity: '',
  unit: 'bag',
  price_per_unit: '',
  is_negotiable: true,
  city,
  images: [],
});

function ListingForm({
  open,
  onClose,
  editing,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  editing: any | null;
  onSaved: (notice: string) => void;
}) {
  const { token, profile } = useAuth();
  const [categories, setCategories] = useState<any[]>([]);
  const [priceIndex, setPriceIndex] = useState<any[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    apiFetch('/api/categories').then(setCategories).catch(() => {});
    apiFetch('/api/stats').then((d) => setPriceIndex(d.price_index || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!open) return;
    setError('');
    if (editing) {
      setForm({
        title: editing.title || '',
        description: editing.description || '',
        category: editing.category || 'cement',
        condition: editing.condition || 'GOOD',
        quantity: String(editing.quantity ?? ''),
        unit: editing.unit || 'bag',
        price_per_unit: String(editing.price_per_unit ?? ''),
        is_negotiable: !!editing.is_negotiable,
        city: editing.city || 'Addis Ababa',
        images: Array.isArray(editing.images) ? [...editing.images] : [],
      });
    } else {
      setForm(emptyForm(profile?.city || 'Addis Ababa'));
    }
  }, [open, editing, profile?.city]);

  const set = (k: keyof FormState, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const uploadFiles = async (files: FileList) => {
    if (!token) return;
    setUploading(true);
    setError('');
    try {
      for (const file of Array.from(files).slice(0, 10 - form.images.length)) {
        if (file.size > 5 * 1024 * 1024) {
          setError(`${file.name} is larger than 5MB — skipped.`);
          continue;
        }
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        const d = await apiFetch('/api/upload', {
          method: 'POST',
          body: { fileName: file.name, fileBase64: base64, contentType: file.type },
          token,
        });
        setForm((f) => ({ ...f, images: [...f.images, d.url] }));
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const validate = (): string => {
    if (form.title.trim().length < 8) return 'Title must be at least 8 characters — include material and key spec.';
    if (form.description.trim().length < 30) return 'Description must be at least 30 characters — buyers need details.';
    if (!(Number(form.quantity) > 0)) return 'Enter a quantity greater than zero.';
    if (!(Number(form.price_per_unit) > 0)) return 'Enter a price per unit greater than zero.';
    if (form.images.length === 0) return 'Add at least one photo (upload or pick from the gallery below).';
    return '';
  };

  const submit = async () => {
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const body = {
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category,
        condition: form.condition,
        quantity: Number(form.quantity),
        unit: form.unit,
        price_per_unit: Number(form.price_per_unit),
        is_negotiable: form.is_negotiable,
        city: form.city,
        region: CITIES.find((c) => c.name === form.city)?.region || '',
        images: form.images,
      };
      if (editing) {
        await apiFetch('/api/listing', { method: 'PUT', body: { id: editing.id, ...body }, token });
        onSaved('Listing updated successfully.');
      } else {
        const created = await apiFetch('/api/listings', { method: 'POST', body, token });
        onSaved(
          created.status === 'ACTIVE'
            ? 'Your listing is live on the marketplace!'
            : `Listing created and sent for review (lots above ${formatETB(10000, { suffix: false })} ETB need approval).`
        );
      }
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const aiSuggestion = (() => {
    const presets: Record<string, string> = {
      cement: 'Describe grade (e.g. PPC 42.5R), bag weight, storage yard, and why it is surplus.',
      rebar: 'Include diameter (Y8–Y32), grade, total tonnage and whether bars are straight/bundled.',
      lumber: 'State timber species (eucalyptus, pine), dimensions, length and drying condition.',
      aggregates: 'Mention source quarry, grading (00/02), cleanliness and loading terms.',
    };
    return presets[form.category] || 'Include exact specs, quantity accuracy evidence, yard location and loading support.';
  })();

  return (
    <Modal open={open} onClose={() => !busy && onClose()} title={editing ? 'Edit listing' : 'Create new listing'} wide>
      <div className="space-y-4">
        <div>
          <label className="text-xs font-bold text-stone-500 mb-1 block">Listing title *</label>
          <input value={form.title} onChange={(e) => set('title', e.target.value)} className="input" placeholder="e.g. PPC Cement 42.5R — 480 x 50kg bags, project surplus" />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-stone-500 mb-1 block">Category *</label>
            <select value={form.category} onChange={(e) => set('category', e.target.value)} className="input">
              {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-stone-500 mb-1 block">Condition *</label>
            <select value={form.condition} onChange={(e) => set('condition', e.target.value)} className="input">
              {CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-bold text-stone-500 mb-1 block">Quantity *</label>
            <input type="number" min="0" step="any" value={form.quantity} onChange={(e) => set('quantity', e.target.value)} className="input" placeholder="480" />
          </div>
          <div>
            <label className="text-xs font-bold text-stone-500 mb-1 block">Unit *</label>
            <select value={form.unit} onChange={(e) => set('unit', e.target.value)} className="input">
              {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-stone-500 mb-1 block">Price / unit (ETB) *</label>
            <input type="number" min="0" step="any" value={form.price_per_unit} onChange={(e) => set('price_per_unit', e.target.value)} className="input" placeholder="1180" />
          </div>
        </div>

        {(() => {
          const mkt = priceIndex.find((r) => r.category === form.category);
          if (!mkt) return null;
          return (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 bg-gold-100/50 border border-gold-200 rounded-xl px-3.5 py-2.5 text-xs">
              <span className="inline-flex items-center gap-1.5 font-extrabold text-gold-700"><Sparkles size={13} /> Smart price</span>
              <span className="text-stone-600">
                Market avg <b className="text-navy-800">{formatETB(mkt.avg_price, { suffix: false })}/{mkt.unit}</b> across {mkt.count} listings
                {' '}(range {formatETB(mkt.min_price, { suffix: false })}–{formatETB(mkt.max_price, { suffix: false })})
                {mkt.unit !== form.unit && <em className="text-stone-400"> — note: basis is per {mkt.unit}</em>}
              </span>
              <button type="button" onClick={() => set('price_per_unit', String(mkt.avg_price))} className="font-extrabold text-navy-700 underline">
                Apply avg
              </button>
            </div>
          );
        })()}

        {Number(form.quantity) > 0 && Number(form.price_per_unit) > 0 && (
          <div className="bg-navy-50 border border-navy-100 rounded-xl px-4 py-3 text-sm flex flex-wrap gap-x-6 gap-y-1">
            <span className="font-bold text-navy-800">Lot total: {formatETB(Number(form.quantity) * Number(form.price_per_unit))}</span>
            <span className="text-stone-500">
              {Number(form.quantity) * Number(form.price_per_unit) < 10000
                ? 'Lists instantly (under 10,000 ETB auto-approval).'
                : 'Requires a quick moderation review (over 10,000 ETB).'}
            </span>
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-stone-500 mb-1 block">City *</label>
            <select value={form.city} onChange={(e) => set('city', e.target.value)} className="input">
              {CITIES.map((c) => <option key={c.name} value={c.name}>{c.name}, {c.region}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2.5 cursor-pointer select-none mt-6">
            <input type="checkbox" checked={form.is_negotiable} onChange={(e) => set('is_negotiable', e.target.checked)} className="w-4 h-4 accent-[#1e3a5f]" />
            <span className="text-sm font-semibold text-stone-700">Price is negotiable</span>
          </label>
        </div>

        <div>
          <label className="text-xs font-bold text-stone-500 mb-1 block">Description *</label>
          <textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={4} className="input" placeholder={aiSuggestion} />
          <p className="text-[11px] text-stone-400 mt-1">Writing tip — {aiSuggestion}</p>
        </div>

        <div>
          <label className="text-xs font-bold text-stone-500 mb-1.5 block">Photos * ({form.images.length}/10)</label>
          <div className="flex flex-wrap gap-2.5">
            {form.images.map((src, i) => (
              <div key={i} className="relative w-24 h-18 rounded-xl overflow-hidden group">
                <img src={src} alt="" className="w-24 h-18 object-cover" style={{ height: 72 }} />
                <button
                  onClick={() => set('images', form.images.filter((_, j) => j !== i))}
                  className="absolute top-1 right-1 w-6 h-6 rounded-lg bg-navy-950/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={13} />
                </button>
              </div>
            ))}
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading || form.images.length >= 10}
              className="w-24 rounded-xl border-2 border-dashed border-stone-300 hover:border-gold-500 hover:bg-gold-100/30 flex flex-col items-center justify-center gap-1 text-stone-400 transition-colors"
              style={{ height: 72 }}
            >
              {uploading ? <Loader2 size={17} className="animate-spin" /> : <ImagePlus size={17} />}
              <span className="text-[10px] font-bold">{uploading ? 'Uploading' : 'Upload'}</span>
            </button>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => e.target.files && uploadFiles(e.target.files)} />
          </div>
          <p className="text-[11px] font-bold text-stone-400 mt-3 mb-1.5">Or pick from the material gallery:</p>
          <div className="grid grid-cols-6 gap-1.5">
            {PRESET_IMAGES.map((p) => {
              const used = form.images.includes(p.url);
              return (
                <button
                  key={p.url}
                  onClick={() => set('images', used ? form.images.filter((u) => u !== p.url) : [...form.images.slice(0, 9), p.url])}
                  className={`relative rounded-lg overflow-hidden border-2 transition-colors ${used ? 'border-gold-500' : 'border-transparent hover:border-stone-300'}`}
                  title={p.label}
                >
                  <img src={p.url} alt={p.label} className="w-full h-11 object-cover" />
                  {used && <span className="absolute inset-0 bg-gold-500/30 flex items-center justify-center"><BadgeCheck size={16} className="text-white" /></span>}
                </button>
              );
            })}
          </div>
        </div>

        {error && <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3.5 py-2.5">{error}</div>}

        <div className="flex gap-3 pt-1">
          <button onClick={submit} disabled={busy || uploading} className="btn btn-navy flex-1 !py-3">
            {busy ? <Spinner size={17} /> : editing ? 'Save changes' : 'Publish listing'}
          </button>
          <button onClick={onClose} disabled={busy} className="btn btn-outline !py-3">Cancel</button>
        </div>
      </div>
    </Modal>
  );
}

export default function ListingsPanel() {
  const { token } = useAuth();
  const [listings, setListings] = useState<any[] | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const d = await apiFetch('/api/listings?mine=true', { token });
      setListings(d.listings || []);
    } catch (e: any) {
      setError(e.message);
      setListings([]);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const act = async (id: string, body: Record<string, unknown>, method: 'PUT' | 'DELETE' = 'PUT') => {
    setBusyId(id);
    setError('');
    try {
      await apiFetch('/api/listing', { method, body: { id, ...body }, token });
      await load();
      setConfirmDelete(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusyId('');
    }
  };

  const requestVerification = async (id: string) => {
    setBusyId(id);
    setError('');
    try {
      await apiFetch('/api/verification', { method: 'POST', body: { listing_id: id }, token });
      setNotice('Verification requested — an agent will be assigned shortly.');
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusyId('');
    }
  };

  if (!listings) return <PageLoader />;

  const activeCount = listings.filter((l) => l.status === 'ACTIVE').length;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-xl font-extrabold text-navy-900">My Listings</h2>
          <p className="text-sm text-stone-500">{activeCount} live · {listings.length} total · listings auto-expire after 30 days</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setBulkOpen(true)} className="btn btn-outline">
            <FileSpreadsheet size={16} /> Bulk import
          </button>
          <button onClick={() => { setEditing(null); setFormOpen(true); }} className="btn btn-gold">
            <PlusCircle size={16} /> New listing
          </button>
        </div>
      </div>

      {notice && <div className="mb-4 text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-4 py-3">{notice}</div>}
      {error && <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3">{error}</div>}

      {listings.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Package}
            title="No listings yet"
            message="Post your first surplus lot — it takes 2 minutes and listing is free."
            action={<button onClick={() => { setEditing(null); setFormOpen(true); }} className="btn btn-gold">Create listing</button>}
          />
        </div>
      ) : (
        <div className="space-y-3">
          {listings.map((l) => (
            <div key={l.id} className="card p-4 flex flex-wrap gap-4">
              {firstImage(l.images) ? (
                <img src={firstImage(l.images)!} alt="" className="w-24 h-20 rounded-xl object-cover shrink-0" />
              ) : (
                <div className="w-24 h-20 rounded-xl bg-navy-50 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-2 flex-wrap">
                  <Link to={`/listing/${l.id}`} className="font-extrabold text-navy-900 hover:text-gold-600 transition-colors leading-snug">
                    {l.title}
                  </Link>
                  <Chip meta={LISTING_STATUS_META[l.status] || { label: l.status, classes: 'bg-stone-200 text-stone-600' }} />
                  <Chip meta={VERIF_STATUS_META[l.verification_status] || { label: l.verification_status, classes: 'bg-stone-200 text-stone-600' }} />
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1 text-xs text-stone-500">
                  <span><b className="text-navy-800">{formatETB(l.price_per_unit)}</b> / {l.unit}</span>
                  <span>Stock: <b className="text-navy-800">{Number(l.quantity).toLocaleString()} {l.unit}</b></span>
                  <span>Lot: <b className="text-navy-800">{formatETB(l.total_price)}</b></span>
                  <span className="inline-flex items-center gap-1"><Eye size={12} /> {l.view_count || 0}</span>
                  <span>{l.city}</span>
                  <span>posted {timeAgo(l.created_at)}</span>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={() => { setEditing(l); setFormOpen(true); }} className="btn btn-outline !py-1.5 !px-3 text-xs">
                    <Pencil size={13} /> Edit
                  </button>
                  {l.status === 'ACTIVE' && (
                    <button onClick={() => act(l.id, { action: 'mark_sold' })} disabled={busyId === l.id} className="btn btn-outline !py-1.5 !px-3 text-xs">
                      Mark sold out
                    </button>
                  )}
                  {['SOLD', 'EXPIRED', 'SUSPENDED', 'REJECTED'].includes(l.status) && (
                    <button onClick={() => act(l.id, { action: 'relist' })} disabled={busyId === l.id} className="btn btn-outline !py-1.5 !px-3 text-xs">
                      <RefreshCw size={13} /> Relist (30 days)
                    </button>
                  )}
                  {l.verification_status === 'UNVERIFIED' && l.status === 'ACTIVE' && (
                    <button onClick={() => requestVerification(l.id)} disabled={busyId === l.id} className="btn btn-outline !py-1.5 !px-3 text-xs !text-emerald-700 !border-emerald-200 hover:!bg-emerald-50">
                      <ShieldQuestion size={13} /> Request verification
                    </button>
                  )}
                  {confirmDelete === l.id ? (
                    <span className="inline-flex items-center gap-2">
                      <button onClick={() => act(l.id, {}, 'DELETE')} disabled={busyId === l.id} className="btn btn-danger !py-1.5 !px-3 text-xs">
                        Confirm delete
                      </button>
                      <button onClick={() => setConfirmDelete(null)} className="btn btn-ghost !py-1.5 !px-3 text-xs">Keep</button>
                    </span>
                  ) : (
                    <button onClick={() => setConfirmDelete(l.id)} className="btn btn-ghost !py-1.5 !px-3 text-xs text-red-500 hover:!bg-red-50">
                      <Trash2 size={13} /> Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ListingForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        editing={editing}
        onSaved={(msg) => {
          setNotice(msg);
          load();
        }}
      />
      <BulkImportModal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        onDone={(msg) => {
          setNotice(msg);
          load();
        }}
      />
    </div>
  );
}

// ---------- Bulk CSV import (blueprint F13: bulk dealer tools) ----------

const TEMPLATE = 'title,category,condition,quantity,unit,price_per_unit,city,description\n"OPC Cement 53 grade surplus bags",cement,GOOD,120,bag,1250,Addis Ababa,"Dry-stored bags from hospital project, pallets loaded"';

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let val = '';
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { val += '"'; i++; } else inQ = false;
      } else val += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { cur.push(val); val = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      cur.push(val);
      rows.push(cur);
      cur = [];
      val = '';
    } else val += c;
  }
  if (val !== '' || cur.length) { cur.push(val); rows.push(cur); }
  return rows.filter((r) => r.some((x) => String(x).trim() !== ''));
}

interface ParsedRow { data: any; title: string; error: string }

function BulkImportModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: (msg: string) => void }) {
  const { token } = useAuth();
  const [categories, setCategories] = useState<any[]>([]);
  const [raw, setRaw] = useState('');
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [results, setResults] = useState<any[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    apiFetch('/api/categories').then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    if (open) {
      setRows([]);
      setResults(null);
      setError('');
    }
  }, [open]);

  const resolveCategory = (input: string): string | null => {
    const lc = input.trim().toLowerCase();
    const exact = categories.find((c) => c.slug === lc || c.name.toLowerCase() === lc);
    if (exact) return exact.slug;
    const partial = categories.find((c) => c.name.toLowerCase().includes(lc) || lc.includes(c.slug));
    return partial ? partial.slug : null;
  };

  const parse = (text: string) => {
    setError('');
    const grid = parseCSV(text);
    if (grid.length < 1) {
      setError('No CSV rows detected.');
      return;
    }
    const header = grid[0].map((h) => h.trim().toLowerCase());
    const hasHeader = header.includes('title');
    const cols = hasHeader ? header : ['title', 'category', 'condition', 'quantity', 'unit', 'price_per_unit', 'city', 'description'];
    const dataRows = hasHeader ? grid.slice(1) : grid;
    const parsed: ParsedRow[] = dataRows.slice(0, 50).map((cells) => {
      const rec: any = {};
      cols.forEach((k, i) => { rec[k] = cells[i]; });
      const category = resolveCategory(String(rec.category || ''));
      let err = '';
      if (!rec.title || String(rec.title).trim().length < 8) err = 'Title too short';
      else if (!category) err = `Unknown category "${rec.category}"`;
      else if (!(Number(rec.quantity) > 0)) err = 'Bad quantity';
      else if (!(Number(rec.price_per_unit) > 0)) err = 'Bad price';
      return {
        title: String(rec.title || '(untitled)'),
        error: err,
        data: err ? null : {
          title: String(rec.title).trim(),
          category,
          condition: String(rec.condition || 'GOOD').trim().toUpperCase(),
          quantity: Number(rec.quantity),
          unit: String(rec.unit || 'piece').trim(),
          price_per_unit: Number(rec.price_per_unit),
          city: String(rec.city || '').trim() || 'Addis Ababa',
          description: String(rec.description || '').trim(),
        },
      };
    });
    if (!parsed.length) {
      setError('Nothing to import — add at least one data row.');
      return;
    }
    setRows(parsed);
  };

  const pickPresetImage = (category: string): string => {
    const map: Record<string, string> = {
      cement: '/images/materials/cement.jpg', rebar: '/images/materials/rebar.jpg', steel: '/images/materials/steel.jpg',
      lumber: '/images/materials/lumber.jpg', aggregates: '/images/materials/aggregate.jpg', 'bricks-blocks': '/images/materials/bricks.jpg',
      roofing: '/images/materials/roofing.jpg', 'tiles-ceramics': '/images/materials/tiles.jpg', electrical: '/images/materials/electrical.jpg',
      plumbing: '/images/materials/pipes.jpg', 'paint-finishing': '/images/materials/paint.jpg', 'equipment-tools': '/images/materials/scaffolding.jpg',
    };
    return map[category] || '/images/materials/cement.jpg';
  };

  const runImport = async () => {
    const valid = rows.filter((r) => !r.error && r.data).map((r) => ({
      ...r.data,
      images: [pickPresetImage(r.data.category)],
    }));
    if (!valid.length) {
      setError('No valid rows to import.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const d = await apiFetch('/api/bulk', { method: 'POST', body: { listings: valid }, token });
      setResults(d.results || []);
      if (d.created > 0) {
        const pending = (d.results || []).filter((r: any) => r.ok && r.status === 'PENDING_APPROVAL').length;
        onDone(`Bulk import complete: ${d.created} listing(s) created${pending ? `, ${pending} sent for moderation review` : ''}${d.failed ? `, ${d.failed} failed` : ''}.`);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const validCount = rows.filter((r) => !r.error).length;

  return (
    <Modal open={open} onClose={() => !busy && onClose()} title="Bulk import listings (CSV)" wide>
      <div className="space-y-4">
        <div className="bg-navy-50 border border-navy-100 rounded-xl p-4 text-xs text-navy-700 leading-relaxed">
          <b>Dealer tool:</b> import up to 50 lots at once. Columns: <code className="font-mono bg-white px-1 rounded">title, category, condition, quantity, unit, price_per_unit, city, description</code>.
          Lots under 10,000 ETB list instantly; larger ones go to moderation review.{' '}
          <a
            href={`data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE)}`}
            download="surplussell-import-template.csv"
            className="font-extrabold underline"
          >
            Download template
          </a>
        </div>

        {!rows.length && !results && (
          <>
            <div className="flex gap-2">
              <input ref={fileRef} type="file" accept=".csv,text/csv,text/plain" className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const reader = new FileReader();
                  reader.onload = () => setRaw(String(reader.result || ''));
                  reader.readAsText(f);
                }}
              />
              <button onClick={() => fileRef.current?.click()} className="btn btn-outline !py-2 text-xs">Load .csv file</button>
            </div>
            <textarea
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              rows={7}
              className="input !font-mono !text-xs"
              placeholder={'Paste CSV here, e.g.\n' + TEMPLATE.split('\n')[1]}
            />
            <button onClick={() => parse(raw)} disabled={!raw.trim()} className="btn btn-navy w-full">Parse &amp; preview</button>
          </>
        )}

        {rows.length > 0 && !results && (
          <>
            <p className="text-sm">{validCount} of {rows.length} rows are ready. Invalid rows are skipped.</p>
            <div className="max-h-64 overflow-y-auto border border-stone-200 rounded-xl">
              <table className="w-full text-xs">
                <thead className="bg-sand-50 sticky top-0">
                  <tr className="text-left">
                    <th className="px-3 py-2 font-extrabold text-stone-400">Title</th>
                    <th className="px-3 py-2 font-extrabold text-stone-400">Category</th>
                    <th className="px-3 py-2 font-extrabold text-stone-400 text-right">Qty</th>
                    <th className="px-3 py-2 font-extrabold text-stone-400 text-right">Price</th>
                    <th className="px-3 py-2 font-extrabold text-stone-400">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className={`border-t border-stone-100 ${r.error ? 'bg-red-50/60' : ''}`}>
                      <td className="px-3 py-2 max-w-[220px] truncate font-semibold text-stone-700">{r.title}</td>
                      <td className="px-3 py-2">{r.data?.category || '—'}</td>
                      <td className="px-3 py-2 text-right">{r.data ? `${r.data.quantity} ${r.data.unit}` : '—'}</td>
                      <td className="px-3 py-2 text-right">{r.data ? formatETB(r.data.price_per_unit, { suffix: false }) : '—'}</td>
                      <td className={`px-3 py-2 font-bold ${r.error ? 'text-red-600' : 'text-emerald-600'}`}>{r.error || 'Ready'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-3">
              <button onClick={runImport} disabled={busy || validCount === 0} className="btn btn-gold flex-1 !py-3">
                {busy ? `Importing ${validCount} listings…` : `Import ${validCount} listings`}
              </button>
              <button onClick={() => setRows([])} disabled={busy} className="btn btn-outline !py-3">Back</button>
            </div>
          </>
        )}

        {results && (
          <>
            <p className="text-sm font-bold text-navy-800">
              {results.filter((r) => r.ok).length} created · {results.filter((r) => !r.ok).length} failed
            </p>
            <div className="max-h-56 overflow-y-auto space-y-1.5">
              {results.map((r, i) => (
                <div key={i} className={`text-xs rounded-lg px-3 py-2 ${r.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                  <b>{r.title}</b> — {r.ok ? (r.status === 'ACTIVE' ? 'Live now' : 'Sent to moderation review') : r.error}
                </div>
              ))}
            </div>
            <button onClick={onClose} className="btn btn-navy w-full">Done</button>
          </>
        )}

        {error && <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3.5 py-2.5">{error}</div>}
      </div>
    </Modal>
  );
}
