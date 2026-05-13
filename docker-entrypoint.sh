#!/bin/sh
set -e

echo "[entrypoint] Syncing database schema..."
npx prisma db push --accept-data-loss

echo "[entrypoint] Starting application..."
exec node dist/main
