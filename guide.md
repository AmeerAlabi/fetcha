# Fetcha — Full Backend Build Brief
> This document is the complete guide for building the Fetcha backend. Follow it step by step. Do not skip any section. Every decision about stack, structure, and logic is documented here.

---

## Overview

Fetcha is a WhatsApp-based local services marketplace. The backend is the core engine that powers everything — the WhatsApp bot, the admin dashboard, Squad API payments, OpenAI intent detection, and location matching all run through this server.

**The backend must:**
- Manage all database models and business logic
- Handle WhatsApp bot state and conversation routing
- Integrate Squad API for payments, webhooks, and payouts
- Call OpenAI API to understand user messages
- Calculate location-based provider matching
- Expose REST API routes for the admin dashboard

---

## Tech Stack

| Layer | Tool |
|---|---|
| Runtime | Node.js |
| Framework | Express.js |
| Database | MongoDB Atlas (via Mongoose) |
| Payments | Squad API |
| AI / NLP | OpenAI API (GPT-4o-mini) |
| WhatsApp | whatsapp-web.js |
| Location Math | Haversine formula (no external API) |
| Environment | dotenv |
| Hosting | Railway |

---

## Project Structure

```
fetcha-backend/
├── src/
│   ├── config/
│   │   └── db.js                  # MongoDB connection
│   ├── models/
│   │   ├── Customer.js
│   │   ├── Provider.js
│   │   ├── Booking.js
│   │   └── Transaction.js
│   ├── services/
│   │   ├── squadService.js        # All Squad API calls
│   │   ├── openaiService.js       # OpenAI intent detection
│   │   └── locationService.js     # Haversine + provider matching
│   ├── bot/
│   │   ├── index.js               # whatsapp-web.js initialisation
│   │   ├── stateHandler.js        # Routes messages based on user state
│   │   ├── customerHandler.js     # All customer conversation functions
│   │   └── providerHandler.js     # All provider conversation functions
│   ├── controllers/
│   │   ├── providerController.js
│   │   ├── bookingController.js
│   │   └── transactionController.js
│   ├── routes/
│   │   ├── providerRoutes.js
│   │   ├── bookingRoutes.js
│   │   └── transactionRoutes.js
│   ├── webhooks/
│   │   └── squadWebhook.js        # Handles Squad payment confirmations
│   └── utils/
│       └── haversine.js           # Distance calculation utility
├── .env
├── .env.example
├── package.json
└── server.js                      # Entry point
```

---

## Step 1 — Project Setup

### 1.1 Initialise the project

```bash
mkdir fetcha-backend
cd fetcha-backend
npm init -y
```

### 1.2 Install dependencies

```bash
npm install express mongoose dotenv axios openai whatsapp-web.js qrcode-terminal cors body-parser
npm install --save-dev nodemon
```

### 1.3 Set up package.json scripts

```json
"scripts": {
  "start": "node server.js",
  "dev": "nodemon server.js"
}
```

### 1.4 Create .env file

```env
PORT=5000
MONGODB_URI=your_mongodb_atlas_connection_string
SQUAD_SECRET_KEY=your_squad_secret_key
SQUAD_BASE_URL=https://sandbox-api-d.squadco.com
SQUAD_MERCHANT_ID=your_squad_merchant_id
OPENAI_API_KEY=your_openai_api_key
VERIFICATION_FEE=50000
```

> Note: VERIFICATION_FEE is in kobo. 50000 kobo = NGN 500. Adjust as needed.
> Note: Use Squad sandbox keys during development. Switch to production keys before going live.

### 1.5 Create server.js entry point

```javascript
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const connectDB = require('./src/config/db');

dotenv.config();
connectDB();

const app = express();

app.use(cors());
app.use(bodyParser.json());

// Routes
app.use('/api/providers', require('./src/routes/providerRoutes'));
app.use('/api/bookings', require('./src/routes/bookingRoutes'));
app.use('/api/transactions', require('./src/routes/transactionRoutes'));
app.use('/webhook', require('./src/webhooks/squadWebhook'));

// Health check
app.get('/', (req, res) => res.send('Fetcha backend is running'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// Start WhatsApp bot
require('./src/bot/index');
```

---

## Step 2 — Database Connection

### src/config/db.js

```javascript
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

module.exports = connectDB;
```

---

## Step 3 — Mongoose Models

### 3.1 Customer Model — src/models/Customer.js

```javascript
const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  phone: { type: String, required: true, unique: true },
  name: { type: String },
  location: {
    lat: { type: Number },
    lng: { type: Number }
  },
  state: { 
    type: String, 
    default: 'IDLE'
    // Possible values:
    // IDLE, SELECTING_ROLE, ONBOARDING_NAME, ONBOARDING_LOCATION,
    // SEARCHING, AWAITING_BOOKING_PAYMENT, AWAITING_CONFIRMATION, RATING
  },
  currentBookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
  searchResults: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Provider' }]
}, { timestamps: true });

module.exports = mongoose.model('Customer', customerSchema);
```

### 3.2 Provider Model — src/models/Provider.js

```javascript
const mongoose = require('mongoose');

const providerSchema = new mongoose.Schema({
  phone: { type: String, required: true, unique: true },
  name: { type: String },
  serviceType: { type: String },
  location: {
    lat: { type: Number },
    lng: { type: Number },
    description: { type: String }
  },
  pricing: { type: String },
  bankDetails: {
    accountNumber: { type: String },
    bankCode: { type: String },
    bankName: { type: String },
    accountName: { type: String }
  },
  availability: { type: String },
  verified: { type: Boolean, default: false },
  suspended: { type: Boolean, default: false },
  trustScore: { type: Number, default: 0 },
  totalRatings: { type: Number, default: 0 },
  ratingCount: { type: Number, default: 0 },
  completedBookings: { type: Number, default: 0 },
  state: { 
    type: String, 
    default: 'IDLE'
    // Possible values:
    // IDLE, SELECTING_ROLE, ONBOARDING_NAME, ONBOARDING_SERVICE,
    // ONBOARDING_LOCATION, ONBOARDING_PRICING, ONBOARDING_BANK,
    // ONBOARDING_AVAILABILITY, AWAITING_VERIFICATION_PAYMENT, ACTIVE
  }
}, { timestamps: true });

module.exports = mongoose.model('Provider', providerSchema);
```

### 3.3 Booking Model — src/models/Booking.js

```javascript
const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Provider', required: true },
  customerPhone: { type: String },
  providerPhone: { type: String },
  serviceType: { type: String },
  amount: { type: Number },
  status: { 
    type: String, 
    default: 'pending',
    enum: ['pending', 'confirmed', 'completed', 'disputed']
  },
  squadPaymentRef: { type: String },
  squadPayoutRef: { type: String },
  rating: { type: Number }
}, { timestamps: true });

module.exports = mongoose.model('Booking', bookingSchema);
```

### 3.4 Transaction Model — src/models/Transaction.js

```javascript
const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  squadRef: { type: String, required: true, unique: true },
  type: { 
    type: String, 
    enum: ['verification_fee', 'booking_payment', 'payout'],
    required: true 
  },
  amount: { type: Number },
  status: { 
    type: String, 
    enum: ['pending', 'success', 'failed'],
    default: 'pending'
  },
  relatedId: { type: mongoose.Schema.Types.ObjectId },
  phone: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Transaction', transactionSchema);
```

---

## Step 4 — Services

### 4.1 Squad Service — src/services/squadService.js

This service handles all Squad API communication. Every function maps to a real Squad API endpoint.

```javascript
const axios = require('axios');

const squadAxios = axios.create({
  baseURL: process.env.SQUAD_BASE_URL,
  headers: {
    Authorization: `Bearer ${process.env.SQUAD_SECRET_KEY}`,
    'Content-Type': 'application/json'
  }
});

// INITIATE PAYMENT
// Creates a Squad payment link to send to the user via WhatsApp
// Used for: verification fee and booking payments
// Amount must be in kobo (NGN x 100)
const initiatePayment = async ({ email, amount, ref, name, phone }) => {
  const response = await squadAxios.post('/transaction/initiate', {
    email: email || `${phone}@fetcha.app`,
    amount,
    initiate_type: 'inline',
    currency: 'NGN',
    transaction_ref: ref,
    customer_name: name,
    pass_charge: false
  });
  return response.data;
};

// VERIFY TRANSACTION
// Used to manually confirm a payment was successful
// Call this when Squad webhook fires or to recheck pending payments
const verifyTransaction = async (transactionRef) => {
  const response = await squadAxios.get(`/transaction/verify/${transactionRef}`);
  return response.data;
};

// ACCOUNT LOOKUP
// Must be called before every payout to verify provider bank details
// Returns account name for confirmation
const accountLookup = async ({ bankCode, accountNumber }) => {
  const response = await squadAxios.post('/payout/account/lookup', {
    bank_code: bankCode,
    account_number: accountNumber
  });
  return response.data;
};

// FUND TRANSFER (PAYOUT)
// Sends money from Fetcha's Squad wallet to provider's bank account
// Must call accountLookup first
// Transaction reference must include merchant ID prefix
const fundTransfer = async ({ accountNumber, bankCode, accountName, amount, remark, ref }) => {
  const transactionRef = `${process.env.SQUAD_MERCHANT_ID}_${ref}`;
  const response = await squadAxios.post('/payout/transfer', {
    account_number: accountNumber,
    bank_code: bankCode,
    account_name: accountName,
    amount: String(amount),
    currency_id: 'NGN',
    remark,
    transaction_reference: transactionRef
  });
  return response.data;
};

// REQUERY TRANSFER
// Use to check if a payout was successful, failed, or is pending
const requeryTransfer = async (transactionRef) => {
  const response = await squadAxios.post('/payout/requery', {
    transaction_reference: `${process.env.SQUAD_MERCHANT_ID}_${transactionRef}`
  });
  return response.data;
};

module.exports = { initiatePayment, verifyTransaction, accountLookup, fundTransfer, requeryTransfer };
```

---

### 4.2 OpenAI Service — src/services/openaiService.js

This service sends the customer's raw message to GPT-4o-mini and gets back structured data — service type and location.

```javascript
const OpenAI = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const extractIntent = async (message) => {
  const prompt = `
You are an assistant for a Nigerian local services app called Fetcha.
A customer just sent this message: "${message}"

Extract the following from the message:
1. serviceType: the type of service they need. Map it to one of these categories exactly: 
   food, hair_beauty, fashion, photography, home_services, other
2. locationHint: any location or area they mentioned (e.g. "Lekki", "Surulere"). 
   Return null if they did not mention a location.

Respond ONLY with a valid JSON object. No explanation. No markdown. Example:
{"serviceType": "hair_beauty", "locationHint": "Lekki"}
`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 100
  });

  const text = response.choices[0].message.content.trim();
  return JSON.parse(text);
};

module.exports = { extractIntent };
```

---

### 4.3 Location Service — src/services/locationService.js

This service finds and ranks nearby verified providers using the Haversine formula.

```javascript
const Provider = require('../models/Provider');
const { haversineDistance } = require('../utils/haversine');

const findNearbyProviders = async ({ lat, lng, serviceType, limit = 3 }) => {
  // Fetch all verified, active providers offering the requested service
  const providers = await Provider.find({
    serviceType,
    verified: true,
    suspended: false
  });

  if (!providers.length) return [];

  // Calculate distance from customer to each provider
  const withDistance = providers.map(provider => ({
    ...provider.toObject(),
    distance: haversineDistance(lat, lng, provider.location.lat, provider.location.lng)
  }));

  // Sort by distance first, then by trust score
  withDistance.sort((a, b) => {
    if (a.distance !== b.distance) return a.distance - b.distance;
    return b.trustScore - a.trustScore;
  });

  return withDistance.slice(0, limit);
};

module.exports = { findNearbyProviders };
```

---

## Step 5 — Haversine Utility

### src/utils/haversine.js

Calculates the straight-line distance in kilometres between two lat/lng coordinates. No external API needed.

```javascript
const haversineDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(2));
};

module.exports = { haversineDistance };
```

---

## Step 6 — WhatsApp Bot

### 6.1 Bot Initialisation — src/bot/index.js

```javascript
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const stateHandler = require('./stateHandler');

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: { args: ['--no-sandbox', '--disable-setuid-sandbox'] }
});

client.on('qr', (qr) => {
  qrcode.generate(qr, { small: true });
  console.log('Scan the QR code above to connect WhatsApp');
});

client.on('ready', () => {
  console.log('Fetcha WhatsApp bot is ready');
});

client.on('message', async (message) => {
  // Ignore group messages
  if (message.from.includes('@g.us')) return;
  await stateHandler.handle(client, message);
});

client.initialize();

module.exports = client;
```

---

### 6.2 State Handler — src/bot/stateHandler.js

This is the brain of the bot. Every incoming message is routed here. It looks up the user's current state and calls the right handler function.

```javascript
const Customer = require('../models/Customer');
const Provider = require('../models/Provider');
const customerHandler = require('./customerHandler');
const providerHandler = require('./providerHandler');

const handle = async (client, message) => {
  const phone = message.from.replace('@c.us', '');
  const body = message.body.trim();

  // Try to find the user in either collection
  let customer = await Customer.findOne({ phone });
  let provider = await Provider.findOne({ phone });

  // New user — send welcome message
  if (!customer && !provider) {
    await client.sendMessage(message.from,
      'Welcome to Fetcha! Find who you need, right where you are.\n\nAre you a:\n1. Customer\n2. Service Provider\n\nReply 1 or 2'
    );
    // Create a minimal customer record to track their state
    await Customer.create({ phone, state: 'SELECTING_ROLE' });
    return;
  }

  // Route based on who they are and their current state
  if (customer) {
    await customerHandler.handle(client, message, customer, phone, body);
  } else if (provider) {
    await providerHandler.handle(client, message, provider, phone, body);
  }
};

module.exports = { handle };
```

---

### 6.3 Customer Handler — src/bot/customerHandler.js

Handles every step of the customer conversation flow.

```javascript
const Customer = require('../models/Customer');
const Provider = require('../models/Provider');
const Booking = require('../models/Booking');
const Transaction = require('../models/Transaction');
const { extractIntent } = require('../services/openaiService');
const { findNearbyProviders } = require('../services/locationService');
const { initiatePayment } = require('../services/squadService');

const handle = async (client, message, customer, phone, body) => {
  const state = customer.state;
  const from = message.from;

  // SELECTING ROLE
  if (state === 'SELECTING_ROLE') {
    if (body === '1') {
      await Customer.findOneAndUpdate({ phone }, { state: 'ONBOARDING_NAME' });
      await client.sendMessage(from, 'Great! What is your name?');
    } else if (body === '2') {
      // Switch them to provider flow
      const { Provider } = require('../models/Provider');
      await Customer.findOneAndDelete({ phone });
      await Provider.create({ phone, state: 'ONBOARDING_NAME' });
      await client.sendMessage(from, 'Welcome, provider! What is your name?');
    } else {
      await client.sendMessage(from, 'Please reply 1 for Customer or 2 for Service Provider.');
    }
    return;
  }

  // ONBOARDING — NAME
  if (state === 'ONBOARDING_NAME') {
    await Customer.findOneAndUpdate({ phone }, { name: body, state: 'ONBOARDING_LOCATION' });
    await client.sendMessage(from, `Nice to meet you, ${body}! Please share your location so we can find services near you.\n\nTap the attachment icon and select Location.`);
    return;
  }

  // ONBOARDING — LOCATION
  if (state === 'ONBOARDING_LOCATION') {
    if (message.type === 'location') {
      const { latitude, longitude } = message.location;
      await Customer.findOneAndUpdate({ phone }, {
        location: { lat: latitude, lng: longitude },
        state: 'SEARCHING'
      });
      await client.sendMessage(from, 'Location saved! What service are you looking for? For example: barber, tailor, bukka, photographer, plumber.');
    } else {
      await client.sendMessage(from, 'Please share your location using the location pin. Tap the attachment icon and select Location.');
    }
    return;
  }

  // SEARCHING
  if (state === 'SEARCHING') {
    await client.sendMessage(from, 'Searching for providers near you...');

    let intent;
    try {
      intent = await extractIntent(body);
    } catch {
      await client.sendMessage(from, 'I could not understand that. Please try again, for example: "I need a barber" or "find me a bukka".');
      return;
    }

    const providers = await findNearbyProviders({
      lat: customer.location.lat,
      lng: customer.location.lng,
      serviceType: intent.serviceType
    });

    if (!providers.length) {
      await client.sendMessage(from, 'No verified providers found near you for that service right now. Try a different service or check back later.');
      return;
    }

    // Save search results to customer record
    await Customer.findOneAndUpdate({ phone }, {
      searchResults: providers.map(p => p._id),
      state: 'AWAITING_PROVIDER_SELECTION'
    });

    // Format and send results
    let resultsMessage = 'Here is what I found near you\n\n';
    providers.forEach((p, i) => {
      resultsMessage += `${i + 1}. ${p.name} — ${p.distance}km away  ⭐${p.trustScore || 'New'}\n   Service: ${p.serviceType}\n   Price: ${p.pricing}\n\n`;
    });
    resultsMessage += 'Reply 1, 2 or 3 to book.';
    await client.sendMessage(from, resultsMessage);
    return;
  }

  // PROVIDER SELECTION
  if (state === 'AWAITING_PROVIDER_SELECTION') {
    const index = parseInt(body) - 1;
    if (isNaN(index) || index < 0 || index > 2) {
      await client.sendMessage(from, 'Please reply with 1, 2 or 3 to select a provider.');
      return;
    }

    const updatedCustomer = await Customer.findOne({ phone });
    const providerId = updatedCustomer.searchResults[index];
    const provider = await Provider.findById(providerId);

    if (!provider) {
      await client.sendMessage(from, 'Something went wrong. Please search again.');
      return;
    }

    // Create a pending booking
    const booking = await Booking.create({
      customerId: customer._id,
      providerId: provider._id,
      customerPhone: phone,
      providerPhone: provider.phone,
      serviceType: provider.serviceType,
      amount: 0,
      status: 'pending'
    });

    // Generate Squad payment link
    const ref = `booking_${booking._id}_${Date.now()}`;
    const paymentData = await initiatePayment({
      phone,
      name: updatedCustomer.name,
      amount: 200000, // NGN 2000 in kobo — replace with dynamic provider pricing later
      ref
    });

    // Save Squad ref to booking
    await Booking.findByIdAndUpdate(booking._id, { squadPaymentRef: ref, amount: 2000 });
    await Transaction.create({ squadRef: ref, type: 'booking_payment', amount: 2000, phone, relatedId: booking._id });
    await Customer.findOneAndUpdate({ phone }, { state: 'AWAITING_BOOKING_PAYMENT', currentBookingId: booking._id });

    await client.sendMessage(from,
      `Great choice!\n\nProvider: ${provider.name}\nService: ${provider.serviceType}\nPrice: ${provider.pricing}\n\nClick the link below to pay and confirm your booking:\n${paymentData.data?.checkout_url}`
    );
    return;
  }

  // AWAITING BOOKING PAYMENT — handled by Squad webhook, not here
  if (state === 'AWAITING_BOOKING_PAYMENT') {
    await client.sendMessage(from, 'Please complete your payment using the link we sent. If you need a new link, reply RESEND.');
    return;
  }

  // AWAITING CONFIRMATION
  if (state === 'AWAITING_CONFIRMATION') {
    if (body.toUpperCase() === 'YES') {
      const booking = await Booking.findById(customer.currentBookingId).populate('providerId');
      const provider = booking.providerId;

      // Look up provider account and trigger payout
      const { accountLookup, fundTransfer } = require('../services/squadService');
      const lookup = await accountLookup({
        bankCode: provider.bankDetails.bankCode,
        accountNumber: provider.bankDetails.accountNumber
      });

      if (lookup.success) {
        const payoutRef = `payout_${booking._id}_${Date.now()}`;
        await fundTransfer({
          accountNumber: provider.bankDetails.accountNumber,
          bankCode: provider.bankDetails.bankCode,
          accountName: lookup.data.account_name,
          amount: booking.amount * 100, // convert to kobo
          remark: `Fetcha payout for booking ${booking._id}`,
          ref: payoutRef
        });

        await Booking.findByIdAndUpdate(booking._id, { status: 'completed', squadPayoutRef: payoutRef });
        await Transaction.create({ squadRef: payoutRef, type: 'payout', amount: booking.amount, phone: provider.phone, relatedId: booking._id });
        await Customer.findOneAndUpdate({ phone }, { state: 'RATING' });

        await client.sendMessage(from, 'Thank you for confirming! Please rate your experience from 1 to 5.\n\n5 = Excellent\n4 = Very Good\n3 = Good\n2 = Fair\n1 = Poor');
        await client.sendMessage(`${provider.phone}@c.us`, `Your payment for booking has been sent to your bank account. Well done!`);
      } else {
        await client.sendMessage(from, 'There was an issue processing the payout. Our team will resolve this shortly.');
      }
    } else if (body.toUpperCase() === 'NO') {
      await Booking.findByIdAndUpdate(customer.currentBookingId, { status: 'disputed' });
      await Customer.findOneAndUpdate({ phone }, { state: 'SEARCHING' });
      await client.sendMessage(from, 'We have logged your dispute. Our team will reach out to you shortly to resolve this.');
    } else {
      await client.sendMessage(from, 'Please reply YES if the service was completed or NO to raise an issue.');
    }
    return;
  }

  // RATING
  if (state === 'RATING') {
    const rating = parseInt(body);
    if (isNaN(rating) || rating < 1 || rating > 5) {
      await client.sendMessage(from, 'Please reply with a number from 1 to 5.');
      return;
    }

    const booking = await Booking.findById(customer.currentBookingId);
    await Booking.findByIdAndUpdate(booking._id, { rating });

    // Update provider trust score
    const provider = await Provider.findById(booking.providerId);
    const newTotal = provider.totalRatings + rating;
    const newCount = provider.ratingCount + 1;
    const newScore = parseFloat((newTotal / newCount).toFixed(1));

    await Provider.findByIdAndUpdate(provider._id, {
      totalRatings: newTotal,
      ratingCount: newCount,
      trustScore: newScore,
      completedBookings: provider.completedBookings + 1
    });

    await Customer.findOneAndUpdate({ phone }, { state: 'SEARCHING', currentBookingId: null });
    await client.sendMessage(from, `Thank you for rating! You gave ${rating}/5. What else can we help you with? Just tell us what service you need.`);
    return;
  }
};

module.exports = { handle };
```

---

### 6.4 Provider Handler — src/bot/providerHandler.js

Handles every step of the provider onboarding and notification flow.

```javascript
const Provider = require('../models/Provider');
const Transaction = require('../models/Transaction');
const { initiatePayment } = require('../services/squadService');

const handle = async (client, message, provider, phone, body) => {
  const state = provider.state;
  const from = message.from;

  // ONBOARDING — NAME
  if (state === 'ONBOARDING_NAME') {
    await Provider.findOneAndUpdate({ phone }, { name: body, state: 'ONBOARDING_SERVICE' });
    await client.sendMessage(from, `Welcome, ${body}! What service do you offer?\n\nReply with one of these:\n- food\n- hair_beauty\n- fashion\n- photography\n- home_services`);
    return;
  }

  // ONBOARDING — SERVICE TYPE
  if (state === 'ONBOARDING_SERVICE') {
    const validServices = ['food', 'hair_beauty', 'fashion', 'photography', 'home_services'];
    const service = body.toLowerCase().replace(' ', '_');
    if (!validServices.includes(service)) {
      await client.sendMessage(from, 'Please reply with one of: food, hair_beauty, fashion, photography, home_services');
      return;
    }
    await Provider.findOneAndUpdate({ phone }, { serviceType: service, state: 'ONBOARDING_LOCATION' });
    await client.sendMessage(from, 'Please share your business location so customers can find you.\n\nTap the attachment icon and select Location.');
    return;
  }

  // ONBOARDING — LOCATION
  if (state === 'ONBOARDING_LOCATION') {
    if (message.type === 'location') {
      const { latitude, longitude } = message.location;
      await Provider.findOneAndUpdate({ phone }, {
        location: { lat: latitude, lng: longitude },
        state: 'ONBOARDING_PRICING'
      });
      await client.sendMessage(from, 'Location saved! What is your price range? For example: NGN 1500 - NGN 5000');
    } else {
      await client.sendMessage(from, 'Please share your business location using the location pin.');
    }
    return;
  }

  // ONBOARDING — PRICING
  if (state === 'ONBOARDING_PRICING') {
    await Provider.findOneAndUpdate({ phone }, { pricing: body, state: 'ONBOARDING_BANK' });
    await client.sendMessage(from, 'What is your bank account number and bank name? This is where we will send your payments.\n\nFormat: AccountNumber BankName\nExample: 0123456789 GTBank');
    return;
  }

  // ONBOARDING — BANK DETAILS
  if (state === 'ONBOARDING_BANK') {
    const parts = body.split(' ');
    if (parts.length < 2) {
      await client.sendMessage(from, 'Please send your account number and bank name separated by a space.\nExample: 0123456789 GTBank');
      return;
    }
    const accountNumber = parts[0];
    const bankName = parts.slice(1).join(' ');

    // Map bank name to bank code
    const bankCodes = {
      'gtbank': '000013',
      'access': '000014',
      'zenith': '000015',
      'firstbank': '000016',
      'uba': '000004',
      'fidelity': '000007',
      'fcmb': '000003',
      'union': '000018',
      'sterling': '000001',
      'wema': '000017',
      'kuda': '090267',
      'opay': '100004',
      'palmpay': '100033'
    };

    const bankCode = bankCodes[bankName.toLowerCase().replace(' ', '')] || null;

    await Provider.findOneAndUpdate({ phone }, {
      bankDetails: { accountNumber, bankName, bankCode, accountName: '' },
      state: 'ONBOARDING_AVAILABILITY'
    });
    await client.sendMessage(from, 'Bank details saved! What days and hours are you available?\n\nExample: Monday to Saturday, 8am to 7pm');
    return;
  }

  // ONBOARDING — AVAILABILITY
  if (state === 'ONBOARDING_AVAILABILITY') {
    await Provider.findOneAndUpdate({ phone }, { availability: body, state: 'AWAITING_VERIFICATION_PAYMENT' });

    const ref = `verification_${phone}_${Date.now()}`;
    const paymentData = await initiatePayment({
      phone,
      name: provider.name,
      amount: parseInt(process.env.VERIFICATION_FEE),
      ref
    });

    await Transaction.create({ squadRef: ref, type: 'verification_fee', amount: parseInt(process.env.VERIFICATION_FEE) / 100, phone });
    await client.sendMessage(from,
      `Almost done! Pay a one-time verification fee to get listed as a verified provider on Fetcha.\n\nClick the link below to pay:\n${paymentData.data?.checkout_url}`
    );
    return;
  }

  // AWAITING VERIFICATION PAYMENT — handled by Squad webhook
  if (state === 'AWAITING_VERIFICATION_PAYMENT') {
    await client.sendMessage(from, 'Please complete your verification payment using the link we sent. Reply RESEND if you need a new link.');
    return;
  }

  // ACTIVE — provider receives notifications, no input needed here
  if (state === 'ACTIVE') {
    await client.sendMessage(from, 'You are live on Fetcha! You will be notified when customers book you.');
    return;
  }
};

module.exports = { handle };
```

---

## Step 7 — Squad Webhook

### src/webhooks/squadWebhook.js

Squad sends a POST request to this endpoint every time a payment is made. This is how the backend knows a payment was successful without the user having to do anything.

```javascript
const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const Provider = require('../models/Provider');
const Booking = require('../models/Booking');
const Customer = require('../models/Customer');
const client = require('../bot/index');

router.post('/squad', async (req, res) => {
  const event = req.body;

  // Always respond 200 to Squad immediately to acknowledge receipt
  res.status(200).json({ status: 'received' });

  try {
    const ref = event?.data?.transaction_ref;
    const status = event?.data?.transaction_status;

    if (!ref || status !== 'success') return;

    // Find matching transaction in our DB
    const transaction = await Transaction.findOne({ squadRef: ref });
    if (!transaction || transaction.status === 'success') return;

    // Mark transaction as successful
    await Transaction.findOneAndUpdate({ squadRef: ref }, { status: 'success' });

    // VERIFICATION FEE PAYMENT
    if (transaction.type === 'verification_fee') {
      const provider = await Provider.findOneAndUpdate(
        { phone: transaction.phone },
        { verified: true, state: 'ACTIVE' },
        { new: true }
      );
      await client.sendMessage(`${provider.phone}@c.us`,
        `You are now verified on Fetcha! Customers near you can now find and book you. We will notify you when you get a booking.`
      );
    }

    // BOOKING PAYMENT
    if (transaction.type === 'booking_payment') {
      const booking = await Booking.findByIdAndUpdate(
        transaction.relatedId,
        { status: 'confirmed' },
        { new: true }
      );
      const customer = await Customer.findOneAndUpdate(
        { phone: transaction.phone },
        { state: 'AWAITING_CONFIRMATION' }
      );
      const provider = await Provider.findById(booking.providerId);

      await client.sendMessage(`${customer.phone}@c.us`,
        `Your booking is confirmed! ${provider.name} will be expecting you. Enjoy your service.\n\nOnce your service is done, reply YES to release payment to your provider or NO to raise an issue.`
      );
      await client.sendMessage(`${provider.phone}@c.us`,
        `New booking! A customer has paid for your service. Get ready!`
      );
    }

  } catch (error) {
    console.error('Squad webhook error:', error);
  }
});

module.exports = router;
```

> Important: In your Squad dashboard, set the webhook URL to:
> https://your-railway-url.up.railway.app/webhook/squad

---

## Step 8 — Admin REST API Routes

### 8.1 src/routes/providerRoutes.js

```javascript
const express = require('express');
const router = express.Router();
const {
  getAllProviders,
  getProviderById,
  verifyProvider,
  suspendProvider
} = require('../controllers/providerController');

router.get('/', getAllProviders);
router.get('/:id', getProviderById);
router.patch('/:id/verify', verifyProvider);
router.patch('/:id/suspend', suspendProvider);

module.exports = router;
```

### 8.2 src/controllers/providerController.js

```javascript
const Provider = require('../models/Provider');

const getAllProviders = async (req, res) => {
  const { verified, service } = req.query;
  const filter = {};
  if (verified !== undefined) filter.verified = verified === 'true';
  if (service) filter.serviceType = service;
  const providers = await Provider.find(filter).sort({ createdAt: -1 });
  res.json({ success: true, data: providers });
};

const getProviderById = async (req, res) => {
  const provider = await Provider.findById(req.params.id);
  if (!provider) return res.status(404).json({ success: false, message: 'Provider not found' });
  res.json({ success: true, data: provider });
};

const verifyProvider = async (req, res) => {
  const provider = await Provider.findByIdAndUpdate(req.params.id, { verified: true, state: 'ACTIVE' }, { new: true });
  res.json({ success: true, data: provider });
};

const suspendProvider = async (req, res) => {
  const provider = await Provider.findByIdAndUpdate(req.params.id, { suspended: true }, { new: true });
  res.json({ success: true, data: provider });
};

module.exports = { getAllProviders, getProviderById, verifyProvider, suspendProvider };
```

### 8.3 src/routes/bookingRoutes.js

```javascript
const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');

router.get('/', async (req, res) => {
  const { status } = req.query;
  const filter = status ? { status } : {};
  const bookings = await Booking.find(filter)
    .populate('customerId', 'name phone')
    .populate('providerId', 'name phone serviceType')
    .sort({ createdAt: -1 });
  res.json({ success: true, data: bookings });
});

module.exports = router;
```

### 8.4 src/routes/transactionRoutes.js

```javascript
const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');

router.get('/', async (req, res) => {
  const transactions = await Transaction.find().sort({ createdAt: -1 });
  res.json({ success: true, data: transactions });
});

// Stats endpoint for dashboard overview
router.get('/stats', async (req, res) => {
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
      totalTransactions
    }
  });
});

module.exports = router;
```

---

## Step 9 — Railway Deployment

### 9.1 Add a Procfile in the root

```
web: node server.js
```

### 9.2 Push to GitHub

```bash
git init
git add .
git commit -m "Initial Fetcha backend"
git remote add origin your_github_repo_url
git push -u origin main
```

### 9.3 Deploy on Railway

- Go to railway.app and create a new project
- Connect your GitHub repo
- Add all environment variables from your .env file into Railway's Variables tab
- Railway will auto-deploy on every push to main

### 9.4 Set Squad Webhook URL

In your Squad dashboard go to Settings > Webhook and set:
```
https://your-railway-url.up.railway.app/webhook/squad
```

---

## Step 10 — Testing Checklist

Before handing off to the bot and dashboard teams, verify each of these works:

- MongoDB connects successfully on startup
- WhatsApp QR code appears and bot connects after scanning
- New user receives welcome message
- Customer onboarding completes and saves to DB
- Provider onboarding completes and saves to DB
- Squad payment link is generated and sent correctly
- Squad webhook fires and updates transaction status
- Provider is marked verified after verification fee payment
- Booking is confirmed after customer payment
- Haversine returns correct distances for test coordinates
- OpenAI correctly extracts service type from sample messages in English and Pidgin
- Payout fires after customer replies YES
- Rating updates provider trust score correctly
- All admin API routes return correct data
- /api/transactions/stats returns correct counts

---

## Important Notes for Copilot

- All Squad API calls use the sandbox base URL during development. Switch SQUAD_BASE_URL to https://api-d.squadco.com for production.
- Squad payment amounts are always in kobo. Multiply NGN by 100 before sending.
- Transaction references must be unique. Always append a timestamp or unique ID.
- Payout transaction references must be prefixed with the Squad Merchant ID.
- The bot and the backend run in the same Node.js process. The bot imports services directly.
- whatsapp-web.js uses LocalAuth to persist the WhatsApp session so the QR code only needs to be scanned once.
- On Railway, set NODE_ENV=production and ensure the session folder is persisted between deploys.
- Never store raw bank account details without securing the database connection with MongoDB Atlas IP whitelisting.