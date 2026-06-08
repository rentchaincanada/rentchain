#!/bin/bash
set -e
PR_NUMBER=$1
PR_URL=$2
BRANCH=$3
IMPL_SUMMARY=~/dev/rentchain/.handoff/impl-summary.md

if [ -z "$PR_NUMBER" ] || [ -z "$PR_URL" ] || [ -z "$BRANCH" ]; then
  echo "Usage: $0 <PR_NUMBER> <PR_URL> <BRANCH>"
  exit 1
fi

if [ ! -f "$IMPL_SUMMARY" ]; then
  touch "$IMPL_SUMMARY"
fi

CURRENT_PR=$(head -1 "$IMPL_SUMMARY" | grep -o '#[0-9]*' | head -1)
if [ "$CURRENT_PR" = "#${PR_NUMBER}" ]; then
  echo "✅ impl-summary.md already has correct PR #${PR_NUMBER} — no update needed"
  exit 0
fi

cat > /tmp/pr-header.md << HEADER
PR: #${PR_NUMBER}
PR URL: ${PR_URL}
Branch: ${BRANCH}

HEADER

FIRST_LINE=$(head -1 "$IMPL_SUMMARY")
if echo "$FIRST_LINE" | grep -qE "^PR: #[0-9]+"; then
  tail -n +5 "$IMPL_SUMMARY" > /tmp/impl-body.md
  cat /tmp/pr-header.md /tmp/impl-body.md > /tmp/impl-combined.md
else
  cat /tmp/pr-header.md "$IMPL_SUMMARY" > /tmp/impl-combined.md
fi

cp /tmp/impl-combined.md "$IMPL_SUMMARY"
echo "✅ impl-summary.md updated:"
head -4 "$IMPL_SUMMARY"
