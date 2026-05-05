# PROCESS.md

## Mandatory Workflow
Every mission must follow this loop:

1. Explore
2. Plan
3. Implement
4. Verify

Do not skip steps.

Mission execution follows the Mission Promotion Pipeline: only the active mission is executed; future roadmap remains private.

## Repository Discovery

All missions inherit the repository discovery and governance-resolution rules from `codex.md` when `codex.md` exists.

Mission prompts should not repeat generic repository bootstrap instructions unless the mission has specialized audit requirements.

If `codex.md` is absent, Codex should follow the nearest available process/governance document and document assumptions.

---

## 1. Explore
Before editing:
- inspect relevant files
- inspect existing patterns
- identify touched routes, services, schemas, and tests
- identify dependencies and constraints from `codex.md` and mission specs
- inspect relevant `.codex/docs/*` file only if needed for that domain

Output expected in summary:
- files reviewed
- existing pattern identified
- risks/dependencies found

---

## 2. Plan
Before coding:
- define the exact files to change
- define the route/schema/data/test approach
- define what is explicitly out of scope
- confirm how acceptance criteria will be verified

Output expected in summary:
- implementation plan
- file list
- test/build plan
- known risks

---

## 3. Implement
During coding:
- keep changes scoped to the mission
- preserve repo conventions
- avoid unrelated refactors
- prefer deterministic logic
- preserve security boundaries
- add/update tests with code changes

Rules:
- no hidden scope expansion
- no “while I’m here” changes
- no placeholder-only implementation
- no broad renames or restructures unless mission explicitly requires them

---

## 4. Verify
Before completion:
- run relevant tests
- run relevant build commands
- confirm acceptance criteria
- confirm no unrelated files changed
- summarize known limitations honestly

Output expected in summary:
- commands run
- results
- files changed
- limitations
- next recommended mission

---

## Completion Standard
A mission is complete only when:
- implementation matches scope
- acceptance criteria are satisfied
- verification was actually performed
- remaining issues are disclosed honestly

## Failure Standard
If verification cannot be completed:
- say so clearly
- explain what blocked it
- do not claim completion

Merge-gate must only fail on actual failed required checks, not on pending checks.
Merge safety depends on the real required PR delivery checks; `merge-gate` remains supplemental.
