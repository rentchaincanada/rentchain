# Mission

MISSION: <Mission title>

Codex must follow the repository discovery and governance-resolution rules defined in `codex.md` before implementation begins. If `codex.md` is unavailable, Codex must discover and follow the nearest available governance/process documents and document assumptions.

# Branch

BRANCH:
<branch-name>

# Base

BASE:
Start from latest `origin/main`, unless this mission explicitly depends on another merged branch. If a dependency exists, name the exact merged branch or commit that must already be present on `origin/main` before implementation begins.

# Objective

OBJECTIVE:
<One-paragraph description of the product/engineering outcome.>

# Why This Matters

<Short explanation of why the mission exists now, what it unlocks next, and what execution risks should be avoided.>

# Strict Requirements

- Keep changes additive unless the mission explicitly authorizes replacement.
- Inspect the current system before implementing new files, config, semantics, or routes.
- Do not create a parallel system when an existing canonical layer already exists.
- Do not create alternate naming for the same concept across backend and frontend.
- Use one canonical set of keys, labels, and response semantics everywhere touched by the mission.
- Preserve existing security and authorization boundaries.
- Preserve existing user-visible behavior unless the mission explicitly changes it.

# Non-Goals

- <Explicit out-of-scope item>
- <Explicit out-of-scope item>
- <Explicit out-of-scope item>

# Primary Files / File Families To Inspect First

- <backend canonical config file>
- <backend route or middleware file>
- <frontend canonical config file>
- <frontend page/component family>
- <tests covering the touched area>

# Pre-Implementation Audit

Before editing, inspect and summarize:

1. Current canonical keys, labels, and response shapes in the touched area.
2. Existing route, middleware, helper, and frontend extension points.
3. Duplicate or overlapping systems already present.
4. Naming inconsistencies that must be normalized by extension rather than by shadow config.
5. Existing upgrade / locked-state / error semantics if gating is involved.

Implementation rule:
- Extend and normalize the current source-of-truth files when possible.
- Do not replace working canonical layers with a second config stack.

# Implementation Tasks

1. <Task>
2. <Task>
3. <Task>

# API Surfaces

- <route or API surface>
- <route or API surface>
- <response shape / request shape expectations>

# Frontend Integration Targets

- <page or component>
- <page or component>
- <routing / navigation expectations>

# Tests Required

Backend:
- <test file or category>

Frontend:
- <test file or category>

Verification:
- run the minimal relevant test/build commands for touched backend/frontend areas
- confirm acceptance criteria
- confirm no unrelated behavior changed

# Manual QA

1. <manual check>
2. <manual check>
3. <manual check>

# Acceptance Criteria

- <criterion>
- <criterion>
- <criterion>

# Deliverable Summary

- <deliverable>
- <deliverable>
- <deliverable>

# Commit

COMMIT:
<commit message>
