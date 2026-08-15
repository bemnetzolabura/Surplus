import supabase from './db-client.js';
import { setCors, getAuthProfile, isAdmin } from './auth-helper.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    // Public stats + live price index
    const { data: activeListings, error } = await supabase
      .from('listings')
      .select('id, category, price_per_unit, unit, city')
      .eq('status', 'ACTIVE');
    if (error) throw error;

    const byCat = {};
    const byCity = {};
    for (const l of activeListings || []) {
      const c = l.category || 'other';
      const price = Number(l.price_per_unit) || 0;
      if (!byCat[c]) byCat[c] = { category: c, count: 0, total: 0, min: price, max: price, units: {}, cities: new Set() };
      byCat[c].count += 1;
      byCat[c].total += price;
      byCat[c].min = Math.min(byCat[c].min, price);
      byCat[c].max = Math.max(byCat[c].max, price);
      byCat[c].units[l.unit] = (byCat[c].units[l.unit] || 0) + 1;
      if (l.city) {
        byCat[c].cities.add(l.city);
        byCity[l.city] = (byCity[l.city] || 0) + 1;
      }
    }
    const priceIndex = Object.values(byCat).map((c) => {
      const unit = Object.entries(c.units).sort((a, b) => b[1] - a[1])[0]?.[0] || 'unit';
      return {
        category: c.category,
        count: c.count,
        avg_price: Math.round(c.total / c.count),
        min_price: Math.round(c.min),
        max_price: Math.round(c.max),
        unit,
        cities: c.cities.size,
      };
    }).sort((a, b) => b.count - a.count);
    const cityIndex = Object.entries(byCity).map(([city, count]) => ({ city, count })).sort((a, b) => b.count - a.count);

    const [{ count: sellerCount }, { count: completedTxns }, { data: gmvRows }, { count: cityCount }] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }).in('role', ['SELLER', 'ADMIN']),
      supabase.from('transactions').select('id', { count: 'exact', head: true }).eq('status', 'COMPLETED'),
      supabase.from('transactions').select('total_amount').eq('status', 'COMPLETED'),
      supabase.from('listings').select('city', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
    ]);
    const gmv = (gmvRows || []).reduce((s, t) => s + Number(t.total_amount || 0), 0);

    const publicStats = {
      active_listings: (activeListings || []).length,
      sellers: sellerCount || 0,
      completed_transactions: completedTxns || 0,
      gmv,
      estimated_savings: Math.round(gmv * 0.25),
      cities: [...new Set((activeListings || []).map((l) => l.city).filter(Boolean))].length,
      price_index: priceIndex,
      city_index: cityIndex,
    };

    if (req.query?.scope === 'admin') {
      const auth = await getAuthProfile(req);
      if (auth.error) return res.status(auth.status).json({ error: auth.error });
      if (!isAdmin(auth.profile)) return res.status(403).json({ error: 'Admin access required' });

      const [{ data: users }, { data: listings }, { data: txns }, { data: escrows }] = await Promise.all([
        supabase.from('profiles').select('id, role, status, created_at'),
        supabase.from('listings').select('id, status, verification_status, total_price, created_at'),
        supabase.from('transactions').select('id, status, total_amount, commission_amount, created_at'),
        supabase.from('escrows').select('id, status, amount, commission_amount, net_amount'),
      ]);
      const sum = (arr, k) => (arr || []).reduce((s, x) => s + Number(x[k] || 0), 0);
      const byKey = (arr, k) => (arr || []).reduce((m, x) => { m[x[k]] = (m[x[k]] || 0) + 1; return m; }, {});

      return res.status(200).json({
        ...publicStats,
        users_total: (users || []).length,
        users_by_role: byKey(users, 'role'),
        users_suspended: (users || []).filter((u) => u.status === 'SUSPENDED').length,
        listings_total: (listings || []).length,
        listings_by_status: byKey(listings, 'status'),
        listings_verified: (listings || []).filter((l) => l.verification_status === 'VERIFIED').length,
        transactions_total: (txns || []).length,
        transactions_by_status: byKey(txns, 'status'),
        gmv_total: sum(txns, 'total_amount'),
        commission_earned: sum((txns || []).filter((t) => t.status === 'COMPLETED'), 'commission_amount'),
        escrow_held: sum((escrows || []).filter((e) => ['HELD', 'PENDING'].includes(e.status)), 'amount'),
        escrow_disputed: sum((escrows || []).filter((e) => e.status === 'DISPUTED'), 'amount'),
        escrow_released_total: sum((escrows || []).filter((e) => e.status === 'RELEASED'), 'net_amount'),
        disputes_open: (txns || []).filter((t) => t.status === 'DISPUTED').length,
      });
    }

    return res.status(200).json(publicStats);
  } catch (err) {
    console.error('stats API error:', err);
    res.status(500).json({ error: err.message });
  }
}
