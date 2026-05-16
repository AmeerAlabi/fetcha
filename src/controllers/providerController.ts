import { Request, Response } from 'express';
import Provider from '../models/Provider';

export const getAllProviders = async (req: Request, res: Response) => {
  const { verified, service } = req.query;
  const filter: any = {};
  if (verified !== undefined) filter.verified = verified === 'true';
  if (service) filter.serviceType = service;
  const providers = await Provider.find(filter).sort({ createdAt: -1 });
  res.json({ success: true, data: providers });
};

export const getProviderById = async (req: Request, res: Response) => {
  const provider = await Provider.findById(req.params.id);
  if (!provider) return res.status(404).json({ success: false, message: 'Provider not found' });
  res.json({ success: true, data: provider });
};

export const verifyProvider = async (req: Request, res: Response) => {
  const provider = await Provider.findByIdAndUpdate(req.params.id, { verified: true, state: 'ACTIVE' }, { new: true });
  res.json({ success: true, data: provider });
};

export const suspendProvider = async (req: Request, res: Response) => {
  const provider = await Provider.findByIdAndUpdate(req.params.id, { suspended: true }, { new: true });
  res.json({ success: true, data: provider });
};

export default { getAllProviders, getProviderById, verifyProvider, suspendProvider };
