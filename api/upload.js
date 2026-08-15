import supabase from './db-client.js';
import { setCors, getAuthProfile } from './auth-helper.js';

const BUCKET = 'listing-photos';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const auth = await getAuthProfile(req);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });

    const { fileName, fileBase64, contentType } = req.body || {};
    if (!fileBase64 || !contentType) return res.status(400).json({ error: 'Missing file data' });
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(contentType)) return res.status(400).json({ error: 'Only JPEG/PNG/WebP images are allowed' });

    const buffer = Buffer.from(fileBase64, 'base64');
    if (buffer.length > 5 * 1024 * 1024) return res.status(400).json({ error: 'Image must be smaller than 5MB' });

    const ext = (String(fileName || 'photo.jpg').split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
    const path = `${auth.profile.id}/${Date.now()}-${Math.floor(Math.random() * 1e6)}.${ext}`;

    const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, { contentType, upsert: true });
    if (error) throw error;
    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return res.status(200).json({ url: urlData.publicUrl });
  } catch (err) {
    console.error('upload API error:', err);
    res.status(500).json({ error: err.message });
  }
}
