#!/usr/bin/env bash
set -euo pipefail

export QA_ROLE="${QA_ROLE:-admin}"
export QA_SPEC="${QA_SPEC:-admin-smoke}"
export QA_ARTIFACT_DIR="${QA_ARTIFACT_DIR:-test-results/admin-smoke}"
export QA_HTML_REPORT_DIR="${QA_HTML_REPORT_DIR:-playwright-report/admin-smoke}"
"$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/run-mobile-smoke.sh"
