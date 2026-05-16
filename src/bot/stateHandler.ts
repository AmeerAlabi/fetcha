import Customer from '../models/Customer';
import Provider from '../models/Provider';
import { handleCustomer } from './customerHandler';
import { handleProvider } from './providerHandler';
import { formatPhoneForDisplay } from '../utils/phoneFormatter';

const handle = async (client: any, message: any) => {
  const phoneRaw = (message.from || '').split('@')[0];
  const phoneFormatted = formatPhoneForDisplay(phoneRaw);
  const body = (message.body || '').trim();

  // Debug: log incoming message metadata to help diagnose routing
  console.log(`[Fetcha Bot] incoming message from=${message.from} body="${body}" type=${message.type} hasMedia=${message.hasMedia} phone=${phoneFormatted}`);

  // Try to find the user in either collection
  let customer = await Customer.findOne({ phone: phoneFormatted });
  let provider = await Provider.findOne({ phone: phoneFormatted });

  // New user — send welcome message
  if (!customer && !provider) {
    await client.sendMessage(
      message.from,
      `Welcome to Fetcha! We detected your number as ${phoneFormatted}.\n\nReply YES to use this number, or send another number to replace it. After that, reply 1 for Customer or 2 for Service Provider.`,
    );
    // Create a minimal customer record to track their state (idempotent)
    await Customer.findOneAndUpdate(
      { phone: phoneFormatted },
      { $setOnInsert: { phone: phoneFormatted, contactPhone: phoneFormatted, state: 'CONFIRMING_PHONE' } },
      { upsert: true },
    );
    return;
  }

  // Route based on who they are and their current state
  if (customer) {
    await handleCustomer(client, message, customer, phoneFormatted, body);
  } else if (provider) {
    await handleProvider(client, message, provider, phoneFormatted, body);
  }
};

export default { handle };
