#!/usr/bin/env bash
# Komenin database backup — pg_dump → gzip → optional AES-256 encryption →
# local dir or S3-compatible storage. Designed for a daily cron.
#
# Usage:
#   ./scripts/backup-db.sh                    # backup to BACKUP_DIR (default ./backups)
#   ./scripts/backup-db.sh restore <file>     # decrypt + restore from a backup file
#
# Required env:
#   DATABASE_URL            — Postgres connection string
# Optional env:
#   BACKUP_DIR              — default: ./backups (created if missing)
#   BACKUP_ENCRYPTION_KEY   — 32-byte hex key; when set, output is AES-256 encrypted
#   BACKUP_RETENTION_DAYS   — delete local backups older than N days (default 14)
#   BACKUP_S3_ENDPOINT      — S3-compatible endpoint (e.g. https://s3.ap-southeast-1.amazonaws.com)
#   BACKUP_S3_BUCKET        — bucket name; when set + aws CLI present, upload after backup
#   BACKUP_S3_PREFIX        — key prefix (default: backups)
#
# Exit codes: 0 success, 1 bad usage, 2 missing tooling, 3 backup failed,
#             4 upload failed, 5 restore failed.

set -euo pipefail

RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
S3_PREFIX="${BACKUP_S3_PREFIX:-backups}"

log() { echo "[backup-db] $(date -u +%FT%TZ) $*"; }
die() { log "ERROR: $*"; exit "${2:-3}"; }

require_tool() {
  command -v "$1" >/dev/null 2>&1 || die "$2" 2
}

encrypt_stream() {
  # AES-256-CBC with the raw key (32 bytes hex → 64 chars). OpenSSL derives
  # the IV per file via salt ("-salt" default) — same key, unique ciphertexts.
  if [ -n "${BACKUP_ENCRYPTION_KEY:-}" ]; then
    openssl enc -aes-256-cbc -salt -pbkdf2 -K "${BACKUP_ENCRYPTION_KEY}" -iv "$(printf '%s' "${BACKUP_ENCRYPTION_KEY}" | tail -c 32)"
  else
    cat
  fi
}

decrypt_stream() {
  if [ -n "${BACKUP_ENCRYPTION_KEY:-}" ]; then
    openssl enc -d -aes-256-cbc -pbkdf2 -K "${BACKUP_ENCRYPTION_KEY}" -iv "$(printf '%s' "${BACKUP_ENCRYPTION_KEY}" | tail -c 32)"
  else
    cat
  fi
}

do_backup() {
  require_tool pg_dump "pg_dump is required (install postgresql-client)"
  require_tool gzip "gzip is required"
  [ -n "${DATABASE_URL:-}" ] || die "DATABASE_URL is not set"

  mkdir -p "${BACKUP_DIR}"
  local stamp file
  stamp="$(date -u +%Y%m%dT%H%M%SZ)"
  file="${BACKUP_DIR}/komenin-db-${stamp}.sql.gz${BACKUP_ENCRYPTION_KEY:+.enc}"

  log "dumping database → ${file}"
  # -Z 6: gzip mid-level (fast enough, good ratio)
  # --no-owner --no-privileges: restorable to any role/cloud user
  if pg_dump "${DATABASE_URL}" --no-owner --no-privileges -Z 6 \
     | encrypt_stream > "${file}"; then
    local size
    size="$(du -h "${file}" | cut -f1)"
    log "backup written: ${file} (${size})"
  else
    rm -f "${file}"
    die "pg_dump pipeline failed"
  fi

  # Remote copy (optional): S3-compatible object storage via aws CLI
  if [ -n "${BACKUP_S3_BUCKET:-}" ]; then
    if command -v aws >/dev/null 2>&1; then
      local endpoint=""
      [ -n "${BACKUP_S3_ENDPOINT:-}" ] && endpoint="--endpoint-url ${BACKUP_S3_ENDPOINT}"
      if aws ${endpoint} s3 cp "${file}" "s3://${BACKUP_S3_BUCKET}/${S3_PREFIX}/$(basename "${file}")" >/dev/null; then
        log "uploaded to s3://${BACKUP_S3_BUCKET}/${S3_PREFIX}/"
      else
        die "S3 upload failed (backup still safe locally: ${file})" 4
      fi
    else
      log "WARN: BACKUP_S3_BUCKET set but aws CLI not found — skipping upload"
    fi
  fi

  # Retention: prune local backups older than RETENTION_DAYS
  if [ "${RETENTION_DAYS}" -gt 0 ] 2>/dev/null; then
    find "${BACKUP_DIR}" -name 'komenin-db-*.sql.gz*' -type f -mtime "+${RETENTION_DAYS}" -delete 2>/dev/null || true
    log "pruned local backups older than ${RETENTION_DAYS} days"
  fi
}

do_restore() {
  [ "${1:-}" ] || die "usage: $0 restore <backup-file>" 1
  require_tool gunzip "gunzip is required"
  local file="${1}"
  [ -f "${file}" ] || die "backup file not found: ${file}" 1
  [ -n "${DATABASE_URL:-}" ] || die "DATABASE_URL is not set"

  log "restoring ${file} → DATABASE_URL (this REPLACES existing data)"
  read -r -p "Type RESTORE to continue: " confirm
  [ "${confirm}" = "RESTORE" ] || die "aborted by user" 1

  if decrypt_stream < "${file}" | gunzip | psql "${DATABASE_URL}" --quiet --single-transaction; then
    log "restore complete"
  else
    die "restore pipeline failed"
  fi
}

case "${1:-backup}" in
  backup)  do_backup ;;
  restore) do_restore "${2:-}" ;;
  *) echo "usage: $0 [backup|restore <file>]"; exit 1 ;;
esac
