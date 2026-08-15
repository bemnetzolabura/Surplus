import supabase from './db-client.js';
import { setCors, getAuthProfile, notifyAdmins, uuid, now } from './auth-helper.js';

const VALID_CONDITIONS = ['NEW', 'LIKE_NEW', 'GOOD', 'FAIR', 'SALVAGE'];

// Bulk dealer import: validate and create many listings in one shot.
export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const auth = await getAuthProfile(req);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });
    const { profile } = auth;
    if (!['SELLER', 'ADMIN', 'SUPER_ADMIN'].includes(profile.role)) {
      return res.status(403).json({ error: 'Only sellers can bulk import listings' });
    }

    const rows = Array.isArray(req.body?.listings) ? req.body.listings.slice(0, 50) : [];
    if (!rows.length) return res.status(400).json({ error: 'No rows provided' });

    const { data: cats } = await supabase.from('categories').select('slug, name');
    const slugSet = new Set((cats || []).map((c) => c.slug));

    const results = [];
    let created = 0;
    for (const row of rows) {
      const title = String(row.title || '').trim().slice(0, 255);
      const description = String(row.description || '').trim().slice(0, 4000) || `Bulk-imported surplus lot: ${title}. Contact seller for full specifications and yard inspection.`;
      const category = String(row.category || '').trim();
      const condition = String(row.condition || 'GOOD').trim().toUpperCase().replace(/[\s-]+/g, '_');
      const quantity = Number(row.quantity);
      const unit = String(row.unit || 'piece').trim().slice(0, 30);
      const price = Number(row.price_per_unit);
      const city = String(row.city || profile.city || 'Addis Ababa').trim().slice(0, 80);
      const images = Array.isArray(row.images) && row.images.length ? row.images.slice(0, 4) : (row.image ? [String(row.image)] : []);

      let error = '';
      if (title.length < 8) error = 'Title too short (min 8 characters)';
      else if (!slugSet.has(category)) error = `Unknown category "${category}"`;
      else if (!VALID_CONDITIONS.includes(condition)) error = `Unknown condition "${condition}"`;
      else if (!(quantity > 0)) error = 'Quantity must be positive';
      else if (!(price > 0)) error = 'Price must be positive';

      if (error) {
        results.push({ ok: false, title: title || '(untitled)', error });
        continue;
      }

      const total = Math.round(quantity * price * 100) / 100;
      const status = total < 10000 ? 'ACTIVE' : 'PENDING_APPROVAL';
      const { data: inserted, error: iErr } = await supabase
        .from('listings')
        .insert({
          id: uuid(),
          seller_id: profile.id,
          title,
          description,
          category,
          condition,
          quantity,
          unit,
          price_per_unit: price,
          total_price: total,
          currency: 'ETB',
          is_negotiable: row.is_negotiable !== false,
          city,
          region: row.region ? String(row.region).slice(0, 80) : '',
          status,
          verification_status: 'UNVERIFIED',
          view_count: 0,
          images,
          featured: false,
          expires_at: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
          created_at: now(),
        })
        .select('id')
        .single();
      if (iErr) {
        results.push({ ok: false, title, error: iErr.message });
      } else {
        created++;
        results.push({ ok: true, title, status, id: inserted.id });
      }
    }

    const pendingCount = results.filter((r) => r.ok && r.status === 'PENDING_APPROVAL').length;
    if (pendingCount > 0) {
      await notifyAdmins('MODERATION', `${pendingCount} bulk imports pending approval`,
        `${profile.company_name || profile.full_name} imported ${created} listings via CSV; ${pendingCount} exceed 10,000 ETB.`,
        {});
    }

    return res.status(200).json({ created, failed: results.length - created, results });
  } catch (err) {
    console.error('bulk API error:', err);
    res.status(500).json({ error: err.message });
  }
}
