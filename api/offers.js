import supabase from './db-client.js';
import { setCors, getAuthProfile, notify, commissionFor, uuid, now, insertMessage } from './auth-helper.js';

// Price negotiation inside chat: sellers accept or decline buyer offers.
export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    const auth = await getAuthProfile(req);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });
    const me = auth.profile;

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { action, message_id } = req.body || {};
    if (!['accept', 'decline'].includes(action)) return res.status(400).json({ error: 'Unknown action' });

    const { data: message } = await supabase.from('messages').select('*').eq('id', message_id).maybeSingle();
    if (!message || message.message_type !== 'OFFER') return res.status(404).json({ error: 'Offer not found' });

    const { data: convo } = await supabase.from('conversations').select('*').eq('id', message.conversation_id).maybeSingle();
    if (!convo) return res.status(404).json({ error: 'Conversation not found' });
    if (convo.seller_id !== me.id) return res.status(403).json({ error: 'Only the seller can respond to offers' });

    let offer;
    try {
      offer = JSON.parse(message.content);
    } catch {
      return res.status(400).json({ error: 'Corrupt offer data' });
    }
    if (offer.status !== 'PENDING') return res.status(400).json({ error: `Offer is already ${offer.status.toLowerCase()}` });

    if (action === 'decline') {
      const updated = { ...offer, status: 'DECLINED' };
      await supabase.from('messages').update({ content: JSON.stringify(updated) }).eq('id', message.id);
      await insertMessage(convo, me.id, `Offer declined: ${offer.qty} units at ${Number(offer.p).toLocaleString()} ETB. Feel free to send a revised offer.`, 'SYSTEM');
      await notify(convo.buyer_id, 'ORDER', 'Offer declined', 'Your offer was declined — you can send a revised offer in the chat.', { conversation_id: convo.id });
      return res.status(200).json({ ok: true, status: 'DECLINED' });
    }

    // accept
    const { data: listing } = await supabase.from('listings').select('*').eq('id', offer.listing_id).maybeSingle();
    if (!listing) return res.status(404).json({ error: 'Listing no longer exists' });
    if (listing.status !== 'ACTIVE') return res.status(400).json({ error: 'This listing is no longer active' });
    const qty = Math.min(Number(offer.qty), Number(listing.quantity));
    if (!(qty > 0)) return res.status(400).json({ error: 'No stock left on this listing' });

    const total = Math.round(qty * Number(offer.p) * 100) / 100;
    const commission = commissionFor(total);
    const net = Math.round((total - commission) * 100) / 100;

    const { data: txn, error } = await supabase
      .from('transactions')
      .insert({
        id: uuid(),
        listing_id: listing.id,
        buyer_id: convo.buyer_id,
        seller_id: convo.seller_id,
        quantity: qty,
        unit_price: Number(offer.p),
        total_amount: total,
        commission_amount: commission,
        net_amount: net,
        currency: 'ETB',
        status: 'PAYMENT_PENDING',
        delivery_method: 'PICKUP',
        notes: `Negotiated in chat (offer ${message.id.slice(0, 8)})`,
        created_at: now(),
      })
      .select().single();
    if (error) throw error;

    const updated = { ...offer, status: 'ACCEPTED', transaction_id: txn.id };
    await supabase.from('messages').update({ content: JSON.stringify(updated) }).eq('id', message.id);
    await insertMessage(convo, me.id, `Offer accepted \u2014 order #${txn.id.slice(0, 8).toUpperCase()} created at ${Number(offer.p).toLocaleString()} ETB/unit. Buyer can now pay via escrow.`, 'SYSTEM');
    await notify(convo.buyer_id, 'ORDER', 'Offer accepted!',
      `Your offer was accepted: ${qty} units at ${Number(offer.p).toLocaleString()} ETB (${total.toLocaleString()} ETB total). Pay now to secure the deal.`,
      { transaction_id: txn.id, conversation_id: convo.id });

    return res.status(201).json({ ok: true, status: 'ACCEPTED', transaction: txn });
  } catch (err) {
    console.error('offers API error:', err);
    res.status(500).json({ error: err.message });
  }
}
