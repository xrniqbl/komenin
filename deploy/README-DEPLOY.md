# ðŸš€ Deploy Aether ke VPS dengan Docker (multi-web)

Panduan ini memasang Aether di VPS memakai **Docker + Traefik**, sehingga satu
VPS bisa menjalankan **beberapa website** sekaligus (masing-masing domain sendiri,
HTTPS otomatis lewat Let's Encrypt).

Stack yang dijalankan:
- **traefik** â€” reverse proxy + sertifikat HTTPS otomatis untuk semua situs
- **db** â€” PostgreSQL 16 (data Aether)
- **app** â€” aplikasi Aether (Next.js standalone)

---

## 1. Yang perlu disiapkan

Di VPS (Ubuntu/Debian):
- Docker + Docker Compose plugin
- Port **80** dan **443** terbuka di firewall
- Domain sudah diarahkan (A record) ke IP VPS, mis. `aether.iniloka.id`

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
Ini menghasilkan `aether-upload.tar.gz` (tanpa node_modules/.next/.env). Upload ke VPS:
```bash
scp aether-upload.tar.gz user@IP_VPS:/opt/
ssh user@IP_VPS
cd /opt && mkdir -p aether && tar -xzf aether-upload.tar.gz -C aether && cd aether
```

> Alternatif tanpa zip: `git clone` repo langsung di VPS.

---

## 3. Konfigurasi environment

```bash
cp .env.docker.example .env.docker
nano .env.docker
```

Isi minimal yang WAJIB:
- `AETHER_DOMAIN` â€” domain aplikasi (mis. `aether.iniloka.id`)
- `ACME_EMAIL` â€” email untuk notifikasi Let's Encrypt
- `POSTGRES_PASSWORD` â€” password DB yang kuat
- `AUTH_SECRET` â€” `openssl rand -base64 48`
- `ENCRYPTION_KEY` â€” `openssl rand -hex 32` (harus 64 hex char)
- `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` â€” dari Google Cloud Console
- `SIMULATOR_MODE="false"` untuk produksi

> Di Google OAuth, tambahkan redirect URI:
> `https://AETHER_DOMAIN/api/auth/callback/google`

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
1. Image Aether dibangun (`npm ci` â†’ `prisma generate` â†’ `next build`).
2. PostgreSQL start, entrypoint menjalankan `prisma migrate deploy`.
3. Traefik menerbitkan sertifikat HTTPS untuk domain, lalu situs live di
   `https://AETHER_DOMAIN`.

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

Backup database:
```bash
docker compose --env-file .env.docker exec db \
  pg_dump -U aether aether > backup_$(date +%F).sql
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
- Fitur worker/cron: panggil `POST /api/worker/run` (Bearer `WORKER_SECRET`) atau
  pasang cron sistem yang memanggil `/api/worker/cron` (Bearer `CRON_SECRET`).