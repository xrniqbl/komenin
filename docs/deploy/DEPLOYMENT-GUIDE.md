# Komenin Production Deployment Guide

**Version**: 2.0  
**Last Updated**: 2026-08-24  
**Purpose**: Complete production deployment instructions for Komenin social media automation platform  

---

## Table of Contents

1. [Overview](#overview)
2. [Pre-Deployment Checklist](#pre-deployment-checklist)
3. [Infrastructure Requirements](#infrastructure-requirements)
4. [Environment Setup](#environment-setup)
5. [Database Configuration](#database-configuration)
6. [Docker Deployment](#docker-deployment)
7. [Vercel Deployment](#vercel-deployment)
8. [Post-Deployment Tasks](#post-deployment-tasks)
9. [Monitoring & Maintenance](#monitoring--maintenance)
10. [Troubleshooting](#troubleshooting)

---

## Overview

This guide provides step-by-step instructions for deploying the Komenin application to production. The platform supports two deployment options:

### Option 1: Self-Hosted Docker (Recommended for Full Control)
- **Pros**: Complete control, lower cost, custom configurations
- **Cons**: Requires DevOps expertise, manual updates needed
- **Best for**: Teams with DevOps resources

### Option 2: Vercel (Recommended for Simplicity)
- **Pros**: Zero DevOps, automatic scaling, CDN included
- **Cons**: Higher cost at scale, less configuration flexibility
- **Best for**: Startups, teams without dedicated DevOps

---

## Pre-Deployment Checklist

Before proceeding with deployment, ensure all items below are complete:

### ✅ Security Configuration

- [ ] Generate `ENCRYPTION_KEY` (64 hex characters)
- [ ] Set strong `AUTH_SECRET` (min 16 chars)
- [ ] Configure `WORKER_SECRET` and `CRON_SECRET` (min 16 chars each)
- [ ] Disable `SIMULATOR_MODE` (must be `false`)
- [ ] Set `ALLOW_SECURITY_STUBS=false`
- [ ] Configure HTTPS certificate (Let's Encrypt or similar)

### ✅ OAuth & API Keys

- [ ] Google OAuth credentials registered
- [ ] Instagram Graph API app approved (if needed)
- [ ] Threads API access granted (if needed)
- [ ] Midtrans merchant account created
- [ ] API keys configured (not in commit history)

### ✅ Database Preparation

- [ ] PostgreSQL instance provisioned
- [ ] Connection string secured
- [ ] Prisma migrations tested locally
- [ ] Superadmin user created or script ready

### ✅ Feature Flags

- [ ] AI provider configured (optional)
- [ ] Social webhook URL set (for live publishing)
- [ ] Rate limiting thresholds defined
- [ ] Email notification service configured

---

## Infrastructure Requirements

### Minimum Server Specifications (Self-Hosted)

```yaml
CPU:     2 vCPUs
Memory:  4GB RAM
Storage: 50GB SSD (plus database volume)
Network: 1Gbps bandwidth
OS:      Ubuntu 22.04 LTS or Debian 12+
```

### Recommended Specifications (Production Workload)

```yaml
CPU:     4 vCPUs
Memory:  8GB RAM
Storage: 100GB SSD
Network: 5Gbps bandwidth
Backups: Off-site storage enabled
```

### Cloud Providers

**Recommended Options:**
- AWS EC2 (t3.large or c5.2xlarge)
- DigitalOcean Droplet (8GB RAM plan)
- Google Cloud Compute Engine (n2-standard-4)
- Hetzner Cloud (CPX31)

---

## Environment Setup

### Step 1: Server Preparation

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo apt install docker-compose-plugin -y

# Install git
sudo apt install git -y

# Reboot server
sudo reboot
```

### Step 2: Directory Structure

```bash
# Create project directory
mkdir -p /opt/komenin/{logs,backups}
cd /opt/komenin

# Clone repository (or upload code)
git clone https://github.com/your-org/komenin.git .

# Set proper permissions
sudo chown -R $USER:$USER /opt/komenin
chmod -R 755 /opt/komenin
```

### Step 3: Generate Secure Secrets

```bash
# AUTH_SECRET - Minimum 16 characters, recommended 48
echo "AUTH_SECRET=$(openssl rand -base64 48)" >> .env.docker

# ENCRYPTION_KEY - Exactly 64 hex characters
echo "ENCRYPTION_KEY=$(openssl rand -hex 32)" >> .env.docker

# WORKER_SECRET - Minimum 16 characters
echo "WORKER_SECRET=$(openssl rand -hex 24)" >> .env.docker

# CRON_SECRET - Minimum 16 characters
echo "CRON_SECRET=$(openssl rand -hex 24)" >> .env.docker

# Verify .env.docker has all required secrets
cat .env.docker
```

---

## Database Configuration

### Option A: Managed PostgreSQL (Recommended)

**Neon.tech (Serverless):**
```bash
# 1. Create project at https://neon.tech
# 2. Get connection string from dashboard
# 3. Format as:
DATABASE_URL="postgresql://user:password@ep-xxx.us-east-1.aws.neon.tech/dbname?sslmode=require"
```

**AWS RDS:**
```bash
# 1. Create RDS instance
# 2. Configure security group (allow port 5432)
# 3. Get endpoint: postgresql://username:password@endpoint:5432/database
```

### Option B: Local Docker PostgreSQL

```yaml
# In docker-compose.yml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-komenin}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-changeme_strong_password!}
      POSTGRES_DB: ${POSTGRES_DB:-komenin}
    volumes:
      - db_data:/var/lib/postgresql/data
```

### Run Migrations

```bash
# First-time setup
npm run db:migrate:deploy

# Verify migrations applied
npm run db:migrate:status

# Open Prisma Studio (interactive)
npm run db:studio
```

### Create Superadmin User

```sql
-- Connect to database
psql -U postgres -d komenin

-- Grant superadmin role
UPDATE "User" 
SET "platformRole" = 'superadmin'
WHERE email = 'your-email@example.com';

-- Exit
\q
```

---

## Docker Deployment

### Step 1: Configure .env.docker

Copy template and fill values:
```bash
cp .env.docker.example .env.docker
nano .env.docker
```

Required fields:
- `KOMENIN_DOMAIN=komenin.id`
- `ACME_EMAIL=admin@komenin.id`
- `POSTGRES_PASSWORD=<secure-password>`
- `AUTH_SECRET=<generate-with-openssl>`
- `AUTH_GOOGLE_ID=<google-client-id>`
- `AUTH_GOOGLE_SECRET=<google-client-secret>`
- `ENCRYPTION_KEY=<64-char-hex>`
- `SIMULATOR_MODE=false`
- `WORKER_SECRET=<secure-token>`
- `CRON_SECRET=<secure-token>`

### Step 2: Build & Deploy

```bash
# Navigate to deployment directory
cd /opt/komenin

# Pull latest images
docker pull traefik:v3.1
docker pull postgres:16-alpine

# Start services
docker compose --env-file .env.docker up -d --build

# View logs
docker compose --env-file .env.docker logs -f app
```

### Step 3: Verify Deployment

```bash
# Check container status
docker ps

# Expected output:
# CONTAINER   IMAGE             STATUS
# komenin-app  komenin:latest     Up (healthy)
# komenin-db   postgres:alpine   Up (healthy)
# komenin-tr   traefik           Up

# Test health endpoint
curl http://localhost/api/health

# Expected response:
# {"ok":true,"service":"komenin","timestamp":"..."}

# Test main application
curl https://komenin.id
```

---

## Vercel Deployment

### Prerequisites

- Vercel account (free tier available)
- GitHub repository connected to Vercel
- Database already provisioned (Neon, Supabase, etc.)

### Step 1: Configure Project

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Link project
cd /opt/komenin
vercel link
```

### Step 2: Set Environment Variables

In Vercel Dashboard:
1. Go to **Settings** → **Environment Variables**
2. Add all variables from `.env.docker`
3. Mark sensitive variables as **Secret**
4. **IMPORTANT**: Set `NODE_ENV=production`

### Step 3: Deploy

```bash
# Deploy to preview environment
vercel

# Deploy to production
vercel --prod
```

### Optional: CI/CD with GitHub Actions

Create `.github/workflows/vercel-deploy.yml`:

```yaml
name: Deploy to Vercel

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          working-directory: ./
```

---

## Post-Deployment Tasks

### Task 1: Register Domain & SSL

For self-hosted deployments using Traefik:

```bash
# Traefik automatically gets Let's Encrypt certificates
# Configure DNS record:
# @ IN A <SERVER_IP>
# *. IN A <SERVER_IP>
```

For Vercel:
- Add domain in **Settings** → **Domains**
- Follow CNAME/DNS verification steps
- Auto-renewing SSL provided by Vercel

### Task 2: Create First Workspace

1. Visit `https://komenin.id/signup`
2. Complete onboarding wizard
3. Create workspace via `/app` dashboard
4. Invite team members

### Task 3: Configure Webhooks

For external social publishing webhooks:

```typescript
// Worker webhook endpoint (public IP required)
export async function POST(request: Request) {
  const signature = request.headers.get('x-webhook-signature');
  
  if (!verifyWebhookSignature(await text(), signature!, WEBHOOK_SECRET)) {
    return Response.json({ error: 'Invalid signature' }, { status: 401 });
  }
  
  // Process publish request
}
```

Update webhook URL in config:
```bash
SOCIAL_PUBLISH_WEBHOOK_URL=https://your-domain.com/api/publish/webhook
```

### Task 4: Backup Strategy

**Daily Automatic Backups:**
```bash
# Create backup cron job
sudo crontab -e

# Add this line (runs daily at 2 AM)
0 2 * * * cd /opt/komenin && docker exec db pg_dump -U komenin komenin > /opt/komenin/backups/db_backup_$(date +\%Y\%m\%d).sql && find /opt/komenin/backups -name '*.sql' -mtime +7 -delete
```

### Task 5: Monitoring Setup

#### Sentry (Error Tracking)

1. Create project at sentry.io
2. Add DSN to environment variables:
```bash
SENTRY_DSN=https://xxxx@sentry.io/xxxx
SENTRY_ENVIRONMENT=production
```

#### Prometheus + Grafana (Metrics)

> **Belum ada di repo:** `monitoring.yml` dan dashboard Grafana tidak disertakan.
> Sementara ini andalkan `/api/health` (liveness) + `/api/status` (deep check,
> memverifikasi DB & production gate) pada uptime monitor eksternal, dan kumpulkan
> log via `docker compose logs`. Implementasi metrics endpoint ada di backlog.

---

## Monitoring & Maintenance

### Health Checks

Monitor these endpoints:
- `/api/health` - Liveness probe (tanpa DB/rate limit — untuk LB & uptime monitor)
- `/api/status` - Deep readiness (DB + production gate; rate-limited 60/menit)
- Worker job history ada di panel `/admin/jobs` (bukan endpoint publik)

### Log Management

```bash
# View real-time logs
docker compose logs -f app cron backup db

# Rotate logs (prevent disk fillup)
sudo journalctl --vacuum-time=7d
```

### Performance Optimization

```bash
# Clear build cache periodically
docker builder prune -a

# Optimize Docker layer caching
docker system prune -f

# Monitor resource usage
docker stats
```

### Update Process

```bash
# Pull latest code
cd /opt/komenin && git pull

# Rebuild images
docker compose build

# Rolling restart
docker compose down && docker compose up -d

# Verify all checks pass
sleep 30 && curl localhost/api/health
```

---

## Troubleshooting

### Issue 1: Container Won't Start

**Symptoms**: Container shows `Exited` or `Restarting` state

**Solutions**:
```bash
# Check logs
docker compose logs app

# Common causes:
# 1. Missing environment variables
docker inspect <container_id> | grep Env

# 2. Database connectivity issues
docker compose exec app node -e "require('@prisma/client').PrismaClient().$connect()"

# 3. Port conflicts
lsof -i :3000
```

### Issue 2: Authentication Fails

**Symptoms**: Users can't sign in, OAuth redirects loop

**Solutions**:
```bash
# Verify callback URLs match exactly
Expected: https://komenin.id/api/auth/callback/google

# Check OAuth secret format
node -e "console.log(Buffer.from(process.env.AUTH_GOOGLE_SECRET, 'utf8').toString('base64'))"

# Reset session tokens (hapus semua login session aktif — semua user harus login ulang)
docker compose exec app npx prisma db execute --stdin <<< 'DELETE FROM "LoginSession";'
# Setelah itu, verifikasi migrasi selaras dengan schema:
docker compose exec app npx prisma migrate status
```

### Issue 3: Slow Performance

**Symptoms**: API responses taking > 1 second

**Diagnosis**:
```bash
# Check database query performance
docker compose exec db psql -c "SELECT pid, now() - query_start, query FROM pg_stat_activity WHERE state = 'active';"

# Monitor memory usage
docker stats --no-stream

# Check Prisma client connection pool
docker compose exec app node -e "console.log(require('./prisma').client.$config)"
```

### Issue 4: Payment/Webhook Issues

**Symptoms**: Midtrans transactions failing, webhooks not received

**Solutions**:
```bash
# Verify webhook URL is publicly accessible
curl https://komenin.id/api/billing/midtrans/notification

# Check signature verification
export WEBHOOK_SIGNATURE=$(curl -s -X POST https://your-server.com -H "x-signature: test")
docker compose exec app node -e "require('./lib/webhook-verifier').verifyWebhookSignature('test', '$WEBHOOK_SIGNATURE', process.env.WEBHOOK_SECRET)"

# Test Midtrans sandbox mode
export MIDTRANS_IS_PRODUCTION=false
docker compose restart app
```

---

## Security Best Practices

### Before Going Live

1. **Rotate ALL default passwords/secrets**
2. **Disable debug modes** (`DEBUG=*,error,*`)
3. **Enable strict CSP headers**
4. **Configure firewall rules**
5. **Set up intrusion detection** (fail2ban)

### Ongoing Maintenance

- Weekly: Review audit logs
- Monthly: Rotate encryption keys
- Quarterly: Penetration testing
- Annually: Security architecture review

---

## Resources

### Documentation
- [Official Next.js Docs](https://nextjs.org/docs)
- [Docker Documentation](https://docs.docker.com/)
- [Prisma Migration Guide](https://www.prisma.io/docs/guides/database/migration-overview)

### Support
- GitHub Issues: Report bugs
- Discord Community: Chat with developers
- Email Support: support@komenin.id

---

**Document Version**: 2.0  
**Last Reviewed**: 2026-08-24  
**Next Review**: Q4 2026
