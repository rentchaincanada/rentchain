---
name: append-agent-file
description: "Use when appending rules, triggers, or instructions to any .claude/agents/*.md file in RentChain. Always use cat >> EOF terminal commands, never Codex instructions, to prevent overwrites."
---

Always use terminal cat >> EOF to append to agent files.
Never use Codex to edit .claude/agents/ files — Codex may overwrite changes during branch commits.
After appending, always verify with tail -5 and immediately commit to main.

Pattern:
cat >> ~/dev/rentchain/.claude/agents/AGENTNAME.md << 'EOF'

content to append

EOF

Verify:
tail -5 ~/dev/rentchain/.claude/agents/AGENTNAME.md

Commit immediately:
cd ~/dev/rentchain && git add .claude/agents/AGENTNAME.md && git commit -m "chore: update workflow rules DESCRIPTION" && git push origin main
