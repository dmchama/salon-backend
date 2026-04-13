# Salon Platform API

NestJS + TypeScript modular monolith: salons, services, bookings, subscriptions, BullMQ notifications, JWT auth, Prisma + MySQL, Redis.

## Prerequisites

- Node.js 20+
- MySQL 8 and Redis 6+ (or Docker)

## Setup

1. Copy `.env.example` to `.env` and adjust secrets and URLs.
2. Start infrastructure:

   ```bash
   docker compose -f docker/docker-compose.yml up -d mysql redis
   ```

3. Install and migrate:

   ```bash
   npm install
   npx prisma migrate dev --name init
   npm run prisma:seed
   npx prisma generate
   ```

4. Run API (port 3000):

   ```bash
   npm run start:dev
   ```

5. Run notification worker (separate process; processes BullMQ jobs + daily subscription reminder cron):

   ```bash
   npm run start:worker:dev
   ```

- HTTP API base path: `/api/v1`
- Swagger UI: `/api/docs`
- Health: `GET /api/v1/health`

## Docker (API + worker + MySQL + Redis)

```bash
docker compose -f docker/docker-compose.yml up --build
```

Run migrations inside the API container once (after `mysql` is healthy):

```bash
docker compose -f docker/docker-compose.yml exec api npx prisma migrate deploy
docker compose -f docker/docker-compose.yml exec api npx prisma db seed
```

## Default seed user

- Email: `admin@example.com`
- Password: `Admin123!`

## Tests

Unit tests: `npm run test`  
E2E: requires MySQL/Redis available (`npm run test:e2e`).
