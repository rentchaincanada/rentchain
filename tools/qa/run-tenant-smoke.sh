#!/usr/bin/env bash
set -euo pipefail

export QA_ROLE="${QA_ROLE:-tenant}"
"$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/run-mobile-smoke.sh"
