import { Router } from 'express';
import Transaction from '../models/Transaction';
import Provider from '../models/Provider';
import Booking from '../models/Booking';
import Customer from '../models/Customer';
import { formatPhoneForWhatsApp } from '../utils/phoneFormatter';

const router = Router();

router.post('/squad', async (req, res) => {
  console.log('[Squad Webhook] Headers:', JSON.stringify(req.headers, null, 2));
  console.log('[Squad Webhook] Raw Body Type:', typeof req.body);
  
  const event = req.body;
  res.status(200).json({ status: 'received' });

  try {
    console.log('[Squad Webhook] event received:', JSON.stringify(event));
    const ref = event?.Body?.transaction_ref || event?.data?.transaction_ref || event?.TransactionRef;
    const status = String(event?.Body?.transaction_status || event?.data?.transaction_status || event?.transaction_status || '').toLowerCase();

    if (!ref) {
      console.warn('[Squad Webhook] missing transaction ref in payload');
      return;
    }

    if (status !== 'success') {
      console.log('[Squad Webhook] ignoring non-success status:', status || 'missing');
      return;
    }

    const transaction = await Transaction.findOne({ squadRef: ref });
    if (!transaction) {
      console.warn('[Squad Webhook] transaction not found for ref:', ref);
      return;
    }

    if (transaction.status === 'success') {
      console.log('[Squad Webhook] transaction already processed:', ref);
      return;
    }

    await Transaction.findOneAndUpdate({ squadRef: ref }, { status: 'success' });

    if (transaction.type === 'verification_fee') {
      const provider = await Provider.findOneAndUpdate({ phone: transaction.phone }, { verified: true, state: 'ACTIVE' }, { new: true });
      // send message via bot when available (handle default export and send errors)
      try {
        const rawClient = require('../bot/index');
        const client = rawClient && rawClient.default ? rawClient.default : rawClient;
        if (client && provider) {
          await client.sendMessage(formatPhoneForWhatsApp(provider.phone, 'lid'), 'You are now verified on Fetcha!');
        } else {
          console.warn('[Squad Webhook] bot client not available to send verification message');
        }
      } catch (err) {
        console.error('[Squad Webhook] error sending verification message:', err);
      }
    }

    if (transaction.type === 'booking_payment') {
      const booking = await Booking.findByIdAndUpdate(transaction.relatedId, { status: 'confirmed' }, { new: true });
      await Customer.findOneAndUpdate({ phone: transaction.phone }, { state: 'AWAITING_CONFIRMATION' });
      const provider = await Provider.findById(booking?.providerId);
      try {
        const rawClient = require('../bot/index');
        const client = rawClient && rawClient.default ? rawClient.default : rawClient;
        if (client && booking) {
          const providerPhoneForMessage = booking.providerContactPhone || provider?.contactPhone || provider?.phone || 'Provider';
          const customerPhoneForMessage = booking.customerContactPhone || booking.customerPhone || transaction.phone || '';
          const customerMessage = provider
            ? `Your booking is confirmed!\n\nProvider: ${provider.name || 'Provider'}\nService: ${booking.serviceType || provider.serviceType || 'service'}\nPrice: NGN ${booking.amount || 2000}\n\nYou can now message the provider at ${providerPhoneForMessage}. Reply YES when the service is completed, or NO if there is a problem.`
            : `Your booking is confirmed! Reply YES when the service is completed, or NO if there is a problem.`;
          if (transaction.phone) {
            await client.sendMessage(formatPhoneForWhatsApp(transaction.phone, 'lid'), customerMessage);
          }
          if (provider && provider.phone) {
            await client.sendMessage(
              formatPhoneForWhatsApp(provider.phone, 'lid'),
              `New booking!\n\nCustomer: ${customerPhoneForMessage}\nService: ${booking.serviceType || provider.serviceType || 'service'}\nPrice: NGN ${booking.amount || 2000}\n\nPlease contact the customer directly to coordinate the job.`,
            );
          }
        } else {
          console.warn('[Squad Webhook] bot client not available to send booking confirmations');
        }
      } catch (err) {
        console.error('[Squad Webhook] error sending booking confirmation messages:', err);
      }
    }
  } catch (error) {
    console.error('Squad webhook error:', error);
  }
});

export default router;
