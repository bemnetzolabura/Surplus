import supabase from './db-client.js';
import { setCors, getAuthProfile, isAdmin, notify, now } from './auth-helper.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    const auth = await getAuthProfile(req);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });
    const me = auth.profile.id;

    if (req.method === 'GET') {
      let escrows;
      if (isAdmin(auth.profile)) {
        const { data, error } = await supabase.from('escrows').select('*').order('created_at', { ascending: false }).limit(200);
        if (error) throw error;
        escrows = data || [];
      } else {
        const { data: txns } = await supabase.from('transactions').select('id').or(`buyer_id.eq.${me},seller_id.eq.${me}`);
        const ids = (txns || []).map((t) => t.id);
        if (!ids.length) return res.status(200).json([]);
        const { data, error } = await supabase.from('escrows').select('*').in('transaction_id', ids).order('created_at', { ascending: false });
        if (error) throw error;
        escrows = data || [];
      }
      const txnIds = escrows.map((e) => e.transaction_id);
      const { data: txns } = txnIds.length ? await supabase.from('transactions').select('*').in('id', txnIds) : { data: [] };
      const listingIds = [...new Set((txns || []).map((t) => t.listing_id))];
      const { data: listings } = listingIds.length ? await supabase.from('listings').select('id, title, images').in('id', listingIds) : { data: [] };
      const userIds = [...new Set((txns || []).flatMap((t) => [t.buyer_id, t.seller_id]))];
      const { data: users } = userIds.length ? await supabase.from('profiles').select('id, full_name, company_name').in('id', userIds) : { data: [] };
      const tm = Object.fromEntries((txns || []).map((t) => [t.id, t]));
      const lm = Object.fromEntries((listings || []).map((l) => [l.id, l]));
      const um = Object.fromEntries((users || []).map((u) => [u.id, u]));
      return res.status(200).json(escrows.map((e) => {
        const t = tm[e.transaction_id];
        return {
          ...e,
          transaction: t ? { ...t, listing: lm[t.listing_id] || null, buyer: um[t.buyer_id] || null, seller: um[t.seller_id] || null } : null,
        };
      }));
    }

    if (req.method === 'PUT') {
      if (!isAdmin(auth.profile)) return res.status(403).json({ error: 'Admin access required' });
      const { escrow_id, action } = req.body || {};
      const { data: escrow } = await supabase.from('escrows').select('*').eq('id', escrow_id).maybeSingle();
      if (!escrow) return res.status(404).json({ error: 'Escrow not found' });
      const { data: txn } = await supabase.from('transactions').select('*').eq('id', escrow.transaction_id).maybeSingle();
      const { data: listing } = await supabase.from('listings').select('title').eq('id', txn.listing_id).maybeSingle();
      const title = listing?.title || 'order';

      if (action === 'release') {
        if (!['HELD', 'DISPUTED', 'PENDING'].includes(escrow.status)) return res.status(400).json({ error: `Escrow is ${escrow.status}` });
        await supabase.from('escrows')
          .update({ status: 'RELEASED', released_at: now(), released_by: me, updated_at: now() }).eq('id', escrow.id);
        await supabase.from('transactions')
          .update({ status: 'COMPLETED', completed_at: now(), dispute_resolved_at: txn.dispute_reason ? now() : null, updated_at: now() }).eq('id', txn.id);
        await notify(txn.seller_id, 'ESCROW', 'Escrow released by admin',
          `${Number(escrow.net_amount).toLocaleString()} ETB released for "${title}".`, { transaction_id: txn.id });
        await notify(txn.buyer_id, 'ESCROW', 'Escrow settled',
          `The escrow for "${title}" was released to the seller.`, { transaction_id: txn.id });
        return res.status(200).json({ ok: true, status: 'RELEASED' });
      }

      if (action === 'refund') {
        if (!['HELD', 'DISPUTED', 'PENDING'].includes(escrow.status)) return res.status(400).json({ error: `Escrow is ${escrow.status}` });
        await supabase.from('escrows')
          .update({ status: 'REFUNDED', refund_reason: 'Refund approved by admin', updated_at: now() }).eq('id', escrow.id);
        await supabase.from('transactions')
          .update({ status: 'REFUNDED', dispute_resolved_at: now(), updated_at: now() }).eq('id', txn.id);
        await supabase.from('payments')
          .update({ status: 'REFUNDED', refunded_at: now() }).eq('transaction_id', txn.id).eq('status', 'SUCCESS');
        await notify(txn.buyer_id, 'ESCROW', 'Refund approved',
          `${Number(escrow.amount).toLocaleString()} ETB refunded for "${title}".`, { transaction_id: txn.id });
        await notify(txn.seller_id, 'ESCROW', 'Escrow refunded to buyer',
          `The escrow for "${title}" was refunded to the buyer.`, { transaction_id: txn.id });
        return res.status(200).json({ ok: true, status: 'REFUNDED' });
      }

      return res.status(400).json({ error: 'Unknown action' });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('escrows API error:', err);
    res.status(500).json({ error: err.message });
  }
}
