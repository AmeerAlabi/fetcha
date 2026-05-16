import { Request, Response } from 'express';
import Booking from '../models/Booking';

export const getBookings = async (req: Request, res: Response) => {
  const { status } = req.query;
  const filter: any = status ? { status } : {};
  const bookings = await Booking.find(filter)
    .populate('customerId', 'name phone')
    .populate('providerId', 'name phone serviceType')
    .sort({ createdAt: -1 });

  res.json({ success: true, data: bookings });
};

export default { getBookings };
