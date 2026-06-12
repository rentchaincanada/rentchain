#!/bin/bash
REPO_ROOT="/Users/rentchain/dev/rentchain"
LOG="$REPO_ROOT/.handoff/.hook.log"

# Read file path from stdin JSON
STDIN_DATA=$(cat /dev/stdin 2>/dev/null)
FILE=$(echo "$STDIN_DATA" | grep -o '"file_path":"[^"]*"' | cut -d'"' -f4)

echo "[hook] $(date): fired — $FILE" >> "$LOG"

if [ -z "$FILE" ]; then
  echo "[hook] $(date): no file path detected — skipping" >> "$LOG"
  exit 0
fi

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
    PR_LINE=$(head -1 "$FILE" 2>/dev/null || echo "")
    if [ -n "$CONTENT" ] && [ "$CONTENT" != "# Ready for next mission" ] && echo "$PR_LINE" | grep -q "^PR: #"; then
      echo "[hook] $(date): impl-summary.md with PR — firing @qa-reviewer" >> "$LOG"
      cd "$REPO_ROOT" && claude --print "@qa-reviewer review .handoff/impl-summary.md" >> "$LOG" 2>&1 &
    fi
    ;;
  *".handoff/gate2-instruction.md")
    CONTENT=$(cat "$FILE" 2>/dev/null || echo "")
    if echo "$CONTENT" | grep -qi "proceed with merge\|SAFE TO MERGE"; then
      echo "[hook] $(date): gate2-instruction.md — sending notification" >> "$LOG"
      osascript -e 'display notification "Gate 2 approved. Open Codex to merge." with title "RentChain Cycle"' &
    fi
    ;;
  *)
    ;;
esac
