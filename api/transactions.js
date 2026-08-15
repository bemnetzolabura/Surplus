import supabase from './db-client.js';
import { setCors, getAuthProfile, isAdmin, notify, notifyAdmins, commissionFor, uuid, now } from './auth-helper.js';

async function enrich(txns) {
  if (!txns.length) return [];
  const listingIds = [...new Set(txns.map((t) => t.listing_id))];
  const userIds = [...new Set(txns.flatMap((t) => [t.buyer_id, t.seller_id]))];
  const txnIds = txns.map((t) => t.id);
  const [{ data: listings }, { data: users }, { data: escrows }, { data: payments }] = await Promise.all([
    supabase.from('listings').select('id, title, images, unit, city, status').in('id', listingIds),
    supabase.from('profiles').select('id, full_name, company_name, kyc_status, rating_avg').in('id', userIds),
    supabase.from('escrows').select('*').in('transaction_id', txnIds),
    supabase.from('payments').select('*').in('transaction_id', txnIds),
  ]);
  const lm = Object.fromEntries((listings || []).map((l) => [l.id, l]));
  const um = Object.fromEntries((users || []).map((u) => [u.id, u]));
  const em = Object.fromEntries((escrows || []).map((e) => [e.transaction_id, e]));
  const pm = {};
  for (const p of payments || []) if (!pm[p.transaction_id] || p.created_at > pm[p.transaction_id].created_at) pm[p.transaction_id] = p;
  return txns.map((t) => ({ ...t, listing: lm[t.listing_id] || null, buyer: um[t.buyer_id] || null, seller: um[t.seller_id] || null, escrow: em[t.id] || null, payment: pm[t.id] || null }));
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    const auth = await getAuthProfile(req);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });
    const me = auth.profile.id;

    if (req.method === 'GET') {
      const single = req.query?.id;
      if (single) {
        const { data: txn } = await supabase.from('transactions').select('*').eq('id', single).maybeSingle();
        if (!txn) return res.status(404).json({ error: 'Transaction not found' });
        if (txn.buyer_id !== me && txn.seller_id !== me && !isAdmin(auth.profile)) {
          return res.status(403).json({ error: 'Not authorized' });
        }
        const [enriched] = await enrich([txn]);
        return res.status(200).json(enriched);
      }
      const { data: txns, error } = await supabase
        .from('transactions').select('*')
        .or(`buyer_id.eq.${me},seller_id.eq.${me}`)
        .order('created_at', { ascending: false }).limit(100);
      if (error) throw error;
      return res.status(200).json(await enrich(txns || []));
    }

    if (req.method === 'POST') {
      const { listing_id, quantity } = req.body || {};
      const qty = Number(quantity);
      if (!listing_id || !(qty > 0)) return res.status(400).json({ error: 'Provide listing_id and a quantity greater than zero' });

      const { data: listing } = await supabase.from('listings').select('*').eq('id', listing_id).maybeSingle();
      if (!listing) return res.status(404).json({ error: 'Listing not found' });
      if (listing.status !== 'ACTIVE') return res.status(400).json({ error: 'This listing is no longer available' });
      if (listing.seller_id === me) return res.status(400).json({ error: 'You cannot buy your own listing' });
      if (qty > Number(listing.quantity)) return res.status(400).json({ error: `Only ${listing.quantity} ${listing.unit} available` });

      const total = Math.round(qty * Number(listing.price_per_unit) * 100) / 100;
      const commission = commissionFor(total);
      const net = Math.round((total - commission) * 100) / 100;

      const { data: txn, error } = await supabase
        .from('transactions')
        .insert({
          id: uuid(),
          listing_id,
          buyer_id: me,
          seller_id: listing.seller_id,
          quantity: qty,
          unit_price: Number(listing.price_per_unit),
          total_amount: total,
          commission_amount: commission,
          net_amount: net,
          currency: 'ETB',
          status: 'PAYMENT_PENDING',
          delivery_method: 'PICKUP',
          created_at: now(),
        })
        .select().single();
      if (error) throw error;

      const buyerName = auth.profile.company_name || auth.profile.full_name || 'A buyer';
      await notify(listing.seller_id, 'ORDER', 'New purchase order',
        `${buyerName} ordered ${qty} ${listing.unit} of "${listing.title}" (${total.toLocaleString()} ETB).`,
        { transaction_id: txn.id });

      const [enriched] = await enrich([txn]);
      return res.status(201).json(enriched);
    }

    if (req.method === 'PUT') {
      const { id, action, reason } = req.body || {};
      const { data: txn } = await supabase.from('transactions').select('*').eq('id', id).maybeSingle();
      if (!txn) return res.status(404).json({ error: 'Transaction not found' });
      const isBuyer = txn.buyer_id === me;
      const isSeller = txn.seller_id === me;
      if (!isBuyer && !isSeller && !isAdmin(auth.profile)) return res.status(403).json({ error: 'Not authorized' });

      const { data: listing } = await supabase.from('listings').select('*').eq('id', txn.listing_id).maybeSingle();
      const title = listing?.title || 'your order';

      if (action === 'set_delivery') {
        if (!isBuyer) return res.status(403).json({ error: 'Only the buyer chooses delivery' });
        if (txn.status !== 'PAYMENT_PENDING') return res.status(400).json({ error: 'Delivery option is locked after payment' });
        const { delivery_method, delivery_city, delivery_address_line } = req.body;
        if (!['PICKUP', 'SELF_ARRANGED', 'DELIVERY_AGENT'].includes(delivery_method)) {
          return res.status(400).json({ error: 'Invalid delivery method' });
        }
        if (delivery_method === 'DELIVERY_AGENT' && (!delivery_city || !delivery_address_line)) {
          return res.status(400).json({ error: 'Provide delivery city and address' });
        }
        await supabase.from('transactions')
          .update({ delivery_method, updated_at: now() }).eq('id', txn.id);
        const { data: existing } = await supabase
          .from('delivery_choices').select('id').eq('transaction_id', txn.id).maybeSingle();
        if (existing) {
          await supabase.from('delivery_choices')
            .update({ delivery_method, city: delivery_city || null, address_line: delivery_address_line || null, updated_at: now() })
            .eq('id', existing.id);
        } else {
          await supabase.from('delivery_choices')
            .insert({ id: uuid(), transaction_id: txn.id, delivery_method, city: delivery_city || null, address_line: delivery_address_line || null, created_at: now() });
        }
        return res.status(200).json({ ok: true, delivery_method });
      }

      if (action === 'cancel') {
        if (!['PAYMENT_PENDING', 'NEGOTIATING'].includes(txn.status)) {
          return res.status(400).json({ error: 'Order can only be cancelled before payment' });
        }
        await supabase.from('transactions').update({ status: 'CANCELLED', updated_at: now() }).eq('id', txn.id);
        await notify(isBuyer ? txn.seller_id : txn.buyer_id, 'ORDER',
          'Order cancelled', `The order for "${title}" was cancelled.`, { transaction_id: txn.id });
        return res.status(200).json({ ok: true, status: 'CANCELLED' });
      }

      if (action === 'ship') {
        if (!isSeller && !isAdmin(auth.profile)) return res.status(403).json({ error: 'Only the seller can mark as dispatched' });
        if (txn.status !== 'PAID') return res.status(400).json({ error: 'Order must be PAID before dispatch' });
        await supabase.from('transactions').update({ status: 'DELIVERING', updated_at: now() }).eq('id', txn.id);
        await notify(txn.buyer_id, 'ORDER', 'Order dispatched',
          `"${title}" is on the way. Confirm delivery once you receive the materials.`, { transaction_id: txn.id });
        return res.status(200).json({ ok: true, status: 'DELIVERING' });
      }

      if (action === 'confirm_delivery') {
        if (!isBuyer) return res.status(403).json({ error: 'Only the buyer can confirm delivery' });
        if (!['DELIVERING', 'PAID'].includes(txn.status)) {
          return res.status(400).json({ error: 'Order is not in a deliverable state' });
        }
        await supabase.from('transactions').update({ status: 'COMPLETED', completed_at: now(), updated_at: now() }).eq('id', txn.id);

        // Release escrow to the seller (net of commission)
        const { data: escrow } = await supabase.from('escrows').select('*').eq('transaction_id', txn.id).maybeSingle();
        if (escrow && ['HELD', 'PENDING'].includes(escrow.status)) {
          await supabase.from('escrows')
            .update({ status: 'RELEASED', released_at: now(), updated_at: now() }).eq('id', escrow.id);
        }

        // Decrement stock, mark SOLD when depleted
        if (listing) {
          const remaining = Math.round((Number(listing.quantity) - Number(txn.quantity)) * 1000) / 1000;
          const patch = { quantity: Math.max(remaining, 0), total_price: Math.max(remaining, 0) * Number(listing.price_per_unit) };
          if (remaining <= 0) patch.status = 'SOLD';
          await supabase.from('listings').update(patch).eq('id', listing.id);
        }

        await supabase.from('profiles').update({ total_transactions: (auth.profile.total_transactions || 0) + 1 }).eq('id', txn.buyer_id);
        const { data: sellerProf } = await supabase.from('profiles').select('total_transactions').eq('id', txn.seller_id).maybeSingle();
        await supabase.from('profiles').update({ total_transactions: (sellerProf?.total_transactions || 0) + 1 }).eq('id', txn.seller_id);

        await notify(txn.seller_id, 'ESCROW', 'Escrow released',
          `${Number(txn.net_amount).toLocaleString()} ETB was released to you for "${title}" (commission ${Number(txn.commission_amount).toLocaleString()} ETB deducted).`,
          { transaction_id: txn.id });
        return res.status(200).json({ ok: true, status: 'COMPLETED' });
      }

      if (action === 'dispute') {
        if (!['PAID', 'DELIVERING'].includes(txn.status)) {
          return res.status(400).json({ error: 'Only paid orders can be disputed' });
        }
        await supabase.from('transactions')
          .update({ status: 'DISPUTED', dispute_reason: String(reason || '').slice(0, 1000), updated_at: now() }).eq('id', txn.id);
        await supabase.from('escrows').update({ status: 'DISPUTED', updated_at: now() }).eq('transaction_id', txn.id);
        await notify(isBuyer ? txn.seller_id : txn.buyer_id, 'DISPUTE', 'Dispute opened',
          `A dispute was opened for "${title}". SurplusSell admins will review the case.`, { transaction_id: txn.id });
        await notifyAdmins('DISPUTE', 'Dispute needs resolution',
          `Transaction ${txn.id.slice(0, 8)} for "${title}" (${Number(txn.total_amount).toLocaleString()} ETB) is disputed.`,
          { transaction_id: txn.id });
        return res.status(200).json({ ok: true, status: 'DISPUTED' });
      }

      return res.status(400).json({ error: 'Unknown action' });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('transactions API error:', err);
    res.status(500).json({ error: err.message });
  }
}
