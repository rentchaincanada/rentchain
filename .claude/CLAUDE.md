
## Governance Cycle — How It Works

Three-layer trigger system for mission automation:

LAYER 1 — PostToolUse Hook (primary, fires on Claude Code Write calls only)
Config: .claude/settings.json
Script: tools/on-handoff-write.sh
Routes:
- mission-current.md written → fires @mission-reviewer
- mission-review.md written + READY FOR GATE 1 → fires @claude-gate1
- impl-summary.md written + PR on line 1 → fires @qa-reviewer
- gate2-instruction.md written + SAFE TO MERGE → sends macOS notification

LAYER 2 — Watcher Scripts (fallback, fires on any process write including Codex)
Scripts: tools/watch-mission-review.sh, tools/watch-handoff.sh, tools/watch-gate2.sh
Start: bash tools/start-cycle-watchers.sh
Uses md5 content hash sentinels to avoid duplicate triggers.

LAYER 3 — Manual triggers (last resort)
@mission-reviewer review .handoff/mission-current.md
@claude-gate1
@qa-reviewer review .handoff/impl-summary.md
@claude-gate2

## Known Failure Modes

- Hook does NOT fire on Codex writes (Codex is a separate process)
- Watchers handle Codex-written files
- impl-summary.md must have PR: #XXXX on line 1 exactly
- gate2-instruction.md stale PR number = qa-reviewer read wrong impl-summary.md
- mission-review.md not written = mission-reviewer outputting to chat instead of using Write tool
- qa-reviewer asking permission to write gate2-instruction.md = permission directive needed

## Two Human Steps (Governance Boundaries — Never Automate)
Step 5: Open Codex → Execute the mission in .handoff/mission-current.md
Step 8: Open Codex → Read .handoff/RULES.md then execute the full merge sequence in .handoff/gate2-instruction.md

## Debugging Commands
tail -f .handoff/.hook.log
tail -f .handoff/.watch-handoff.log
tail -f .handoff/.watch-mission-review.log
tail -f .handoff/.watch-gate2.log
cat .handoff/.watcher-pids
ls -la .handoff/impl-summary.md .handoff/mission-review.md .handoff/gate2-instruction.md

## Session Start — Always Read First

Before taking any action in this repo, read:
1. .handoff/RULES.md
2. .handoff/merge-log.md (last 50 lines for current queue)

Current mission queue is always in merge-log.md under "Next Mission" or "Revised Priority Queue".

## Active Agents
.claude/agents/mission-generator.md
.claude/agents/mission-reviewer.md
.claude/agents/claude-gate1.md
.claude/agents/qa-reviewer.md
.claude/agents/claude-gate2.md

## impl-summary.md Contract
Line 1 must be exactly: PR: #XXXX
Line 2 must be exactly: PR URL: https://github.com/rentchaincanada/rentchain/pull/XXXX
Line 3 must be exactly: Branch: branch-name
No headers or blank lines before these three lines.
Codex must update these lines immediately after opening a PR.

## gate2-instruction.md Contract
Always overwrite — never append.
qa-reviewer writes this file on every SAFE TO MERGE verdict.
Contains the authorized Codex merge sequence.
