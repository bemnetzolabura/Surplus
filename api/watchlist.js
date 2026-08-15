import supabase from './db-client.js';
import { setCors, getAuthProfile, uuid, now } from './auth-helper.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    const auth = await getAuthProfile(req);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });
    const me = auth.profile.id;

    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('watchlist').select('*').eq('user_id', me).order('created_at', { ascending: false });
      if (error) throw error;
      const ids = (data || []).map((w) => w.listing_id);
      let listings = [];
      if (ids.length) {
        const { data: ls } = await supabase.from('listings').select('*').in('id', ids);
        listings = ls || [];
      }
      return res.status(200).json({ watchlist: data || [], listings });
    }

    if (req.method === 'POST') {
      const { listing_id } = req.body || {};
      if (!listing_id) return res.status(400).json({ error: 'Missing listing_id' });
      const { data: existing } = await supabase
        .from('watchlist').select('*').eq('user_id', me).eq('listing_id', listing_id).maybeSingle();
      if (existing) {
        await supabase.from('watchlist').delete().eq('id', existing.id);
        return res.status(200).json({ saved: false });
      }
      await supabase.from('watchlist').insert({ id: uuid(), user_id: me, listing_id, created_at: now() });
      return res.status(200).json({ saved: true });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('watchlist API error:', err);
    res.status(500).json({ error: err.message });
  }
}
