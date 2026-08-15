import supabase from './db-client.js';
import { setCors, getAuthProfile, notifyAdmins, uuid, now } from './auth-helper.js';

const PAGE_SIZE = 12;

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    if (req.method === 'GET') {
      const q = req.query || {};
      let query = supabase.from('listings').select('*');

      if (q.mine === 'true') {
        const auth = await getAuthProfile(req);
        if (auth.error) return res.status(auth.status).json({ error: auth.error });
        query = query.eq('seller_id', auth.profile.id).neq('status', 'DELETED');
      } else if (q.seller_id) {
        query = query.eq('seller_id', q.seller_id).eq('status', 'ACTIVE');
      } else {
        query = query.eq('status', 'ACTIVE');
      }

      if (q.q) {
        const safe = String(q.q).replace(/[%_]/g, '').slice(0, 80);
        query = query.or(`title.ilike.%${safe}%,description.ilike.%${safe}%,city.ilike.%${safe}%`);
      }
      if (q.category) query = query.eq('category', q.category);
      if (q.condition) query = query.eq('condition', q.condition);
      if (q.city) query = query.eq('city', q.city);
      if (q.verified === 'true') query = query.eq('verification_status', 'VERIFIED');
      if (q.negotiable === 'true') query = query.eq('is_negotiable', true);
      if (q.min) query = query.gte('price_per_unit', Number(q.min));
      if (q.max) query = query.lte('price_per_unit', Number(q.max));
      if (q.featured === 'true') query = query.eq('featured', true);
      if (q.ids) query = query.in('id', String(q.ids).split(',').slice(0, 50));
      if (q.after) query = query.gt('created_at', q.after);

      if (q.count_mode === 'true') {
        const { count } = await query.select('id', { count: 'exact', head: true });
        return res.status(200).json({ total: count || 0 });
      }

      const sort = q.sort || 'newest';
      if (sort === 'price_asc') query = query.order('price_per_unit', { ascending: true });
      else if (sort === 'price_desc') query = query.order('price_per_unit', { ascending: false });
      else if (sort === 'popular') query = query.order('view_count', { ascending: false });
      else query = query.order('created_at', { ascending: false });

      const limit = Math.min(Number(q.limit) || PAGE_SIZE, 60);
      const offset = Number(q.offset) || 0;
      query = query.range(offset, offset + limit - 1);

      const { data, error } = await query;
      if (error) throw error;

      // Enrich with seller summary
      const sellerIds = [...new Set((data || []).map((l) => l.seller_id))];
      let sellers = {};
      if (sellerIds.length) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, full_name, company_name, city, rating_avg, rating_count, kyc_status, role')
          .in('id', sellerIds);
        sellers = Object.fromEntries((profs || []).map((p) => [p.id, p]));
      }
      const enriched = (data || []).map((l) => ({ ...l, seller: sellers[l.seller_id] || null }));
      return res.status(200).json({ listings: enriched, count: enriched.length, hasMore: enriched.length === limit });
    }

    if (req.method === 'POST') {
      const auth = await getAuthProfile(req);
      if (auth.error) return res.status(auth.status).json({ error: auth.error });
      const { profile } = auth;
      if (!['SELLER', 'ADMIN', 'SUPER_ADMIN'].includes(profile.role)) {
        return res.status(403).json({ error: 'Only sellers can create listings. Register a seller account.' });
      }
      const b = req.body || {};
      const required = ['title', 'description', 'category', 'condition', 'quantity', 'unit', 'price_per_unit', 'city'];
      for (const k of required) {
        if (b[k] === undefined || b[k] === null || b[k] === '') return res.status(400).json({ error: `Missing field: ${k}` });
      }
      const quantity = Number(b.quantity);
      const price = Number(b.price_per_unit);
      if (!(quantity > 0)) return res.status(400).json({ error: 'Quantity must be greater than zero' });
      if (!(price > 0)) return res.status(400).json({ error: 'Price must be greater than zero' });
      const total = Math.round(quantity * price * 100) / 100;

      // Auto-approve low-value listings, manual review for high value (per blueprint)
      const status = total < 10000 ? 'ACTIVE' : 'PENDING_APPROVAL';
      const expires = new Date(Date.now() + 30 * 24 * 3600 * 1000);

      const { data, error } = await supabase
        .from('listings')
        .insert({
          id: uuid(),
          seller_id: profile.id,
          title: String(b.title).slice(0, 255),
          description: String(b.description).slice(0, 5000),
          category: b.category,
          condition: b.condition,
          quantity,
          unit: b.unit,
          price_per_unit: price,
          total_price: total,
          currency: 'ETB',
          is_negotiable: b.is_negotiable !== false,
          city: b.city,
          region: b.region || '',
          status,
          verification_status: 'UNVERIFIED',
          view_count: 0,
          images: Array.isArray(b.images) ? b.images.slice(0, 10) : [],
          featured: false,
          expires_at: expires.toISOString(),
          created_at: now(),
        })
        .select().single();
      if (error) throw error;

      if (status === 'PENDING_APPROVAL') {
        await notifyAdmins('MODERATION', 'Listing pending approval',
          `"${data.title}" (${total.toLocaleString()} ETB) exceeds 10,000 ETB and needs review.`,
          { listing_id: data.id });
      }
      return res.status(201).json(data);
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('listings API error:', err);
    res.status(500).json({ error: err.message });
  }
}
