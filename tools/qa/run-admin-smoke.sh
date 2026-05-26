#!/usr/bin/env bash
set -euo pipefail

export QA_ROLE="${QA_ROLE:-admin}"
"$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/run-mobile-smoke.sh"
