// Minimal bot loader stub. The real WhatsApp bot will be initialized when
// START_BOT=true. Keeping this file light to avoid heavy runtime costs.
import stateHandler from './stateHandler';
import qrcode from 'qrcode-terminal';
import { setLatestQr } from './qrStore';
import fs from 'fs';

const resolveChromeExecutablePath = () => {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  const candidatePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    `${process.env.LOCALAPPDATA || ''}\\Google\\Chrome\\Application\\chrome.exe`,
  ];

  return candidatePaths.find((candidatePath) => fs.existsSync(candidatePath));
};

try {
  // dynamic import of whatsapp-web.js to avoid loading it during normal runs
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Client, LocalAuth } = require('whatsapp-web.js');
  const path = require('path');

  // Use a unique session folder per process run to avoid userDataDir lock conflicts
  const sessionPath = path.join(process.cwd(), `.wwebjs_auth_session_${process.pid}_${Date.now()}`);

  const client = new Client({
    authStrategy: new LocalAuth({ dataPath: sessionPath }),
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      executablePath: resolveChromeExecutablePath(),
    },
  });

  client.on('qr', (qr: string) => {
    // store latest QR for HTTP access and still print to terminal
    try {
      setLatestQr(qr);
    } catch (err) {
      console.warn('[Bot QR] could not store latest QR:', err);
    }
    qrcode.generate(qr, { small: true });
    console.log('Scan the QR code above to connect WhatsApp or visit /qr to fetch an image');
  });

  client.on('ready', () => console.log('Fetcha WhatsApp bot is ready'));

  client.on('message', async (message: any) => {
    console.log(`[Bot Message] RAW incoming: from="${message.from}" body="${message.body}" type="${message.type}" isGroup=${message.from.includes('@g.us')} isBroadcast=${message.from.includes('@broadcast')} isStatus=${message.isStatus || message.type === 'status'}`);

    // Only handle direct personal messages.
    if (message.from.includes('@g.us')) {
      console.log(`[Bot Message] FILTERED: group message, skipping`);
      return;
    }
    if (message.from.includes('@broadcast')) {
      console.log(`[Bot Message] FILTERED: broadcast, skipping`);
      return;
    }
    if (message.type === 'status') {
      console.log(`[Bot Message] FILTERED: type=status, skipping`);
      return;
    }
    if (message.isStatus) {
      console.log(`[Bot Message] FILTERED: isStatus=true, skipping`);
      return;
    }
    // Ignore non-user notification templates and system messages that are not actionable
    const textTypes = ['chat', 'conversation'];
    if (!textTypes.includes(message.type) && !message.hasMedia && message.type !== 'location') {
      console.log(`[Bot Message] FILTERED: type="${message.type}" not in allowed types (chat, conversation, location, media), skipping`);
      return;
    }

    console.log(`[Bot Message] ACCEPTED: passing to stateHandler`);
    await stateHandler.handle(client, message);
  });

  // Initialize client with retry on EBUSY / "already running" errors
  const initClient = async () => {
    console.log('[Bot Init] starting client initialization...');
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        console.log(`[Bot Init] attempt ${attempt + 1}/3: calling client.initialize()...`);
        // eslint-disable-next-line @typescript-eslint/await-thenable
        await client.initialize();
        console.log('Fetcha WhatsApp bot initialized');
        return;
      } catch (err: any) {
        const errMsg = err && err.message ? err.message : String(err);
        console.error(`[Bot Init] attempt ${attempt + 1} failed:`, errMsg);
        console.error('[Bot Init] full error:', err);
        
        const msg = errMsg.toLowerCase();
        if (msg.includes('already running') || msg.includes('ebusy') || msg.includes('resource busy')) {
          // Try to remove known Chromium crashpad lock file and retry after delay
          try {
            const lockFile = path.join(sessionPath, 'session', 'CrashpadMetrics-active.pma');
            if (fs.existsSync(lockFile)) {
              fs.unlinkSync(lockFile);
              console.log('[Bot Init] removed Crashpad lock file:', lockFile);
            }
          } catch (rmErr) {
            const rmMessage = rmErr instanceof Error ? rmErr.message : String(rmErr);
            console.warn('[Bot Init] could not remove lock file:', rmMessage);
          }

          const waitMs = 1000 * (attempt + 1);
          console.log(`[Bot Init] retrying initialize in ${waitMs}ms (attempt ${attempt + 1}/3)`);
          await new Promise((res) => setTimeout(res, waitMs));
          continue;
        }

        // Non-recoverable error — stop retrying
        console.error('[Bot Init] non-recoverable error, stopping retries');
        break;
      }
    }
    console.error('[Bot Init] FAILED — WhatsApp client could not be initialized. Check Chrome/Puppeteer setup.');
  };

  console.log('[Bot Init] scheduling initClient async...');
  initClient().catch((err) => console.error('[Bot Init] uncaught error in initClient:', err));

  module.exports = client;
} catch (err) {
  console.warn('WhatsApp bot not started (whatsapp-web.js not available or START_BOT not set).');
}
