#!/bin/bash
# PostToolUse hook — fires after every Claude Code Write tool call
# Routes to next cycle step based on file written

FILE="$1"
REPO_ROOT="/Users/rentchain/dev/rentchain"
LOG="$REPO_ROOT/.handoff/.hook.log"

echo "[hook] $(date): Write detected — $FILE" >> "$LOG"

case "$FILE" in
  *".handoff/mission-review.md")
    CONTENT=$(cat "$FILE" 2>/dev/null || echo "")
    if echo "$CONTENT" | grep -q "READY FOR GATE 1"; then
      echo "[hook] $(date): mission-review.md READY FOR GATE 1 — firing @claude-gate1" >> "$LOG"
      cd "$REPO_ROOT" && claude --print "@claude-gate1" >> "$LOG" 2>&1 &
    fi
    ;;
  *".handoff/impl-summary.md")
    CONTENT=$(cat "$FILE" 2>/dev/null || echo "")
    if [ -n "$CONTENT" ] && [ "$CONTENT" != "# Ready for next mission" ]; then
      PR_LINE=$(head -1 "$FILE")
      if echo "$PR_LINE" | grep -q "^PR: #"; then
        echo "[hook] $(date): impl-summary.md written with PR — firing @qa-reviewer" >> "$LOG"
        cd "$REPO_ROOT" && claude --print "@qa-reviewer review .handoff/impl-summary.md" >> "$LOG" 2>&1 &
      fi
    fi
    ;;
  *".handoff/gate2-instruction.md")
    CONTENT=$(cat "$FILE" 2>/dev/null || echo "")
    if echo "$CONTENT" | grep -qi "proceed with merge\|SAFE TO MERGE"; then
      echo "[hook] $(date): gate2-instruction.md written — sending notification" >> "$LOG"
      osascript -e 'display notification "Gate 2 approved. Open Codex to merge." with title "RentChain Cycle"' &
    fi
    ;;
  *)
    ;;
esac
