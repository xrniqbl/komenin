#!/bin/sh
set -e

echo "[entrypoint] Komenin starting..."

# Jalankan migrasi database (aman untuk dijalankan berulang). Kegagalan migrate
# TIDAK boleh diabaikan: server yang start dengan schema lama akan melempar
# error runtime (kolom/tabel hilang) jauh lebih sulit didiagnosis.
if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "[entrypoint] Running prisma migrate deploy..."
  ./node_modules/.bin/prisma migrate deploy || {
    echo "[entrypoint] FATAL: migrate deploy gagal — cek DATABASE_URL. Server tidak dijalankan."
    exit 1
  }
fi

echo "[entrypoint] Launching: $@"
exec "$@"
