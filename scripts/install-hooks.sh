#!/usr/bin/env bash
set -euo pipefail

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "[hooks] Not inside a git repository. Skipping hook installation."
  exit 0
fi

git config core.hooksPath .githooks
echo "[hooks] core.hooksPath set to .githooks"
