#!/usr/bin/env bash
set -euo pipefail

if [[ "${SKIP_PREPUSH:-false}" == "true" ]]; then
  echo "SKIP_PREPUSH=true -> pre-push checks skipped."
  exit 0
fi

echo "[pre-push] Running Prisma validate..."
npx prisma validate

echo "[pre-push] Running ESLint (no fix)..."
npx eslint "{src,apps,libs,test}/**/*.ts"

echo "[pre-push] Running Prettier check..."
npx prettier --check "src/**/*.ts" "test/**/*.ts"

echo "[pre-push] Running build..."
npm run build

echo "[pre-push] Running unit tests..."
npm run test -- --runInBand

echo "[pre-push] All checks passed."
