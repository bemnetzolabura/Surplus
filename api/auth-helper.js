import supabase from './db-client.js';

export function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export const COMMISSION_RATE = 0.06;
export const COMMISSION_MIN = 200;

export function commissionFor(total) {
  const t = Number(total) || 0;
  if (t <= 0) return 0;
  return Math.max(Math.round(t * COMMISSION_RATE * 100) / 100, COMMISSION_MIN);
}

export function uuid() {
  return crypto.randomUUID();
}

export function now() {
  return new Date().toISOString();
}

// --- Logistics: approximate road distances (km) between service cities ---
const CITY_KM = {
  'Addis Ababa~Adama': 100,
  'Addis Ababa~Bishoftu': 45,
  'Addis Ababa~Hawassa': 275,
  'Addis Ababa~Bahir Dar': 565,
  'Addis Ababa~Dire Dawa': 445,
  'Addis Ababa~Mekelle': 780,
  'Addis Ababa~Gondar': 725,
  'Addis Ababa~Jimma': 350,
  'Addis Ababa~Hossana': 230,
  'Adama~Bishoftu': 50,
  'Adama~Hawassa': 220,
  'Adama~Dire Dawa': 360,
  'Adama~Bahir Dar': 650,
  'Adama~Mekelle': 860,
  'Adama~Gondar': 820,
  'Adama~Jimma': 400,
  'Adama~Hossana': 300,
  'Bishoftu~Hawassa': 260,
  'Bishoftu~Dire Dawa': 400,
  'Bishoftu~Bahir Dar': 600,
  'Bishoftu~Mekelle': 800,
  'Bishoftu~Jimma': 380,
  'Bahir Dar~Mekelle': 480,
  'Bahir Dar~Gondar': 180,
  'Dire Dawa~Hawassa': 520,
  'Dire Dawa~Mekelle': 760,
  'Gondar~Mekelle': 360,
  'Hawassa~Jimma': 310,
  'Hawassa~Hossana': 120,
};

export function distanceKm(a, b) {
  if (!a || !b) return 550;
  if (a === b) return 0;
  const pair = [a, b].sort();
  return CITY_KM[`${pair[0]}~${pair[1]}`] ?? 550;
}

export function deliveryFeeETB(km) {
  return Math.round((400 + Math.max(km, 0) * 3.5) / 10) * 10;
}

// Resolve the caller's profile: by auth_user_id, else link by email, else create a fresh BUYER profile.
export async function getAuthProfile(req) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return { error: 'Authentication required', status: 401 };

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return { error: 'Invalid or expired token', status: 401 };

  let { data: profile } = await supabase
    .from('profiles').select('*').eq('auth_user_id', user.id).maybeSingle();

  if (!profile && user.email) {
    const { data: byEmail } = await supabase
      .from('profiles').select('*').eq('email', user.email).maybeSingle();
    if (byEmail) {
      const { data: linked } = await supabase
        .from('profiles').update({ auth_user_id: user.id }).eq('id', byEmail.id).select().single();
      profile = linked || byEmail;
    }
  }

  if (!profile) {
    const meta = user.user_metadata || {};
    const role = ['SELLER', 'DELIVERY_AGENT'].includes(meta.role) ? meta.role : 'BUYER';
    const { data: created, error: cErr } = await supabase
      .from('profiles')
      .insert({
        id: uuid(),
        auth_user_id: user.id,
        email: user.email || null,
        full_name: meta.full_name || (user.email ? user.email.split('@')[0] : 'User'),
        company_name: meta.company_name || null,
        role,
        status: 'ACTIVE',
        kyc_status: 'UNVERIFIED',
        rating_avg: 0,
        rating_count: 0,
        total_transactions: 0,
        created_at: now(),
      })
      .select().single();
    if (cErr) return { error: cErr.message, status: 500 };
    profile = created;
  }

  if (profile.status === 'SUSPENDED') return { error: 'Account suspended. Contact support.', status: 403, profile };
  return { user, profile };
}

export function isAdmin(profile) {
  return profile && (profile.role === 'ADMIN' || profile.role === 'SUPER_ADMIN');
}

export async function notify(userId, type, title, message, data = {}) {
  if (!userId) return;
  try {
    await supabase.from('notifications').insert({
      id: uuid(), user_id: userId, type, title, message, data,
      is_read: false, created_at: now(),
    });
  } catch (e) {
    console.error('notify failed', e);
  }
}

export async function notifyAdmins(type, title, message, data = {}) {
  const { data: admins } = await supabase.from('profiles').select('id').in('role', ['ADMIN', 'SUPER_ADMIN']);
  for (const a of admins || []) await notify(a.id, type, title, message, data);
}

export async function notifyRole(role, type, title, message, data = {}) {
  const { data: ps } = await supabase.from('profiles').select('id').eq('role', role).eq('status', 'ACTIVE');
  for (const p of ps || []) await notify(p.id, type, title, message, data);
}

// Insert a message into a conversation and bump the counterparty's unread counter.
export async function insertMessage(convo, senderId, content, messageType = 'TEXT') {
  const isBuyerSender = convo.buyer_id === senderId;
  const { data: message } = await supabase
    .from('messages')
    .insert({ id: uuid(), conversation_id: convo.id, sender_id: senderId, content, message_type: messageType, is_read: false, created_at: now() })
    .select().single();
  await supabase.from('conversations')
    .update({
      last_message_at: now(),
      ...(isBuyerSender ? { unread_seller: (convo.unread_seller || 0) + 1 } : { unread_buyer: (convo.unread_buyer || 0) + 1 }),
    })
    .eq('id', convo.id);
  return message;
}
