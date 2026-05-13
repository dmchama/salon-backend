# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

RUN apk add --no-cache openssl

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

COPY . .
RUN ls src/ && npx tsc -p tsconfig.build.json && ls dist/main.js

# ── Stage 2: Production ───────────────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

RUN apk add --no-cache openssl

ENV NODE_ENV=production

# Copy everything from builder so prisma CLI and generated client are available
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY prisma ./prisma

COPY docker-entrypoint.sh .
RUN chmod +x docker-entrypoint.sh

RUN mkdir -p uploads/receipts

EXPOSE 3000

ENTRYPOINT ["/bin/sh", "docker-entrypoint.sh"]
