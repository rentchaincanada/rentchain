# RentChain Agent Governance Blueprint v1

## 1. Purpose
Agent governance exists to keep agent-assisted development useful without allowing prompt-driven work to bypass normal engineering controls.

This blueprint protects the founder, product, customers, and investors by limiting agent scope, preserving human review, and ensuring every material change leaves evidence that can be audited later.

## 2. Core Principles
- Deny by default: agents only work inside explicitly allowed scope.
- Sandbox first: constrained execution is the normal mode and escalation is exceptional.
- Branch and PR required: changes flow through Git branches, review, and merge discipline.
- No prompt to production: agents do not deploy directly from an instruction.
- Explicit authorization override rule: work outside the standing scope requires a written override block.

## 3. Governance Layers
### Policy Layer
Defines allowed files, denied files, command restrictions, network posture, and task limits.

### Sandbox Layer
Enforces filesystem and execution boundaries so the policy is not purely advisory.

### Workflow Layer
Requires branch-based development, testing, summaries, and PR review before merge.

### Approval Layer
Classifies work as green, yellow, or red so high-risk areas receive stronger human control.

### Evidence Layer
Captures task manifests, commands run, tests run, changed files, risks, and rollback notes for auditability.

## 4. Task Lifecycle
1. Authorization: confirm standing scope or require an override block.
2. Planning: identify the policy, branch, files, and success criteria.
3. Execution: make only scoped changes under sandbox-first controls.
4. Testing: run the smallest meaningful validation for the task.
5. PR: prepare an auditable summary with changed files and risks.
6. Approval: apply the review matrix and protected-area rules.
7. Merge: merge only after the required review gates pass.

## 5. Permanent Rule
**Any task requiring override of AGENTS.md must begin with an AUTHORIZATION OVERRIDE block.**

The override must define task scope, allowed paths, forbidden paths, and any special git permissions for that one task only.

## 6. Approval Matrix
### Green
Low-risk work in clearly allowed areas with additive or non-destructive changes. These tasks can proceed to PR with standard review.

### Yellow
Moderate-risk work such as backend logic changes, customer-facing behavior changes, or wider-scope edits. Founder or designated reviewer approval is required before merge.

### Red
High-risk work involving auth, billing, infra, secrets, CI/CD, production data migrations, or destructive operations. Explicit approval is required before implementation begins.

## 7. Future Extensibility
This blueprint is intentionally lightweight, but it supports later additions such as:
- an internal agent runner that enforces policy manifests automatically
- machine-readable audit logs for every run
- stronger sandbox execution and approval workflows
- policy-aware PR generation and review gates
