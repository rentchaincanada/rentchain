#!/bin/bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HANDOFF_DIR="$REPO_ROOT/.handoff"
TRIGGER_FILE="$HANDOFF_DIR/gate2-instruction.md"
SENTINEL="$HANDOFF_DIR/.gate2-processed"
LOG="$HANDOFF_DIR/.watch-gate2.log"
POLL_INTERVAL=3

echo "[watch-gate2] Started. Watching $TRIGGER_FILE" | tee -a "$LOG"

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

    if [ -z "$CONTENT" ]; then
      echo "$CONTENT_HASH" > "$SENTINEL"
      sleep "$POLL_INTERVAL"
      continue
    fi

    if echo "$CONTENT" | grep -q "BLOCKED"; then
      echo "[watch-gate2] $(date): Gate 2 BLOCKED — human review required." | tee -a "$LOG"
      osascript -e 'display notification "Gate 2 BLOCKED — human review required." with title "RentChain Cycle"'
      echo "$CONTENT_HASH" > "$SENTINEL"
      sleep "$POLL_INTERVAL"
      continue
    fi

    if echo "$CONTENT" | grep -q "SAFE TO MERGE"; then
      echo "[watch-gate2] $(date): Gate 2 SAFE TO MERGE — notification sent. Human must execute merge." | tee -a "$LOG"
      echo "$CONTENT_HASH" > "$SENTINEL"
      osascript -e 'display notification "Gate 2 approved. Human must open Codex and execute merge from gate2-instruction.md." with title "RentChain Cycle"'
    else
      echo "$CONTENT_HASH" > "$SENTINEL"
    fi
  fi
  sleep "$POLL_INTERVAL"
done
