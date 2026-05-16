# Fetcha — Admin API Spec & Project Brief

## Project Brief
Fetcha is a WhatsApp-first local services marketplace connecting customers to nearby verified service providers (food, hair & beauty, fashion, photography, home services). Customers interact with a conversational WhatsApp bot to search, book and pay. Providers onboard through WhatsApp, pay a small verification fee, and receive payouts after jobs complete. The backend exposes admin APIs for management, monitoring, and manual interventions.

Primary actors:
- Customer (WhatsApp user)
- Provider (WhatsApp user)
- Admin (uses this API)

Tech notes:
- Node.js + TypeScript, Express, Mongoose
- WhatsApp integration via `whatsapp-web.js` (bot client at `src/bot`)
- Payments via Squad sandbox (`squadService`) with webhooks at `/webhook/squad`

---

## Auth
All admin endpoints require a simple Bearer token header for now:

Header: `Authorization: Bearer <ADMIN_TOKEN>`

(Implement middleware to validate token in production.)

---

## Base URL
`http://localhost:3000/api`

---

## Providers

### GET /api/providers
Query: `?verified=true|false&service=serviceType&page=1&limit=20`
Response 200:
```json
{
  "total": 42,
  "page": 1,
  "limit": 20,
  "providers": [
    {"_id":"...","name":"Jide","phone":"234801...","serviceType":"hair_beauty","verified":true,"suspended":false,"trustScore":4.8}
  ]
}
```

### GET /api/providers/:id
Response 200: provider full object (see `src/models/Provider.ts` for fields)

### PATCH /api/providers/:id/verify
Body: `{ "verified": true }` (optional)
Response 200: updated provider object

### PATCH /api/providers/:id/suspend
Body: `{ "suspended": true, "reason": "policy violation" }`
Response 200: updated provider object

### DELETE /api/providers/:id
Response: 204 No Content

---

## Bookings

### GET /api/bookings
Query: `?status=pending|confirmed|completed|disputed&serviceType=&page=&limit=`
Response 200: paginated bookings list (populate `customerId` and `providerId` in controllers)

### GET /api/bookings/:id
Response 200: booking with populated customer/provider minimal info

### PATCH /api/bookings/:id
Body: `{ "status": "confirmed" }` (or `amount`, `note`)
Response 200: updated booking

### POST /api/bookings/:id/payout
Body: `{ "amount": 2000, "remark": "Payout for booking" }`
Action: calls `squadService.fundTransfer` and records a Transaction
Response 200: `{ "success": true, "payoutRef": "...", "transaction": { ... } }`

### DELETE /api/bookings/:id
Response: 204 No Content

---

## Transactions

### GET /api/transactions
Query: `?type=verification_fee|booking_payment|payout&status=pending|success|failed&phone=&page=&limit=`
Response 200: paginated transactions

### GET /api/transactions/:ref
Response 200: transaction object

### POST /api/transactions/:ref/requery
Action: call Squad to requery transaction or transfer status
Response 200: `{ "success": true, "status": "success", "updatedTransaction": { ... } }`

---

## Admin Stats

### GET /api/admin/stats
Response 200:
```json
{
  "totalProviders": 123,
  "verifiedProviders": 80,
  "suspendedProviders": 2,
  "totalBookings": 540,
  "pendingBookings": 8,
  "completedBookings": 510,
  "totalTransactions": 612,
  "totalRevenue": 420000
}
```

---

## Webhook (already implemented)
### POST /webhook/squad
- Accepts Squad sandbox callbacks
- Must return HTTP 200 immediately
- Handler updates `Transaction`, `Provider` or `Booking` depending on `transaction_ref` and `type`
- Webhook is idempotent: if a transaction is already marked `success`, it returns early and does not resend notifications
- Webhook should attempt to notify users via bot client; logs help debugging (`src/webhooks/squadWebhook.ts`)
- Current WhatsApp session in development may require sending to `@lid` JIDs instead of `@c.us` for webhook-triggered notifications

Example test curl (replace `transaction_ref`):
```bash
curl -X POST http://localhost:3000/webhook/squad \
  -H 'Content-Type: application/json' \
  -d '{ "data": { "transaction_ref": "verification_64750943764725_1650000000000", "transaction_status": "success" } }'
```

---

## Errors
Standard JSON error payload:
```json
{ "error": "Human readable message", "code": "ERR_CODE" }
```
HTTP codes: 400 validation, 401 auth, 403 forbidden, 404 not found, 422 unprocessable, 500 server

---

## Implementation Hints
- Use existing services in `src/services/` (`squadService`, `locationService`) for payments and lookups.
- Populate related models in booking endpoints with Mongoose `populate`.
- When sending bot messages from server-side code (webhook, admin-triggered notifications), require the bot client with `const raw = require('../bot/index'); const client = raw && raw.default ? raw.default : raw;` and guard for `client` availability.
- Reuse a fresh Squad `transaction_ref` for each retry; repeated callbacks for the same ref should be treated as already processed once marked `success`.
- Protect admin routes with middleware that checks an `ADMIN_TOKEN` env var.

---

