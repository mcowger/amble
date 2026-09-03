#!/usr/bin/env bash
set -euo pipefail

TARGET=$(cd "${4:-${PASEO_WORKTREE_PATH:-$PWD}}" 2>/dev/null && pwd || echo "${4:-${PASEO_WORKTREE_PATH:-$PWD}}")
CHECKSUM=$(echo -n "$TARGET" | cksum | cut -d' ' -f1)
echo $(( 10000 + CHECKSUM % 50000 ))
