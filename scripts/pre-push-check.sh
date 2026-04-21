#!/usr/bin/env bash
set -euo pipefail

if [[ "${SKIP_PREPUSH:-false}" == "true" ]]; then
  echo "SKIP_PREPUSH=true -> pre-push checks skipped."
  exit 0
fi

npx prisma validate
npm run prebuild
npx eslint "{src,apps,libs,test}/**/*.ts"
npx prettier --check "src/**/*.ts" "test/**/*.ts"
npx nest build
npm run test -- --runInBand
