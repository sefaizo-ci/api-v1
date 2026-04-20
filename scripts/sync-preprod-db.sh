#!/usr/bin/env bash
set -euo pipefail

# Sync preprod PostgreSQL data into local PostgreSQL database.
# Required env vars:
# - PREPROD_DATABASE_URL: source database URL
# - DATABASE_URL: destination local database URL
# Optional env vars:
# - DB_DUMP_DIR (default: backups)
# - DB_DUMP_FILE (default: preprod-YYYYmmdd-HHMMSS.dump)
# - DB_LOCAL_BACKUP_DIR (default: backups)
# - DB_LOCAL_BACKUP_FILE (default: local-before-sync-YYYYmmdd-HHMMSS.dump)
# - DB_SKIP_LOCAL_BACKUP=true to skip local backup
# - DB_SYNC_FORCE=true to skip confirmation prompt

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "Error: pg_dump is not installed."
  exit 1
fi

if ! command -v pg_restore >/dev/null 2>&1; then
  echo "Error: pg_restore is not installed."
  exit 1
fi

# Load local .env if present (without overriding already exported vars)
if [[ -f .env ]]; then
  set -a
  source .env
  set +a
fi

PREPROD_URL="${PREPROD_DATABASE_URL:-}"
LOCAL_URL="${DATABASE_URL:-}"

if [[ -z "$PREPROD_URL" ]]; then
  echo "Error: PREPROD_DATABASE_URL is not set."
  exit 1
fi

if [[ -z "$LOCAL_URL" ]]; then
  echo "Error: DATABASE_URL is not set."
  exit 1
fi

DUMP_DIR="${DB_DUMP_DIR:-backups}"
mkdir -p "$DUMP_DIR"

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
DUMP_FILE="${DB_DUMP_FILE:-$DUMP_DIR/preprod-$TIMESTAMP.dump}"
LOCAL_BACKUP_DIR="${DB_LOCAL_BACKUP_DIR:-backups}"
mkdir -p "$LOCAL_BACKUP_DIR"
LOCAL_BACKUP_FILE="${DB_LOCAL_BACKUP_FILE:-$LOCAL_BACKUP_DIR/local-before-sync-$TIMESTAMP.dump}"

if [[ "${DB_SYNC_FORCE:-false}" != "true" ]]; then
  echo "This will replace all data in local DB (DATABASE_URL)."
  echo "Dump source: PREPROD_DATABASE_URL"
  read -r -p "Continue? (yes/no): " answer
  if [[ "$answer" != "yes" ]]; then
    echo "Cancelled."
    exit 0
  fi
fi

echo "Creating dump from preprod..."
pg_dump "$PREPROD_URL" \
  --format=custom \
  --compress=9 \
  --file="$DUMP_FILE"

if [[ "${DB_SKIP_LOCAL_BACKUP:-false}" != "true" ]]; then
  echo "Creating local backup before restore..."
  pg_dump "$LOCAL_URL" \
    --format=custom \
    --compress=9 \
    --file="$LOCAL_BACKUP_FILE"
fi

echo "Restoring dump into local database..."
pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --dbname="$LOCAL_URL" \
  "$DUMP_FILE"

echo "Done."
echo "Dump file: $DUMP_FILE"
if [[ "${DB_SKIP_LOCAL_BACKUP:-false}" != "true" ]]; then
  echo "Local backup file: $LOCAL_BACKUP_FILE"
fi
