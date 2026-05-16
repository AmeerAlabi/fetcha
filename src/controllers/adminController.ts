import { Request, Response } from 'express';
import Booking from '../models/Booking';
import Customer from '../models/Customer';
import Provider from '../models/Provider';
import Transaction from '../models/Transaction';
import { verifyTransaction } from '../services/squadService';
import { formatPhoneForWhatsApp } from '../utils/phoneFormatter';

const toPositiveInteger = (value: unknown, fallback: number) => {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) && parsedValue > 0 ? Math.floor(parsedValue) : fallback;
};

const sendWhatsAppMessage = async (phone: string, message: string) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const rawClient = require('../bot/index');
    const client = rawClient && rawClient.default ? rawClient.default : rawClient;

    if (!client) {
      return false;
    }

    await client.sendMessage(formatPhoneForWhatsApp(phone, 'lid'), message);
    return true;
  } catch (error) {
    console.error('[Admin] WhatsApp send failed:', error);
    return false;
  }
};

const getSquadStatus = (payload: any) => String(
  payload?.Body?.transaction_status ||
  payload?.data?.transaction_status ||
  payload?.transaction_status ||
  payload?.status ||
  '',
).toLowerCase();

const applySuccessfulTransactionEffects = async (transaction: any) => {
  if (transaction.type === 'verification_fee') {
    const provider = await Provider.findOneAndUpdate(
      { phone: transaction.phone },
      { verified: true, state: 'ACTIVE' },
      { new: true },
    );

    if (provider?.phone) {
      await sendWhatsAppMessage(provider.phone, 'You are now verified on Fetcha!');
    }

    return { provider };
  }

  if (transaction.type === 'booking_payment') {
    const booking = await Booking.findByIdAndUpdate(transaction.relatedId, { status: 'confirmed' }, { new: true });
    await Customer.findOneAndUpdate({ phone: transaction.phone }, { state: 'AWAITING_CONFIRMATION' });

    if (transaction.phone) {
      await sendWhatsAppMessage(transaction.phone, 'Your booking is confirmed!');
    }

    if (booking?.providerId) {
      const provider = await Provider.findById(booking.providerId);
      if (provider?.phone) {
        await sendWhatsAppMessage(provider.phone, 'New booking! A customer has paid for your service.');
      }
    }

    return { booking };
  }

  return {};
};

export const getSummary = async (_req: Request, res: Response) => {
  const [totalProviders, verifiedProviders, suspendedProviders, activeProviders, totalCustomers, totalBookings, pendingBookings, confirmedBookings, completedBookings, disputedBookings, totalTransactions, successfulTransactions, pendingTransactions, failedTransactions] = await Promise.all([
    Provider.countDocuments(),
    Provider.countDocuments({ verified: true }),
    Provider.countDocuments({ suspended: true }),
    Provider.countDocuments({ state: 'ACTIVE' }),
    Customer.countDocuments(),
    Booking.countDocuments(),
    Booking.countDocuments({ status: 'pending' }),
    Booking.countDocuments({ status: 'confirmed' }),
    Booking.countDocuments({ status: 'completed' }),
    Booking.countDocuments({ status: 'disputed' }),
    Transaction.countDocuments(),
    Transaction.countDocuments({ status: 'success' }),
    Transaction.countDocuments({ status: 'pending' }),
    Transaction.countDocuments({ status: 'failed' }),
  ]);

  res.json({
    success: true,
    data: {
      totalProviders,
      verifiedProviders,
      unverifiedProviders: totalProviders - verifiedProviders,
      suspendedProviders,
      activeProviders,
      totalCustomers,
      totalBookings,
      pendingBookings,
      confirmedBookings,
      completedBookings,
      disputedBookings,
      totalTransactions,
      successfulTransactions,
      pendingTransactions,
      failedTransactions,
    },
  });
};

export const getProviders = async (req: Request, res: Response) => {
  const { verified, service, suspended } = req.query;
  const page = toPositiveInteger(req.query.page, 1);
  const limit = Math.min(toPositiveInteger(req.query.limit, 20), 100);
  const filter: Record<string, unknown> = {};

  if (verified !== undefined && verified !== '') filter.verified = verified === 'true';
  if (suspended !== undefined && suspended !== '') filter.suspended = suspended === 'true';
  if (service) filter.serviceType = service;

  const [providers, total] = await Promise.all([
    Provider.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Provider.countDocuments(filter),
  ]);

  res.json({ success: true, data: { providers, total, page, limit } });
};

export const verifyProvider = async (req: Request, res: Response) => {
  const provider = await Provider.findByIdAndUpdate(
    req.params.id,
    { verified: true, suspended: false, state: 'ACTIVE' },
    { new: true },
  );

  if (!provider) {
    return res.status(404).json({ success: false, message: 'Provider not found' });
  }

  await sendWhatsAppMessage(provider.phone, 'You are now verified on Fetcha!');

  return res.json({ success: true, data: provider });
};

export const suspendProvider = async (req: Request, res: Response) => {
  const suspended = req.body?.suspended !== undefined ? Boolean(req.body.suspended) : true;

  const provider = await Provider.findByIdAndUpdate(
    req.params.id,
    { suspended },
    { new: true },
  );

  if (!provider) {
    return res.status(404).json({ success: false, message: 'Provider not found' });
  }

  return res.json({ success: true, data: provider });
};

export const getCustomers = async (req: Request, res: Response) => {
  const { state } = req.query;
  const page = toPositiveInteger(req.query.page, 1);
  const limit = Math.min(toPositiveInteger(req.query.limit, 20), 100);
  const filter: Record<string, unknown> = {};

  if (state) filter.state = state;

  const [customers, total] = await Promise.all([
    Customer.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Customer.countDocuments(filter),
  ]);

  return res.json({ success: true, data: { customers, total, page, limit } });
};

export const getBookings = async (req: Request, res: Response) => {
  const { status } = req.query;
  const page = toPositiveInteger(req.query.page, 1);
  const limit = Math.min(toPositiveInteger(req.query.limit, 20), 100);
  const filter: Record<string, unknown> = {};

  if (status) filter.status = status;

  const [bookings, total] = await Promise.all([
    Booking.find(filter)
      .populate('customerId', 'name phone state')
      .populate('providerId', 'name phone serviceType verified state')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Booking.countDocuments(filter),
  ]);

  return res.json({ success: true, data: { bookings, total, page, limit } });
};

export const getTransactions = async (req: Request, res: Response) => {
  const { type, status, phone } = req.query;
  const page = toPositiveInteger(req.query.page, 1);
  const limit = Math.min(toPositiveInteger(req.query.limit, 20), 100);
  const filter: Record<string, unknown> = {};

  if (type) filter.type = type;
  if (status) filter.status = status;
  if (phone) filter.phone = phone;

  const [transactions, total] = await Promise.all([
    Transaction.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Transaction.countDocuments(filter),
  ]);

  return res.json({ success: true, data: { transactions, total, page, limit } });
};

export const requeryTransaction = async (req: Request, res: Response) => {
  const ref = String(req.params.ref || '').trim();
  const transaction = await Transaction.findOne({ squadRef: ref });

  if (!transaction) {
    return res.status(404).json({ success: false, message: 'Transaction not found' });
  }

  try {
    const squadResponse = await verifyTransaction(ref);
    const status = getSquadStatus(squadResponse);

    if (status !== 'success') {
      return res.json({
        success: true,
        data: {
          resynced: false,
          reason: `Squad returned ${status || 'no status'}`,
          transaction: await Transaction.findOne({ squadRef: ref }).lean(),
          squadResponse,
        },
      });
    }

    await Transaction.findOneAndUpdate({ squadRef: ref }, { status: 'success' });
    await applySuccessfulTransactionEffects(transaction);

    const updatedTransaction = await Transaction.findOne({ squadRef: ref }).lean();

    return res.json({
      success: true,
      data: {
        resynced: true,
        transaction: updatedTransaction,
        squadResponse,
      },
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Could not requery transaction',
      details: error?.response?.data || error?.message || String(error),
    });
  }
};

export default {
  getSummary,
  getProviders,
  verifyProvider,
  suspendProvider,
  getCustomers,
  getBookings,
  getTransactions,
  requeryTransaction,
};