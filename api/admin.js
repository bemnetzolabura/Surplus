import supabase from './db-client.js';
import { setCors, getAuthProfile, isAdmin, notify, now } from './auth-helper.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    const auth = await getAuthProfile(req);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });
    if (!isAdmin(auth.profile)) return res.status(403).json({ error: 'Admin access required' });

    if (req.method === 'GET') {
      const resource = req.query?.resource;
      if (resource === 'users') {
        const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(300);
        if (error) throw error;
        return res.status(200).json(data || []);
      }
      if (resource === 'listings') {
        const { data, error } = await supabase.from('listings').select('*').order('created_at', { ascending: false }).limit(300);
        if (error) throw error;
        const sellerIds = [...new Set((data || []).map((l) => l.seller_id))];
        let sellers = {};
        if (sellerIds.length) {
          const { data: ps } = await supabase.from('profiles').select('id, full_name, company_name, email').in('id', sellerIds);
          sellers = Object.fromEntries((ps || []).map((p) => [p.id, p]));
        }
        return res.status(200).json((data || []).map((l) => ({ ...l, seller: sellers[l.seller_id] || null })));
      }
      if (resource === 'transactions') {
        const { data, error } = await supabase.from('transactions').select('*').order('created_at', { ascending: false }).limit(300);
        if (error) throw error;
        const listingIds = [...new Set((data || []).map((t) => t.listing_id))];
        const userIds = [...new Set((data || []).flatMap((t) => [t.buyer_id, t.seller_id]))];
        const [{ data: listings }, { data: users }] = await Promise.all([
          listingIds.length ? supabase.from('listings').select('id, title').in('id', listingIds) : Promise.resolve({ data: [] }),
          userIds.length ? supabase.from('profiles').select('id, full_name, company_name, email').in('id', userIds) : Promise.resolve({ data: [] }),
        ]);
        const lm = Object.fromEntries((listings || []).map((l) => [l.id, l]));
        const um = Object.fromEntries((users || []).map((u) => [u.id, u]));
        return res.status(200).json((data || []).map((t) => ({ ...t, listing: lm[t.listing_id] || null, buyer: um[t.buyer_id] || null, seller: um[t.seller_id] || null })));
      }
      return res.status(400).json({ error: 'Unknown resource' });
    }

    if (req.method === 'PUT') {
      const { resource, id, action, value } = req.body || {};

      if (resource === 'user') {
        const { data: user } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();
        if (!user) return res.status(404).json({ error: 'User not found' });
        if (action === 'suspend') {
          await supabase.from('profiles').update({ status: 'SUSPENDED' }).eq('id', id);
          await notify(id, 'ADMIN', 'Account suspended', 'Your account was suspended by SurplusSell administration. Contact support for details.');
        } else if (action === 'activate') {
          await supabase.from('profiles').update({ status: 'ACTIVE' }).eq('id', id);
          await notify(id, 'ADMIN', 'Account reactivated', 'Your account is active again. Welcome back!');
        } else if (action === 'set_role') {
          const allowed = ['BUYER', 'SELLER', 'VERIFICATION_AGENT', 'DELIVERY_AGENT', 'ADMIN'];
          if (!allowed.includes(value)) return res.status(400).json({ error: 'Invalid role' });
          await supabase.from('profiles').update({ role: value }).eq('id', id);
          await notify(id, 'ADMIN', 'Role updated', `Your account role was updated to ${value}.`);
        } else if (action === 'verify_kyc') {
          await supabase.from('profiles').update({ kyc_status: 'VERIFIED' }).eq('id', id);
          await notify(id, 'ADMIN', 'KYC verified', 'Your identity documents were verified. You now carry the Verified badge.');
        } else {
          return res.status(400).json({ error: 'Unknown action' });
        }
        return res.status(200).json({ ok: true });
      }

      if (resource === 'listing') {
        const { data: listing } = await supabase.from('listings').select('*').eq('id', id).maybeSingle();
        if (!listing) return res.status(404).json({ error: 'Listing not found' });
        const statusMap = { approve: 'ACTIVE', reject: 'REJECTED', suspend: 'SUSPENDED', activate: 'ACTIVE', feature: null, unfeature: null };
        if (action === 'feature' || action === 'unfeature') {
          await supabase.from('listings').update({ featured: action === 'feature', updated_at: now() }).eq('id', id);
        } else if (statusMap[action]) {
          await supabase.from('listings').update({ status: statusMap[action], updated_at: now(), published_at: action === 'approve' ? now() : listing.published_at }).eq('id', id);
          await notify(listing.seller_id, 'MODERATION',
            action === 'approve' || action === 'activate' ? 'Listing approved' : `Listing ${action}ed`,
            action === 'approve' || action === 'activate'
              ? `"${listing.title}" is now live on the marketplace.`
              : `"${listing.title}" was ${action}ed by moderation.`,
            { listing_id: id });
        } else {
          return res.status(400).json({ error: 'Unknown action' });
        }
        return res.status(200).json({ ok: true });
      }

      return res.status(400).json({ error: 'Unknown resource' });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('admin API error:', err);
    res.status(500).json({ error: err.message });
  }
}
