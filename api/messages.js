import supabase from './db-client.js';
import { setCors, getAuthProfile, notify, uuid, now } from './auth-helper.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    const auth = await getAuthProfile(req);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });
    const me = auth.profile.id;

    if (req.method === 'GET') {
      const cid = req.query?.conversation_id;
      if (!cid) return res.status(400).json({ error: 'Missing conversation_id' });
      const { data: convo } = await supabase.from('conversations').select('*').eq('id', cid).maybeSingle();
      if (!convo || (convo.buyer_id !== me && convo.seller_id !== me)) {
        return res.status(403).json({ error: 'Not a participant of this conversation' });
      }
      const { data: messages, error } = await supabase
        .from('messages').select('*').eq('conversation_id', cid).order('created_at', { ascending: true }).limit(500);
      if (error) throw error;

      const isBuyer = convo.buyer_id === me;
      await supabase.from('messages')
        .update({ is_read: true })
        .eq('conversation_id', cid).eq('is_read', false).neq('sender_id', me);
      await supabase.from('conversations')
        .update(isBuyer ? { unread_buyer: 0 } : { unread_seller: 0 }).eq('id', cid);

      const { data: listing } = convo.listing_id
        ? await supabase.from('listings').select('id, title, images, price_per_unit, unit, status').eq('id', convo.listing_id).maybeSingle()
        : { data: null };
      const { data: other } = await supabase.from('profiles')
        .select('id, full_name, company_name, rating_avg, kyc_status')
        .eq('id', isBuyer ? convo.seller_id : convo.buyer_id).maybeSingle();

      return res.status(200).json({ conversation: convo, messages: messages || [], listing, other });
    }

    if (req.method === 'POST') {
      const { conversation_id, content, offer } = req.body || {};
      if (!conversation_id || (!content && !offer)) {
        return res.status(400).json({ error: 'Missing conversation_id or content' });
      }
      const { data: convo } = await supabase.from('conversations').select('*').eq('id', conversation_id).maybeSingle();
      if (!convo || (convo.buyer_id !== me && convo.seller_id !== me)) {
        return res.status(403).json({ error: 'Not a participant of this conversation' });
      }

      // Chat price offer (buyer proposes, seller accepts/declines via /api/offers)
      if (offer) {
        const qty = Number(offer.quantity);
        const price = Number(offer.unit_price);
        if (!(qty > 0) || !(price > 0)) return res.status(400).json({ error: 'Offer needs a positive quantity and price' });
        if (convo.buyer_id !== me) return res.status(403).json({ error: 'Only the buyer can send price offers' });
        const { data: listing } = await supabase.from('listings').select('*').eq('id', offer.listing_id).maybeSingle();
        if (!listing || listing.status !== 'ACTIVE') return res.status(400).json({ error: 'Listing is no longer active' });
        if (qty > Number(listing.quantity)) return res.status(400).json({ error: `Only ${listing.quantity} ${listing.unit} available` });
        const payload = JSON.stringify({ listing_id: listing.id, qty, p: price, status: 'PENDING' });
        const isBuyer = true;
        const { data: message, error } = await supabase
          .from('messages')
          .insert({ id: uuid(), conversation_id, sender_id: me, content: payload, message_type: 'OFFER', is_read: false, created_at: now() })
          .select().single();
        if (error) throw error;
        await supabase.from('conversations')
          .update({ last_message_at: now(), unread_seller: (convo.unread_seller || 0) + 1 })
          .eq('id', conversation_id);
        const buyerName = auth.profile.company_name || auth.profile.full_name || 'A buyer';
        await notify(convo.seller_id, 'ORDER', `Offer from ${buyerName}`,
          `${qty} ${listing.unit} at ${price.toLocaleString()} ETB/unit (${(qty * price).toLocaleString()} ETB). Respond in the chat.`, { conversation_id });
        return res.status(201).json(message);
      }

      if (!String(content).trim()) return res.status(400).json({ error: 'Message cannot be empty' });
      const isBuyer = convo.buyer_id === me;
      const otherId = isBuyer ? convo.seller_id : convo.buyer_id;

      const { data: message, error } = await supabase
        .from('messages')
        .insert({ id: uuid(), conversation_id, sender_id: me, content: String(content).slice(0, 2000), message_type: 'TEXT', is_read: false, created_at: now() })
        .select().single();
      if (error) throw error;

      await supabase.from('conversations')
        .update({
          last_message_at: now(),
          unread_buyer: isBuyer ? convo.unread_buyer : 0,
          ...(isBuyer ? { unread_seller: (convo.unread_seller || 0) + 1 } : { unread_buyer: (convo.unread_buyer || 0) + 1 }),
        })
        .eq('id', conversation_id);

      const senderName = auth.profile.company_name || auth.profile.full_name || 'Someone';
      await notify(otherId, 'MESSAGE', `New message from ${senderName}`, String(content).slice(0, 120), { conversation_id });

      return res.status(201).json(message);
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('messages API error:', err);
    res.status(500).json({ error: err.message });
  }
}
