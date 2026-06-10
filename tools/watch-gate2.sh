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
    if [ ! -f "$SENTINEL" ] || [ "$TRIGGER_FILE" -nt "$SENTINEL" ]; then
      CONTENT=$(cat "$TRIGGER_FILE" 2>/dev/null || echo "")

      if [ -z "$CONTENT" ]; then
        sleep "$POLL_INTERVAL"
        continue
      fi

      if echo "$CONTENT" | grep -q "BLOCKED"; then
        echo "[watch-gate2] $(date): Gate 2 BLOCKED — human review required." | tee -a "$LOG"
        osascript -e 'display notification "Gate 2 BLOCKED — human review required." with title "RentChain Cycle"'
        touch "$SENTINEL"
        sleep "$POLL_INTERVAL"
        continue
      fi

      if ! echo "$CONTENT" | grep -q "SAFE TO MERGE"; then
        sleep "$POLL_INTERVAL"
        continue
      fi

      echo "[watch-gate2] $(date): Gate 2 SAFE TO MERGE — triggering Claude Code merge..." | tee -a "$LOG"
      touch "$SENTINEL"
      osascript -e 'display notification "Gate 2 approved. Executing merge..." with title "RentChain Cycle"'

      cd "$REPO_ROOT" && claude --print "Read .handoff/RULES.md then execute the full merge sequence in .handoff/gate2-instruction.md. Operator authorization confirmed. Execute all git operations." 2>&1 | tee -a "$LOG"

      echo "[watch-gate2] $(date): Merge sequence complete." | tee -a "$LOG"
      osascript -e 'display notification "Merge complete. Review merge-log.md." with title "RentChain Cycle"'
    fi
  fi
  sleep "$POLL_INTERVAL"
done
