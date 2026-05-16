FROM node:20-bullseye

# Install Chrome deps required by Puppeteer/Chromium
RUN apt-get update && apt-get install -y \
  ca-certificates fonts-liberation libasound2 libatk1.0-0 libatk-bridge2.0-0 \
  libcups2 libdbus-1-3 libgdk-pixbuf2.0-0 libnspr4 libnss3 libx11-xcb1 \
  libxcomposite1 libxdamage1 libxrandr2 libgbm1 libglib2.0-0 libxss1 libgtk-3-0 \
  wget --no-install-recommends && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies (include dev deps for build) then prune
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Remove dev dependencies to keep image slim
RUN npm prune --production

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "dist/server.js"]
