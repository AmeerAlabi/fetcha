import { NextFunction, Request, Response } from 'express';

const adminAuth = (req: Request, res: Response, next: NextFunction) => {
  const expectedToken = process.env.ADMIN_TOKEN;

  if (!expectedToken) {
    return res.status(500).json({ success: false, message: 'ADMIN_TOKEN is not set' });
  }

  const authHeader = req.headers.authorization || '';
  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || token !== expectedToken) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  return next();
};

export default adminAuth;