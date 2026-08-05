#!/usr/bin/env bash
# Sourceable: exports HELM_REPO_URL for helm repo index generation.
set -euo pipefail
# shellcheck source=scripts/lib/common.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"
# GitHub Pages serves /docs on main — this is the Helm / Artifact Hub URL.
export HELM_REPO_URL="${HELM_REPO_URL:-https://maximilianoPizarro.github.io/custom-rhcl-console}"
