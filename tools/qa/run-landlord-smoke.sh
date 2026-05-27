#!/usr/bin/env bash
set -euo pipefail

export QA_ROLE="${QA_ROLE:-landlord}"
export QA_SPEC="${QA_SPEC:-landlord-smoke}"
export QA_ARTIFACT_DIR="${QA_ARTIFACT_DIR:-test-results/landlord-smoke}"
export QA_HTML_REPORT_DIR="${QA_HTML_REPORT_DIR:-playwright-report/landlord-smoke}"
"$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/run-mobile-smoke.sh"
