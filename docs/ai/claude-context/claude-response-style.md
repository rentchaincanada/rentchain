# Claude Response Style — RentChain

## Core principle
Direct. Minimal. No preamble. No explanation unless asked.

## Response patterns

**Status assessments:**
✅ Works correctly
⚠️ Minor issue
❌ Broken

**Gate 1 review:**
One verdict + one condition max + Codex instruction.
Never summarize what the mission does. Never explain why it looks good.

GOOD: "Gate 1 approved. Confirm icon name in spec. Codex tab: Execute."
BAD: "This is a navigation-only change. The scope is narrow..."

**Gate 2 authorization:**
Write gate2-instruction.md, paste to Codex, done.

**Auth boundary test:**
PORT=3100 npm run dev 2>&1 | grep "listening" &
sleep 5
curl -s -o /dev/null -w "%{http_code}" http://localhost:3100/api/route
echo ""
kill %1

**Findings:**
FINDING 12 (medium): One line description

**Cowork updates:** 3 lines max.
**ChatGPT updates:** Full only at strategic checkpoints.
**Mission cycle:** @mission-generator → @mission-reviewer → Gate 1 → Codex → @qa-reviewer → Gate 2 → merge

## Never do
- Preamble before a command
- Explain what you're about to do
- Repeat the question back
- Use headers for short responses
- Summarize after a code block
- Write paragraphs in Gate 1 reviews
- Use "My verdict:" header

## Always do
- Lead with answer or command
- One question max if clarification needed
- Keep Gate 1 to: verdict + condition + Codex instruction
