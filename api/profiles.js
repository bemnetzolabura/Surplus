import supabase from './db-client.js';
import { setCors, getAuthProfile, now } from './auth-helper.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    if (req.method === 'GET') {
      const publicId = req.query?.id;
      if (publicId) {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('id, full_name, company_name, city, region, role, rating_avg, rating_count, kyc_status, total_transactions, created_at')
          .eq('id', publicId).maybeSingle();
        if (error) throw error;
        if (!profile) return res.status(404).json({ error: 'Profile not found' });
        const { data: listings } = await supabase
          .from('listings').select('*').eq('seller_id', publicId).eq('status', 'ACTIVE')
          .order('created_at', { ascending: false }).limit(24);
        const { data: ratings } = await supabase
          .from('ratings').select('*').eq('ratee_id', publicId)
          .order('created_at', { ascending: false }).limit(10);
        const raterIds = [...new Set((ratings || []).map((r) => r.rater_id))];
        let raters = {};
        if (raterIds.length) {
          const { data: ps } = await supabase.from('profiles').select('id, full_name, company_name').in('id', raterIds);
          raters = Object.fromEntries((ps || []).map((p) => [p.id, p]));
        }
        return res.status(200).json({
          profile,
          listings: listings || [],
          ratings: (ratings || []).map((r) => ({ ...r, rater: raters[r.rater_id] || null })),
        });
      }
      const auth = await getAuthProfile(req);
      if (auth.error) return res.status(auth.status).json({ error: auth.error });
      return res.status(200).json(auth.profile);
    }

    if (req.method === 'PUT') {
      const auth = await getAuthProfile(req);
      if (auth.error) return res.status(auth.status).json({ error: auth.error });
      const b = req.body || {};
      const allowed = ['full_name', 'company_name', 'phone', 'city', 'region', 'avatar_url'];
      const patch = {};
      for (const k of allowed) if (b[k] !== undefined) patch[k] = b[k] === '' ? null : String(b[k]).slice(0, 255);
      const { data, error } = await supabase
        .from('profiles').update(patch).eq('id', auth.profile.id).select().single();
      if (error) throw error;
      return res.status(200).json(data);
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('profiles API error:', err);
    res.status(500).json({ error: err.message });
  }
}
