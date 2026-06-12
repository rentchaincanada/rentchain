#!/bin/bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HANDOFF_DIR="$REPO_ROOT/.handoff"
TRIGGER_FILE="$HANDOFF_DIR/mission-review.md"
SENTINEL="$HANDOFF_DIR/.mission-review-processed"
LOG="$HANDOFF_DIR/.watch-mission-review.log"
POLL_INTERVAL=3

echo "[watch-mission-review] Started. Watching $TRIGGER_FILE" | tee -a "$LOG"

while true; do
  if [ -f "$TRIGGER_FILE" ]; then
    CONTENT=$(cat "$TRIGGER_FILE" 2>/dev/null || echo "")
    CONTENT_HASH=$(echo "$CONTENT" | md5)
    SENTINEL_HASH=""
    if [ -f "$SENTINEL" ]; then
      SENTINEL_HASH=$(cat "$SENTINEL" 2>/dev/null || echo "")
    fi

    if [ "$CONTENT_HASH" = "$SENTINEL_HASH" ]; then
      sleep "$POLL_INTERVAL"
      continue
    fi

    if ! echo "$CONTENT" | grep -q "READY FOR GATE 1"; then
      echo "[watch-mission-review] $(date): Not READY FOR GATE 1 — skipping." | tee -a "$LOG"
      echo "$CONTENT_HASH" > "$SENTINEL"
      sleep "$POLL_INTERVAL"
      continue
    fi

    echo "[watch-mission-review] $(date): READY FOR GATE 1 — triggering claude-gate1..." | tee -a "$LOG"
    echo "$CONTENT_HASH" > "$SENTINEL"
    osascript -e 'display notification "Mission ready for Gate 1 review." with title "RentChain Cycle"'

    cd "$REPO_ROOT" && claude --print "@claude-gate1" 2>&1 | tee -a "$LOG"

    echo "[watch-mission-review] $(date): claude-gate1 complete." | tee -a "$LOG"
  fi
  sleep "$POLL_INTERVAL"
done
