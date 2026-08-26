#!/bin/sh
set -e

echo "[entrypoint] Aether starting..."

# Jalankan migrasi database (aman untuk dijalankan berulang)
if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "[entrypoint] Running prisma migrate deploy..."
  ./node_modules/.bin/prisma migrate deploy || {
    echo "[entrypoint] migrate deploy gagal — cek DATABASE_URL. Tetap lanjut start server."
  }
fi

echo "[entrypoint] Launching: $@"
exec "$@"