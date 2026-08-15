import supabase from './db-client.js';
import { setCors, getAuthProfile, uuid, now } from './auth-helper.js';

// Saved searches with "new since saved" alerts.
export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    const auth = await getAuthProfile(req);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });
    const me = auth.profile.id;

    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('saved_searches').select('*').eq('user_id', me).order('created_at', { ascending: false }).limit(30);
      if (error) throw error;

      // Count new matching listings created after each saved search
      const enriched = [];
      for (const s of data || []) {
        const f = s.filters || {};
        let q = supabase.from('listings').select('id', { count: 'exact', head: true }).eq('status', 'ACTIVE').gt('created_at', s.created_at);
        if (f.q) q = q.or(`title.ilike.%${f.q}%,description.ilike.%${f.q}%,city.ilike.%${f.q}%`);
        if (f.category) q = q.eq('category', f.category);
        if (f.condition) q = q.eq('condition', f.condition);
        if (f.city) q = q.eq('city', f.city);
        if (f.min) q = q.gte('price_per_unit', Number(f.min));
        if (f.max) q = q.lte('price_per_unit', Number(f.max));
        if (f.verified) q = q.eq('verification_status', 'VERIFIED');
        const { count } = await q;
        enriched.push({ ...s, new_count: count || 0 });
      }
      return res.status(200).json(enriched);
    }

    if (req.method === 'POST') {
      const { name, filters } = req.body || {};
      const clean = String(name || '').trim().slice(0, 80);
      if (!clean) return res.status(400).json({ error: 'Give your search a name' });
      if (!filters || typeof filters !== 'object') return res.status(400).json({ error: 'Missing filters' });
      const { count } = await supabase.from('saved_searches').select('id', { count: 'exact', head: true }).eq('user_id', me);
      if ((count || 0) >= 30) return res.status(400).json({ error: 'You can save up to 30 searches' });
      const allowed = ['q', 'category', 'condition', 'city', 'min', 'max', 'verified', 'negotiable', 'sort'];
      const sanitized = {};
      for (const k of allowed) {
        if (filters[k] !== undefined && filters[k] !== '' && filters[k] !== false && filters[k] !== null) {
          sanitized[k] = typeof filters[k] === 'boolean' ? filters[k] : String(filters[k]).slice(0, 80);
        }
      }
      if (!Object.keys(sanitized).length) return res.status(400).json({ error: 'Apply at least one filter before saving' });
      const { data: created, error } = await supabase
        .from('saved_searches')
        .insert({ id: uuid(), user_id: me, name: clean, filters: sanitized, created_at: now() })
        .select().single();
      if (error) throw error;
      return res.status(201).json(created);
    }

    if (req.method === 'DELETE') {
      const { id } = req.body || {};
      if (!id) return res.status(400).json({ error: 'Missing id' });
      const { error } = await supabase.from('saved_searches').delete().eq('id', id).eq('user_id', me);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('searches API error:', err);
    res.status(500).json({ error: err.message });
  }
}
