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
      const { data: convos, error } = await supabase
        .from('conversations').select('*')
        .or(`buyer_id.eq.${me},seller_id.eq.${me}`)
        .order('last_message_at', { ascending: false });
      if (error) throw error;
      if (!convos || !convos.length) return res.status(200).json([]);

      const listingIds = [...new Set(convos.map((c) => c.listing_id).filter(Boolean))];
      const otherIds = [...new Set(convos.map((c) => (c.buyer_id === me ? c.seller_id : c.buyer_id)))];
      const convoIds = convos.map((c) => c.id);

      const [{ data: listings }, { data: others }, { data: msgs }] = await Promise.all([
        listingIds.length ? supabase.from('listings').select('id, title, images, status, price_per_unit, unit').in('id', listingIds) : Promise.resolve({ data: [] }),
        supabase.from('profiles').select('id, full_name, company_name, rating_avg, kyc_status').in('id', otherIds),
        supabase.from('messages').select('*').in('conversation_id', convoIds).order('created_at', { ascending: false }).limit(300),
      ]);

      const listingMap = Object.fromEntries((listings || []).map((l) => [l.id, l]));
      const otherMap = Object.fromEntries((others || []).map((p) => [p.id, p]));
      const lastMsg = {};
      for (const m of msgs || []) if (!lastMsg[m.conversation_id]) lastMsg[m.conversation_id] = m;

      return res.status(200).json(convos.map((c) => ({
        ...c,
        listing: listingMap[c.listing_id] || null,
        other: otherMap[c.buyer_id === me ? c.seller_id : c.buyer_id] || null,
        last_message: lastMsg[c.id] || null,
        my_unread: c.buyer_id === me ? c.unread_buyer : c.unread_seller,
      })));
    }

    if (req.method === 'POST') {
      const { listing_id } = req.body || {};
      if (!listing_id) return res.status(400).json({ error: 'Missing listing_id' });
      const { data: listing } = await supabase.from('listings').select('*').eq('id', listing_id).maybeSingle();
      if (!listing) return res.status(404).json({ error: 'Listing not found' });
      if (listing.seller_id === me) return res.status(400).json({ error: 'You cannot message your own listing' });

      const { data: existing } = await supabase
        .from('conversations').select('*')
        .eq('listing_id', listing_id).eq('buyer_id', me).eq('seller_id', listing.seller_id).maybeSingle();
      if (existing) return res.status(200).json(existing);

      const { data: created, error } = await supabase
        .from('conversations')
        .insert({ id: uuid(), listing_id, buyer_id: me, seller_id: listing.seller_id, status: 'ACTIVE', unread_buyer: 0, unread_seller: 0, last_message_at: now(), created_at: now() })
        .select().single();
      if (error) throw error;
      return res.status(201).json(created);
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('conversations API error:', err);
    res.status(500).json({ error: err.message });
  }
}
