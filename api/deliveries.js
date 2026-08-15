import supabase from './db-client.js';
import { setCors, getAuthProfile, isAdmin, notify, now } from './auth-helper.js';

async function enrichJobs(jobs) {
  if (!jobs.length) return [];
  const txnIds = [...new Set(jobs.map((j) => j.transaction_id).filter(Boolean))];
  const agentIds = [...new Set(jobs.map((j) => j.agent_id).filter(Boolean))];
  const [{ data: txns }, { data: agents }] = await Promise.all([
    txnIds.length ? supabase.from('transactions').select('*').in('id', txnIds) : Promise.resolve({ data: [] }),
    agentIds.length ? supabase.from('profiles').select('id, full_name, company_name, phone, rating_avg').in('id', agentIds) : Promise.resolve({ data: [] }),
  ]);
  const listingIds = [...new Set((txns || []).map((t) => t.listing_id))];
  const userIds = [...new Set((txns || []).flatMap((t) => [t.buyer_id, t.seller_id]))];
  const [{ data: listings }, { data: users }] = await Promise.all([
    listingIds.length ? supabase.from('listings').select('id, title, images, city, unit').in('id', listingIds) : Promise.resolve({ data: [] }),
    userIds.length ? supabase.from('profiles').select('id, full_name, company_name, phone').in('id', userIds) : Promise.resolve({ data: [] }),
  ]);
  const tm = Object.fromEntries((txns || []).map((t) => [t.id, t]));
  const am = Object.fromEntries((agents || []).map((a) => [a.id, a]));
  const lm = Object.fromEntries((listings || []).map((l) => [l.id, l]));
  const um = Object.fromEntries((users || []).map((u) => [u.id, u]));
  return jobs.map((j) => {
    const t = tm[j.transaction_id];
    return {
      ...j,
      agent: j.agent_id ? am[j.agent_id] || null : null,
      transaction: t ? { ...t, listing: lm[t.listing_id] || null, buyer: um[t.buyer_id] || null, seller: um[t.seller_id] || null } : null,
    };
  });
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    const auth = await getAuthProfile(req);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });
    const me = auth.profile;

    if (req.method === 'GET') {
      let jobs = [];
      if (me.role === 'DELIVERY_AGENT') {
        const { data, error } = await supabase
          .from('delivery_jobs').select('*')
          .or(`agent_id.eq.${me.id},status.eq.PENDING`)
          .order('created_at', { ascending: false }).limit(100);
        if (error) throw error;
        jobs = data || [];
      } else if (isAdmin(me)) {
        const { data, error } = await supabase.from('delivery_jobs').select('*').order('created_at', { ascending: false }).limit(200);
        if (error) throw error;
        jobs = data || [];
      } else {
        const { data: txns } = await supabase.from('transactions').select('id').or(`buyer_id.eq.${me.id},seller_id.eq.${me.id}`);
        const ids = (txns || []).map((t) => t.id);
        if (ids.length) {
          const { data, error } = await supabase.from('delivery_jobs').select('*').in('transaction_id', ids).order('created_at', { ascending: false });
          if (error) throw error;
          jobs = data || [];
        }
      }
      return res.status(200).json(await enrichJobs(jobs));
    }

    if (req.method === 'PUT') {
      if (me.role !== 'DELIVERY_AGENT' && !isAdmin(me)) {
        return res.status(403).json({ error: 'Only delivery agents can update jobs' });
      }
      const { job_id, action } = req.body || {};
      const { data: job } = await supabase.from('delivery_jobs').select('*').eq('id', job_id).maybeSingle();
      if (!job) return res.status(404).json({ error: 'Delivery job not found' });
      if (job.agent_id && job.agent_id !== me.id && !isAdmin(me)) {
        return res.status(403).json({ error: 'This job is assigned to another driver' });
      }
      const { data: txn } = await supabase.from('transactions').select('*').eq('id', job.transaction_id).maybeSingle();
      const { data: listing } = txn ? await supabase.from('listings').select('title').eq('id', txn.listing_id).maybeSingle() : { data: null };
      const title = listing?.title || 'order';

      if (action === 'accept') {
        if (job.status !== 'PENDING') return res.status(400).json({ error: 'Job already taken' });
        await supabase.from('delivery_jobs')
          .update({ agent_id: me.id, status: 'ACCEPTED', updated_at: now() }).eq('id', job.id);
        const driver = me.company_name || me.full_name || 'A driver';
        await notify(txn.seller_id, 'ORDER', 'Driver assigned',
          `${driver} accepted the delivery of "${title}" and will contact you for pickup.`, { transaction_id: txn.id });
        await notify(txn.buyer_id, 'ORDER', 'Driver assigned',
          `${driver} will deliver "${title}" to you.`, { transaction_id: txn.id });
        return res.status(200).json({ ok: true, status: 'ACCEPTED' });
      }

      if (action === 'pickup') {
        if (job.status !== 'ACCEPTED') return res.status(400).json({ error: `Job is ${job.status.toLowerCase()}` });
        await supabase.from('delivery_jobs')
          .update({ status: 'PICKED_UP', picked_up_at: now(), updated_at: now() }).eq('id', job.id);
        if (txn.status === 'PAID') {
          await supabase.from('transactions').update({ status: 'DELIVERING', updated_at: now() }).eq('id', txn.id);
        }
        await notify(txn.buyer_id, 'ORDER', 'Materials picked up',
          `"${title}" was collected from the seller and is on the way to ${job.delivery_city || 'you'}.`, { transaction_id: txn.id });
        return res.status(200).json({ ok: true, status: 'PICKED_UP' });
      }

      if (action === 'deliver') {
        if (job.status !== 'PICKED_UP') return res.status(400).json({ error: `Job is ${job.status.toLowerCase()}` });
        await supabase.from('delivery_jobs')
          .update({ status: 'DELIVERED', delivered_at: now(), updated_at: now() }).eq('id', job.id);
        await notify(txn.buyer_id, 'ORDER', 'Delivered \u2014 please confirm',
          `"${title}" was marked delivered by the driver. Confirm receipt to release the escrow to the seller.`, { transaction_id: txn.id });
        await notify(txn.seller_id, 'ORDER', 'Delivery completed',
          `"${title}" was delivered. Escrow releases once the buyer confirms.`, { transaction_id: txn.id });
        return res.status(200).json({ ok: true, status: 'DELIVERED' });
      }

      return res.status(400).json({ error: 'Unknown action' });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('deliveries API error:', err);
    res.status(500).json({ error: err.message });
  }
}
