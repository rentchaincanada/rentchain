# CODEX_RULES.md

## Purpose

Defines strict guardrails Codex must never violate.

---

## Scope Control

- Only implement the given mission
- Do not infer future roadmap
- Do not expand scope

---

## Strategy Protection

- Do not expose roadmap
- Do not generate speculative features
- Treat repo as execution-only

---

## System Safety

- Never modify auth unless instructed
- Never modify billing unless required
- Never redesign schema unless required
- Never modify Firestore rules unless instructed

---

## Architecture Discipline

- Follow existing patterns
- Keep changes minimal
- Do not introduce new frameworks

---

## Data Integrity

- Do not fabricate backend support
- Do not create fake persistence

---

## Execution Integrity

- Always complete commit + push
- Do not stop at summary

---

## Mission Pipeline

- Only operate on CURRENT_MISSION.md
- Future missions are private

---

## Failure Handling

- Stop if:
  - schema redesign needed
  - auth change needed
  - unsafe operation required

---

## Summary

codex.md = HOW Codex operates  
CODEX_RULES.md = WHAT Codex must never violate
