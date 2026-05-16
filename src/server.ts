import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import path from 'path';
import { connectDB } from './config/db';

dotenv.config();
connectDB();

const app = express();
const publicDir = path.join(__dirname, '..', 'public');

app.use(cors());
app.use(bodyParser.json({ limit: '2mb' }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/admin', express.static(publicDir));

// Routes
app.use('/api/providers', require('./routes/providerRoutes').default);
app.use('/api/bookings', require('./routes/bookingRoutes').default);
app.use('/api/transactions', require('./routes/transactionRoutes').default);
app.use('/api/admin', require('./routes/adminRoutes').default);
app.use('/webhook', require('./webhooks/squadWebhook').default);
app.use('/qr', require('./routes/qrRoutes').default);

app.get('/', (_req, res) => res.send('Fetcha backend is running'));
app.get('/admin', (_req, res) => res.sendFile(path.join(publicDir, 'admin.html')));

// Log body-parser / malformed JSON errors explicitly so webhook failures are traceable.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err) {
    console.error('[Request Error]', `${req.method} ${req.url}`, err.message || err);
    return res.status(400).json({ error: 'Invalid request body', details: err.message || String(err) });
  }
  return next();
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// Start WhatsApp bot only when explicitly enabled to keep runtime lightweight
if (process.env.START_BOT === 'true') {
  // dynamic require to avoid loading heavy deps during dev/build
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('./bot/index');
}

export default app;
