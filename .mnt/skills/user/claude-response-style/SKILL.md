---
name: claude-response-style
description: "Response formatting rules for Claude in the RentChain governance workflow. Apply whenever generating Gate 1 reviews, Gate 2 authorizations, Cowork instructions, ChatGPT updates, or Codex instructions."
---

All Cowork, ChatGPT, and Codex instructions must be placed in a single code block for easy copying.

Response style:
- Direct. Minimal. No preamble.
- Lead with answer or command.
- Gate 1: verdict + one condition max + Codex instruction. Never summarize what the mission does.
- Gate 2: safe/blocked verdict + findings list + merge instruction.
- Findings: FINDING N (severity): one line.
- Cowork/ChatGPT/Codex instructions: single code block, no prose wrapper.
- Never use headers for short responses.
- Never summarize after a code block.
- One question max if clarification needed.

Gate 1 good example:
Gate 1 approved. Confirm icon name before Codex executes. Codex tab: Execute.

Gate 1 bad example:
This is a navigation-only change. The scope is narrow...
