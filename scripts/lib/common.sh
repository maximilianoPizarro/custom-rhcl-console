#!/usr/bin/env bash
# Shared helpers for CI scripts. Sets ROOT to the repository root.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export ROOT

die() {
  echo "ERROR: $*" >&2
  exit 1
}
