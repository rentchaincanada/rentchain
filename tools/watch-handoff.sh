#!/bin/bash
# watch-handoff.sh
# Watches for Codex to finish writing impl-summary.md
# then automatically triggers @qa-reviewer → @claude-gate2 chain in Claude Code CLI

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HANDOFF_DIR="$REPO_ROOT/.handoff"
TRIGGER_FILE="$HANDOFF_DIR/impl-summary.md"
SENTINEL="$HANDOFF_DIR/.impl-summary-processed"
LOG="$HANDOFF_DIR/.watch-handoff.log"
POLL_INTERVAL=3

echo "[watch-handoff] Started. Watching $TRIGGER_FILE" | tee -a "$LOG"

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

    if [ -z "$CONTENT" ] || [ "$CONTENT" = "# Ready for next mission" ]; then
      echo "$CONTENT_HASH" > "$SENTINEL"
      sleep "$POLL_INTERVAL"
      continue
    fi

    echo "[watch-handoff] $(date): impl-summary.md updated — triggering qa-reviewer..." | tee -a "$LOG"
    echo "$CONTENT_HASH" > "$SENTINEL"

    cd "$REPO_ROOT" && claude --print "@qa-reviewer review .handoff/impl-summary.md" 2>&1 | tee -a "$LOG"

    echo "[watch-handoff] $(date): qa-reviewer chain complete." | tee -a "$LOG"
  fi
  sleep "$POLL_INTERVAL"
done
