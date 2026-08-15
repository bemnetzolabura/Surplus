import supabase from './db-client.js';
import { setCors, getAuthProfile, now } from './auth-helper.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    const auth = await getAuthProfile(req);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });
    const me = auth.profile.id;

    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('notifications').select('*').eq('user_id', me)
        .order('created_at', { ascending: false }).limit(60);
      if (error) throw error;
      const unread = (data || []).filter((n) => !n.is_read).length;
      return res.status(200).json({ notifications: data || [], unread });
    }

    if (req.method === 'PUT') {
      const { ids, all } = req.body || {};
      if (all) {
        await supabase.from('notifications').update({ is_read: true, read_at: now() }).eq('user_id', me).eq('is_read', false);
      } else if (Array.isArray(ids) && ids.length) {
        await supabase.from('notifications').update({ is_read: true, read_at: now() }).eq('user_id', me).in('id', ids);
      }
      return res.status(200).json({ ok: true });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('notifications API error:', err);
    res.status(500).json({ error: err.message });
  }
}
