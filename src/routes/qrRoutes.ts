import express from 'express';
import QRCode from 'qrcode';
import { getLatestQr } from '../bot/qrStore';

const router = express.Router();

// GET /qr - returns a PNG image of the latest WhatsApp QR code
router.get('/', async (_req, res) => {
  const qr = getLatestQr();
  if (!qr) {
    return res.status(204).send('');
  }

  try {
    const buffer = await QRCode.toBuffer(qr, { type: 'png', width: 400 });
    res.setHeader('Content-Type', 'image/png');
    return res.send(buffer);
  } catch (err: any) {
    console.error('[QR Route] error generating PNG:', err?.message || err);
    return res.status(500).json({ error: 'Failed to generate QR image' });
  }
});

export default router;
