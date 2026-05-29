
## NOTE : IT'S CURRENTLY NOT DEPLOYED, I HAD TO TAKE THE SERVER DUE TO EXPENSES , HOWEVER HERE THE LINK TO A DEMO VIDEO : https://drive.google.com/file/d/1VaSZ6kZrlxHdqqo7TbKfp8KA_QEQtzFL/view?usp=drive_link

## Fetcha

Fetcha is a WhatsApp-first local services marketplace.

Users chat, find nearby providers, book services, and pay securely.

## Chat on WhatsApp

Start here: https://wa.me/2349041622162

## What Fetcha Does

- Provider discovery based on user location
- End-to-end booking flow on WhatsApp
- Squad payment integration for booking and verification
- Admin controls for verification, suspension, and transaction requery

## Tech Stack

- Node.js + TypeScript
- Express
- MongoDB + Mongoose
- whatsapp-web.js
- Squad API
- OpenAI

## Run Locally

1. Install dependencies
2. Set environment variables in .env
3. Build and run

Example commands:

npm install
npm run build
npm run dev

## Deploy to Railway (Docker)

1. Push this repository to GitHub.
2. In Railway, create a new project and connect your GitHub repo. Railway will build the Docker image using the `Dockerfile` in this repo.
3. Add required environment variables in Railway project settings (at minimum): `MONGODB_URI`, `SQUAD_BASE_URL`, `SQUAD_SECRET_KEY`, `SQUAD_MERCHANT_ID`, `OPENAI_API_KEY`, `CLOUDINARY_*`, `ADMIN_TOKEN`, `START_BOT`.
4. If you want the WhatsApp bot to run on Railway, ensure persistent storage is attached for `.wwebjs_auth_session_*` folders (or run the bot on a separate VM). Otherwise set `START_BOT=false` in Railway so the server runs without attempting Puppeteer.
5. Set the Squad webhook URL to `https://<your-railway-url>/webhook/squad`.

Notes:
- Railway builds will use the `Dockerfile` and install Chromium deps included there.
- Do NOT commit `.env` or session folders to Git. Rotate any keys that were exposed.

## Environment Variables

- PORT
- START_BOT
- ADMIN_TOKEN
- MONGODB_URI
- SQUAD_BASE_URL
- SQUAD_SECRET_KEY
- SQUAD_MERCHANT_ID
- VERIFICATION_FEE
- OPENAI_API_KEY
- CLOUDINARY_CLOUD_NAME
- CLOUDINARY_API_KEY
- CLOUDINARY_API_SECRET

## Status

Active backend project for a WhatsApp-native services experience in Nigeria.
