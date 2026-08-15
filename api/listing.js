import supabase from './db-client.js';
import { setCors, getAuthProfile, isAdmin, notify, now } from './auth-helper.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    const id = req.query?.id || req.body?.id;
    if (!id) return res.status(400).json({ error: 'Missing listing id' });

    if (req.method === 'GET') {
      const { data: listing, error } = await supabase.from('listings').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      if (!listing) return res.status(404).json({ error: 'Listing not found' });

      supabase.from('listings').update({ view_count: (listing.view_count || 0) + 1 }).eq('id', id).then(() => {});

      const { data: seller } = await supabase
        .from('profiles')
        .select('id, full_name, company_name, city, region, rating_avg, rating_count, kyc_status, total_transactions, created_at, role')
        .eq('id', listing.seller_id).maybeSingle();

      const { data: related } = await supabase
        .from('listings').select('id, title, price_per_unit, unit, city, images, condition, verification_status')
        .eq('category', listing.category).eq('status', 'ACTIVE').neq('id', id).limit(4);

      const { count: sellerActiveCount } = await supabase
        .from('listings').select('id', { count: 'exact', head: true })
        .eq('seller_id', listing.seller_id).eq('status', 'ACTIVE');

      return res.status(200).json({ listing, seller, related: related || [], sellerActiveCount: sellerActiveCount || 0 });
    }

    if (req.method === 'PUT') {
      const auth = await getAuthProfile(req);
      if (auth.error) return res.status(auth.status).json({ error: auth.error });
      const { data: listing } = await supabase.from('listings').select('*').eq('id', id).maybeSingle();
      if (!listing) return res.status(404).json({ error: 'Listing not found' });
      if (listing.seller_id !== auth.profile.id && !isAdmin(auth.profile)) {
        return res.status(403).json({ error: 'Not authorized to edit this listing' });
      }
      const b = req.body || {};
      const allowed = ['title', 'description', 'condition', 'unit', 'city', 'region', 'images', 'category'];
      const patch = {};
      for (const k of allowed) if (b[k] !== undefined) patch[k] = b[k];
      if (b.is_negotiable !== undefined) patch.is_negotiable = !!b.is_negotiable;
      if (b.quantity !== undefined) {
        if (!(Number(b.quantity) > 0)) return res.status(400).json({ error: 'Quantity must be greater than zero' });
        patch.quantity = Number(b.quantity);
      }
      if (b.price_per_unit !== undefined) {
        if (!(Number(b.price_per_unit) > 0)) return res.status(400).json({ error: 'Price must be greater than zero' });
        patch.price_per_unit = Number(b.price_per_unit);
      }
      patch.total_price = Math.round(Number(patch.quantity ?? listing.quantity) * Number(patch.price_per_unit ?? listing.price_per_unit) * 100) / 100;
      if (b.action === 'mark_sold') patch.status = 'SOLD';
      if (b.action === 'relist') {
        patch.status = 'ACTIVE';
        patch.expires_at = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
      }
      if (b.action === 'pause') patch.status = 'SUSPENDED';

      const { data, error } = await supabase.from('listings').update({ ...patch, updated_at: now() }).eq('id', id).select().single();
      if (error) throw error;

      // Price-drop alerts to everyone watching this listing
      if (patch.price_per_unit !== undefined && Number(patch.price_per_unit) < Number(listing.price_per_unit)) {
        const { data: watchers } = await supabase.from('watchlist').select('user_id').eq('listing_id', id).limit(200);
        for (const w of watchers || []) {
          if (w.user_id === listing.seller_id) continue;
          await notify(w.user_id, 'ORDER', 'Price dropped on your watchlist',
            `\"${listing.title}\" is now ${Number(patch.price_per_unit).toLocaleString()} ETB/${listing.unit} (was ${Number(listing.price_per_unit).toLocaleString()} ETB).`,
            { listing_id: id });
        }
      }
      return res.status(200).json(data);
    }

    if (req.method === 'DELETE') {
      const auth = await getAuthProfile(req);
      if (auth.error) return res.status(auth.status).json({ error: auth.error });
      const { data: listing } = await supabase.from('listings').select('seller_id').eq('id', id).maybeSingle();
      if (!listing) return res.status(404).json({ error: 'Listing not found' });
      if (listing.seller_id !== auth.profile.id && !isAdmin(auth.profile)) {
        return res.status(403).json({ error: 'Not authorized to delete this listing' });
      }
      await supabase.from('watchlist').delete().eq('listing_id', id);
      const { error } = await supabase.from('listings').delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('listing API error:', err);
    res.status(500).json({ error: err.message });
  }
}
