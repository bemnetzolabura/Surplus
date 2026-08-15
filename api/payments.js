import supabase from './db-client.js';
import { setCors, getAuthProfile, notify, notifyRole, commissionFor, distanceKm, deliveryFeeETB, uuid, now } from './auth-helper.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    const auth = await getAuthProfile(req);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });
    const me = auth.profile.id;

    if (req.method === 'POST') {
      const { transaction_id } = req.body || {};
      if (!transaction_id) return res.status(400).json({ error: 'Missing transaction_id' });
      const { data: txn } = await supabase.from('transactions').select('*').eq('id', transaction_id).maybeSingle();
      if (!txn) return res.status(404).json({ error: 'Transaction not found' });
      if (txn.buyer_id !== me) return res.status(403).json({ error: 'Only the buyer can pay for this order' });
      if (txn.status !== 'PAYMENT_PENDING') return res.status(400).json({ error: `Order is ${txn.status}; payment not required` });

      // Idempotency: return the existing pending payment instead of double-charging
      const { data: existing } = await supabase
        .from('payments').select('*').eq('transaction_id', transaction_id)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (existing && existing.status === 'SUCCESS') return res.status(400).json({ error: 'Order already paid' });
      if (existing && existing.status === 'PENDING') return res.status(200).json(existing);

      const ref = 'TB-' + Date.now().toString(36).toUpperCase() + '-' + Math.floor(Math.random() * 9000 + 1000);
      const { data: payment, error } = await supabase
        .from('payments')
        .insert({
          id: uuid(),
          transaction_id,
          payer_id: me,
          payee_id: txn.seller_id,
          amount: txn.total_amount,
          commission_amount: txn.commission_amount || commissionFor(txn.total_amount),
          currency: 'ETB',
          payment_method: 'TELEBIRR_MOCK',
          gateway_reference: ref,
          status: 'PENDING',
          idempotency_key: uuid(),
          created_at: now(),
        })
        .select().single();
      if (error) throw error;
      return res.status(201).json(payment);
    }

    if (req.method === 'PUT') {
      const { payment_id } = req.body || {};
      const { data: payment } = await supabase.from('payments').select('*').eq('id', payment_id).maybeSingle();
      if (!payment) return res.status(404).json({ error: 'Payment not found' });
      if (payment.payer_id !== me) return res.status(403).json({ error: 'Not your payment' });
      if (payment.status === 'SUCCESS') return res.status(200).json({ payment, already: true });
      if (payment.status !== 'PENDING') return res.status(400).json({ error: `Payment is ${payment.status}` });

      // Mock Telebirr gateway: confirmation always succeeds
      await supabase.from('payments')
        .update({ status: 'SUCCESS', completed_at: now() }).eq('id', payment.id);

      const { data: txn } = await supabase.from('transactions').select('*').eq('id', payment.transaction_id).maybeSingle();
      await supabase.from('transactions')
        .update({ status: 'PAID', updated_at: now() }).eq('id', payment.transaction_id);

      const holdUntil = new Date(Date.now() + 7 * 24 * 3600 * 1000);
      const { data: existingEscrow } = await supabase
        .from('escrows').select('*').eq('transaction_id', payment.transaction_id).maybeSingle();
      let escrow;
      if (existingEscrow) {
        const { data } = await supabase.from('escrows')
          .update({ status: 'HELD', hold_until: holdUntil.toISOString(), updated_at: now() })
          .eq('id', existingEscrow.id).select().single();
        escrow = data;
      } else {
        const { data } = await supabase.from('escrows')
          .insert({
            id: uuid(),
            transaction_id: payment.transaction_id,
            amount: txn.total_amount,
            commission_amount: txn.commission_amount,
            net_amount: txn.net_amount,
            currency: 'ETB',
            status: 'HELD',
            hold_until: holdUntil.toISOString(),
            created_at: now(),
            updated_at: now(),
          })
          .select().single();
        escrow = data;
      }

      // If the buyer hired a delivery agent, broadcast the job to the driver pool
      if (txn.delivery_method === 'DELIVERY_AGENT') {
        const { data: fullListing } = await supabase.from('listings').select('*').eq('id', txn.listing_id).maybeSingle();
        const { data: choice } = await supabase.from('delivery_choices').select('*').eq('transaction_id', txn.id).maybeSingle();
        const km = distanceKm(fullListing?.city, choice?.city);
        const fee = deliveryFeeETB(km);
        const { data: existingJob } = await supabase.from('delivery_jobs').select('id').eq('transaction_id', txn.id).maybeSingle();
        if (!existingJob) {
          await supabase.from('delivery_jobs').insert({
            id: uuid(),
            transaction_id: txn.id,
            listing_id: txn.listing_id,
            pickup_address: `Seller yard \u2014 ${fullListing?.city || 'TBD'}`,
            pickup_city: fullListing?.city || null,
            delivery_address: choice?.address_line || 'Buyer site',
            delivery_city: choice?.city || null,
            status: 'PENDING',
            distance_km: km,
            fee,
            created_at: now(),
            updated_at: now(),
          });
          await notifyRole('DELIVERY_AGENT', 'ORDER', 'New delivery job available',
            `${fullListing?.title || 'Materials'}: ${fullListing?.city || '?'} \u2192 ${choice?.city || '?'} (${km} km, ${fee.toLocaleString()} ETB fee). Accept it from your dashboard.`,
            { transaction_id: txn.id });
        }
      }

      const { data: listing } = await supabase.from('listings').select('title').eq('id', txn.listing_id).maybeSingle();
      await notify(txn.seller_id, 'PAYMENT', 'Payment secured in escrow',
        `${Number(txn.total_amount).toLocaleString()} ETB for "${listing?.title || 'your listing'}" is held in SurplusSell escrow. Dispatch the materials to receive ${Number(txn.net_amount).toLocaleString()} ETB.`,
        { transaction_id: txn.id });

      return res.status(200).json({ payment: { ...payment, status: 'SUCCESS' }, transaction_status: 'PAID', escrow });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('payments API error:', err);
    res.status(500).json({ error: err.message });
  }
}
