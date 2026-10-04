# ðŸš€ Deploy Komenin ke VPS dengan Docker (multi-web)

Panduan ini memasang Komenin di VPS memakai **Docker + Traefik**, sehingga satu
VPS bisa menjalankan **beberapa website** sekaligus (masing-masing domain sendiri,
HTTPS otomatis lewat Let's Encrypt).

Stack yang dijalankan:
- **traefik** â€” reverse proxy + sertifikat HTTPS otomatis untuk semua situs
- **db** â€” PostgreSQL 16 (data Komenin)
- **app** â€” aplikasi Komenin (Next.js standalone)

---

## 1. Yang perlu disiapkan

Di VPS (Ubuntu/Debian):
- Docker + Docker Compose plugin
- Port **80** dan **443** terbuka di firewall
- Domain sudah diarahkan (A record) ke IP VPS, mis. `komenin.id`

Install Docker (sekali saja):
```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # logout/login lagi setelah ini
```

---

## 2. File yang diupload ke VPS

Cukup upload **kode sumber repo** (bukan `node_modules`/`.next` â€” image dibangun
di VPS). Yang penting ada:

```
Dockerfile
docker-compose.yml
.dockerignore
.env.docker.example
deploy/docker-entrypoint.sh
package.json  package-lock.json
prisma/           (schema + migrations)
src/  public/  next.config.mjs  tsconfig.json  postcss.config.mjs  components.json  vitest*.ts  eslint.config.mjs
```

### Cara paling mudah: buat arsip siap-upload
Di komputer lokal (PowerShell), dari root repo:
```powershell
npm run pack:deploy
```
Ini menghasilkan `komenin-upload.tar.gz` (tanpa node_modules/.next/.env). Upload ke VPS:
```bash
scp komenin-upload.tar.gz user@IP_VPS:/opt/
ssh user@IP_VPS
cd /opt && mkdir -p komenin && tar -xzf komenin-upload.tar.gz -C komenin && cd komenin
```

> Alternatif tanpa zip: `git clone` repo langsung di VPS.

---

## 3. Konfigurasi environment

```bash
cp .env.docker.example .env.docker
nano .env.docker
```

Isi minimal yang WAJIB (lihat `.env.docker.example` untuk daftar lengkap —
template itu mirror `.env.production.example`):
- `KOMENIN_DOMAIN` — domain aplikasi (mis. `komenin.id`)
- `ACME_EMAIL` — email untuk notifikasi Let's Encrypt
- `POSTGRES_PASSWORD` — password DB yang kuat
- `AUTH_SECRET` — `openssl rand -base64 48`
- `ENCRYPTION_KEY` — `openssl rand -hex 32` (harus 64 hex char)
- `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` — dari Google Cloud Console
- `WORKER_SECRET` / `CRON_SECRET` — `openssl rand -hex 24` masing-masing
- `OAUTH_STATE_SECRET` / `SSO_TICKET_SECRET` / `API_KEY_PEPPER` —
  `openssl rand -hex 32` masing-masing (wajib prod, tanpa fallback AUTH_SECRET)
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` — durable rate limiting
- `BREVO_API_KEY` / `EMAIL_FROM` — OTP login + digest gagal diam-diam tanpanya
- `SOCIAL_PUBLISH_WEBHOOK_URL` (bridge eksternal https, bukan URL app sendiri)
  + `SOCIAL_PUBLISH_WEBHOOK_TOKEN`
- `MIDTRANS_SERVER_KEY` / `MIDTRANS_CLIENT_KEY` (sandbox `SB-…` dulu,
  live `Mid-…` + `MIDTRANS_IS_PRODUCTION=true`)
- `SIMULATOR_MODE=”false”` untuk produksi
- Opsional tapi disarankan: `BACKUP_ENCRYPTION_KEY` (`openssl rand -hex 32`)
  agar dump backup terenkripsi, `SENTRY_DSN`, `AI_MODEL_COST_IDR`.

> Di Google OAuth, tambahkan redirect URI:
> `https://KOMENIN_DOMAIN/api/auth/callback/google`

Generate secret cepat:
```bash
echo "AUTH_SECRET=$(openssl rand -base64 48)"
echo "ENCRYPTION_KEY=$(openssl rand -hex 32)"
echo "WORKER_SECRET=$(openssl rand -hex 24)"
echo "CRON_SECRET=$(openssl rand -hex 24)"
```

---

## 4. Jalankan

```bash
docker compose --env-file .env.docker up -d --build
```

Yang terjadi otomatis:
1. Image Komenin dibangun (`npm ci` â†’ `prisma generate` â†’ `next build`).
2. PostgreSQL start, entrypoint menjalankan `prisma migrate deploy`.
3. Traefik menerbitkan sertifikat HTTPS untuk domain, lalu situs live di
   `https://KOMENIN_DOMAIN`.

Cek status & log:
```bash
docker compose --env-file .env.docker ps
docker compose --env-file .env.docker logs -f app
docker compose --env-file .env.docker logs -f traefik
```

---

## 5. Menambah web lain di VPS yang sama

Traefik sudah menangani banyak domain. Untuk menambah situs, tambahkan service
baru di `docker-compose.yml` dengan label Traefik. Contoh sudah disiapkan di
block `web2` (tinggal buka komentarnya):

```yaml
  web2:
    image: nginx:alpine
    restart: unless-stopped
    networks:
      - web
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.web2.rule=Host(`${WEB2_DOMAIN}`)"
      - "traefik.http.routers.web2.entrypoints=websecure"
      - "traefik.http.routers.web2.tls.certresolver=le"
      - "traefik.http.services.web2.loadbalancer.server.port=80"
```

Aturan tiap situs baru:
- gabung ke network `web`
- `traefik.enable=true`
- `...routers.<nama>.rule=Host(...)` â†’ domainnya
- `...routers.<nama>.tls.certresolver=le` â†’ HTTPS otomatis
- `...services.<nama>.loadbalancer.server.port=PORT` â†’ port internal container

Domain baru cukup diarahkan A record ke IP VPS; sertifikat dibuat otomatis.

Jika situs lain punya repo/Dockerfile sendiri, boleh dijalankan sebagai compose
project terpisah â€” pastikan tetap join network `web` yang sama dengan Traefik:
```yaml
networks:
  web:
    external: true
```

---

## 6. Operasional harian

Update ke versi baru:
```bash
git pull            # atau upload arsip baru & extract
docker compose --env-file .env.docker up -d --build
```

Migrasi DB jalan otomatis tiap start. Untuk manual:
```bash
docker compose --env-file .env.docker exec app ./node_modules/.bin/prisma migrate deploy
```

Jadwal worker: service `cron` di compose (jadwal di `deploy/cron-jobs`)
memanggil `/api/worker/cron?job=…` dengan `CRON_SECRET` — mirror crons
`vercel.json` (comment.send & content.publish tiap 2 menit, worker.tick tiap
5 menit yang fan-out ke semua job termasuk billing.expire, dst). Tanpa service
ini comment/publish/billing.expire tidak pernah berjalan. Cek:
```bash
docker compose --env-file .env.docker logs cron
```

Backup database: service `backup` di compose menjalankan
`scripts/backup-db.sh` tiap hari 02:15 (gzip + AES-256 bila
`BACKUP_ENCRYPTION_KEY` diset + upload S3 opsional). Restore manual:
```bash
docker compose --env-file .env.docker exec backup sh /usr/local/bin/backup-db.sh restore /backups/<file>
```

Restart / stop:
```bash
docker compose --env-file .env.docker restart app
docker compose --env-file .env.docker down          # stop semua (data DB tetap aman di volume)
```

---

## 7. Catatan keamanan

- File `.env.docker` berisi rahasia â€” jangan commit (sudah masuk `.gitignore`).
- `SIMULATOR_MODE` harus `false` di produksi; app punya production-gate yang
  gagal jika stub keamanan aktif.
- PostgreSQL hanya di network internal (tidak diekspos ke internet).
- Traefik dashboard sengaja tidak diaktifkan. Jangan aktifkan tanpa auth.
- Scheduler: JANGAN matikan service `cron` — tanpanya worker tidak jalan.
  Endpoint cron menerima Bearer `CRON_SECRET` atau `WORKER_SECRET`.