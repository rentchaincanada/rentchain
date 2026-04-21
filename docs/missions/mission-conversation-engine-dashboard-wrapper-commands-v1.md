MISSION: Conversation Engine Dashboard + Wrapper Commands v1

BRANCH:
feat/conversation-engine-dashboard-wrapper-commands-v1

## Objective
Build Conversation Engine Dashboard + Wrapper Commands v1 to reduce manual friction in the current conversation_engine workflow while preserving explicit operator control and reliable audit lineage.

This mission should improve the developer/operator experience around conversation_engine by adding:
- a terminal dashboard/status view
- lightweight wrapper commands for common mission steps
- automatic next-step guidance after each apply step
- a cleaner mission creation/start flow

The goal is to make the current multi-step process faster, less error-prone, and easier to follow without turning the system into a fully autonomous orchestrator.

## Required read order
1. AGENTS.md
2. PROCESS.md
3. codex.md
4. docs/execution/CURRENT_MISSION.md if present
5. Relevant mission examples in docs/missions/
6. Then inspect the code directly relevant to conversation_engine

## Context
The repo already has:
- tools/conversation_engine/v2.py
- run directories under .conversation_engine/runs/
- latest_audit.txt refresh support
- a multi-step workflow across:
  - start
  - codex audit
  - chatgpt review
  - codex implementation
  - finalize

The current workflow works, but it is too manual and too easy to misuse through:
- wrong run ids
- wrong flags
- skipped stages
- stale branch context
- extra command repetition

This mission must improve workflow UX without replacing the current conversation_engine state machine.

## In scope
- terminal status/dashboard command
- wrapper commands for common conversation_engine stages
- automatic next-step guidance
- mission creation helper
- clean shell-friendly command design
- targeted tests if appropriate
- additive implementation only

## Out of scope
- full autonomous workflow orchestration
- background job execution
- replacing conversation_engine core state logic
- web UI
- changing mission semantics or approval gates
- removing human review steps

## Required outcomes
- operator can see current run, mission, branch, stage, decision, and next step quickly
- operator can run simplified wrapper commands instead of remembering full raw commands
- wrappers can auto-generate the next prompt file after apply steps
- mission creation can produce parser-safe mission files
- latest_audit.txt remains part of the flow and stays trustworthy

## Suggested deliverables
- dashboard/status command
- new mission helper
- wrapper commands for:
  - start
  - codex audit apply
  - chatgpt review apply
  - codex implementation apply
  - finalize
- clear next-step output after each wrapper command

## Acceptance criteria
- a terminal dashboard/status view exists
- wrapper commands exist for common flow steps
- mission creation helper creates parser-safe mission files
- wrapper flow reduces manual command repetition
- no existing conversation_engine stages are bypassed
- latest_audit.txt behavior remains intact
- tests/builds pass
