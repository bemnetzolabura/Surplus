import supabase from './db-client.js';
import { setCors, getAuthProfile, isAdmin, notify, uuid, now } from './auth-helper.js';

async function enrichRequests(reqs) {
  if (!reqs.length) return [];
  const listingIds = [...new Set(reqs.map((r) => r.listing_id))];
  const userIds = [...new Set(reqs.flatMap((r) => [r.seller_id, r.agent_id]).filter(Boolean))];
  const [{ data: listings }, { data: users }] = await Promise.all([
    supabase.from('listings').select('id, title, images, condition, quantity, unit, city, verification_status').in('id', listingIds),
    userIds.length ? supabase.from('profiles').select('id, full_name, company_name, city').in('id', userIds) : Promise.resolve({ data: [] }),
  ]);
  const lm = Object.fromEntries((listings || []).map((l) => [l.id, l]));
  const um = Object.fromEntries((users || []).map((u) => [u.id, u]));
  return reqs.map((r) => ({ ...r, listing: lm[r.listing_id] || null, seller: um[r.seller_id] || null, agent: r.agent_id ? um[r.agent_id] || null : null }));
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    const auth = await getAuthProfile(req);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });
    const me = auth.profile;

    if (req.method === 'GET') {
      let query = supabase.from('verification_requests').select('*').order('created_at', { ascending: false }).limit(100);
      if (isAdmin(me)) {
        // all
      } else if (me.role === 'VERIFICATION_AGENT') {
        query = query.or(`agent_id.eq.${me.id},status.eq.PENDING`);
      } else {
        query = query.eq('seller_id', me.id);
      }
      const { data, error } = await query;
      if (error) throw error;
      return res.status(200).json(await enrichRequests(data || []));
    }

    if (req.method === 'POST') {
      const { listing_id } = req.body || {};
      const { data: listing } = await supabase.from('listings').select('*').eq('id', listing_id).maybeSingle();
      if (!listing) return res.status(404).json({ error: 'Listing not found' });
      if (listing.seller_id !== me.id && !isAdmin(me)) return res.status(403).json({ error: 'Only the listing owner can request verification' });
      if (listing.verification_status === 'VERIFIED') return res.status(400).json({ error: 'Listing is already verified' });
      const { data: open } = await supabase
        .from('verification_requests').select('id').eq('listing_id', listing_id)
        .in('status', ['PENDING', 'ASSIGNED', 'IN_PROGRESS']).limit(1);
      if (open && open.length) return res.status(400).json({ error: 'A verification request is already in progress' });

      const { data: request, error } = await supabase
        .from('verification_requests')
        .insert({ id: uuid(), listing_id, seller_id: listing.seller_id, status: 'PENDING', created_at: now() })
        .select().single();
      if (error) throw error;
      await supabase.from('listings').update({ verification_status: 'PENDING' }).eq('id', listing_id);
      return res.status(201).json(request);
    }

    if (req.method === 'PUT') {
      const { request_id, action } = req.body || {};
      const { data: request } = await supabase.from('verification_requests').select('*').eq('id', request_id).maybeSingle();
      if (!request) return res.status(404).json({ error: 'Request not found' });

      if (action === 'assign') {
        const agentId = me.role === 'VERIFICATION_AGENT' ? me.id : (req.body.agent_id || null);
        if (me.role !== 'VERIFICATION_AGENT' && !isAdmin(me)) return res.status(403).json({ error: 'Only agents or admins can assign inspections' });
        if (!agentId) return res.status(400).json({ error: 'Missing agent_id' });
        await supabase.from('verification_requests')
          .update({ agent_id: agentId, status: 'ASSIGNED', updated_at: now() }).eq('id', request.id);
        await notify(request.seller_id, 'VERIFICATION', 'Inspector assigned',
          'A SurplusSell verification agent was assigned to inspect your listing.', { request_id: request.id });
        return res.status(200).json({ ok: true, status: 'ASSIGNED' });
      }

      if (action === 'complete') {
        if (me.role !== 'VERIFICATION_AGENT' && !isAdmin(me)) return res.status(403).json({ error: 'Only verification agents can submit reports' });
        const { result, condition_verified, quantity_verified, inspection_notes } = req.body;
        const finalStatus = result === 'REJECTED' ? 'REJECTED' : 'COMPLETED';
        const listingStatus = result === 'REJECTED' ? 'REJECTED' : 'VERIFIED';
        await supabase.from('verification_requests')
          .update({
            status: finalStatus,
            condition_verified: condition_verified || null,
            quantity_verified: quantity_verified !== undefined ? Number(quantity_verified) : null,
            inspection_notes: String(inspection_notes || '').slice(0, 2000),
            completed_at: now(),
            updated_at: now(),
          })
          .eq('id', request.id);
        await supabase.from('listings').update({ verification_status: listingStatus }).eq('id', request.listing_id);
        await notify(request.seller_id, 'VERIFICATION',
          result === 'REJECTED' ? 'Verification rejected' : 'Listing verified',
          result === 'REJECTED'
            ? `Your listing did not pass inspection: ${inspection_notes || 'see report'}.`
            : 'Your listing passed physical inspection and now carries the Verified badge.',
          { request_id: request.id, listing_id: request.listing_id });
        return res.status(200).json({ ok: true, status: finalStatus });
      }

      return res.status(400).json({ error: 'Unknown action' });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('verification API error:', err);
    res.status(500).json({ error: err.message });
  }
}
