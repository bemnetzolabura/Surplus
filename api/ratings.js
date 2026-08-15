import supabase from './db-client.js';
import { setCors, getAuthProfile, notify, uuid, now } from './auth-helper.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    if (req.method === 'GET') {
      const userId = req.query?.user_id;
      if (!userId) return res.status(400).json({ error: 'Missing user_id' });
      const { data: ratings, error } = await supabase
        .from('ratings').select('*').eq('ratee_id', userId).order('created_at', { ascending: false }).limit(50);
      if (error) throw error;
      return res.status(200).json(ratings || []);
    }

    if (req.method === 'POST') {
      const auth = await getAuthProfile(req);
      if (auth.error) return res.status(auth.status).json({ error: auth.error });
      const me = auth.profile;
      const { transaction_id, rating, review } = req.body || {};
      const stars = Number(rating);
      if (!transaction_id || !(stars >= 1 && stars <= 5)) return res.status(400).json({ error: 'Provide transaction_id and rating 1-5' });

      const { data: txn } = await supabase.from('transactions').select('*').eq('id', transaction_id).maybeSingle();
      if (!txn) return res.status(404).json({ error: 'Transaction not found' });
      if (txn.buyer_id !== me.id && txn.seller_id !== me.id) return res.status(403).json({ error: 'You did not participate in this transaction' });
      if (txn.status !== 'COMPLETED') return res.status(400).json({ error: 'You can rate only completed orders' });

      const rateeId = txn.buyer_id === me.id ? txn.seller_id : txn.buyer_id;
      const { data: existing } = await supabase
        .from('ratings').select('id').eq('transaction_id', transaction_id).eq('rater_id', me.id).limit(1);
      if (existing && existing.length) return res.status(400).json({ error: 'You already rated this transaction' });

      const { data: created, error } = await supabase
        .from('ratings')
        .insert({ id: uuid(), transaction_id, rater_id: me.id, ratee_id: rateeId, rating: stars, review: String(review || '').slice(0, 1000), created_at: now() })
        .select().single();
      if (error) throw error;

      const { data: all } = await supabase.from('ratings').select('rating').eq('ratee_id', rateeId);
      const count = (all || []).length;
      const base = await supabase.from('profiles').select('rating_avg, rating_count').eq('id', rateeId).maybeSingle();
      // Blend seeded historical average with live ratings
      const historicalTotal = Number(base.data?.rating_avg || 0) * Number(base.data?.rating_count || 0);
      const liveTotal = (all || []).reduce((s, r) => s + Number(r.rating), 0);
      const newCount = Number(base.data?.rating_count || 0) > count ? Number(base.data.rating_count) + 1 : count;
      const newAvg = Math.round(((historicalTotal + stars) / newCount) * 10) / 10;
      await supabase.from('profiles').update({ rating_avg: newAvg, rating_count: newCount }).eq('id', rateeId);

      const raterName = me.company_name || me.full_name || 'A user';
      await notify(rateeId, 'RATING', `New ${stars}-star rating`, `${raterName} rated your recent transaction.`, { transaction_id });

      return res.status(201).json(created);
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('ratings API error:', err);
    res.status(500).json({ error: err.message });
  }
}
