import { Request, Response } from 'express';
import Transaction from '../models/Transaction';

export const getTransactions = async (_req: Request, res: Response) => {
  const transactions = await Transaction.find().sort({ createdAt: -1 });
  res.json({ success: true, data: transactions });
};

export const getStats = async (_req: Request, res: Response) => {
  const Provider = require('../models/Provider');
  const Booking = require('../models/Booking');

  const totalProviders = await Provider.countDocuments();
  const verifiedProviders = await Provider.countDocuments({ verified: true });
  const totalBookings = await Booking.countDocuments();
  const completedBookings = await Booking.countDocuments({ status: 'completed' });
  const totalTransactions = await Transaction.countDocuments({ status: 'success' });

  res.json({
    success: true,
    data: {
      totalProviders,
      verifiedProviders,
      pendingProviders: totalProviders - verifiedProviders,
      totalBookings,
      completedBookings,
      totalTransactions,
    },
  });
};

export default { getTransactions, getStats };
