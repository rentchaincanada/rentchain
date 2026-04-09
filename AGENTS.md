# AGENTS.md

## Purpose
Repo-wide operating rules for AI coding agents working in RentChain.

## Required Read Order
Before making any change, read in this order:
1. `codex.md`
2. `PROCESS.md`
3. current mission spec in `docs/specs/` if present
4. relevant `.codex/docs/*` file only when specifically needed for that domain

## Scope Discipline
- Only work inside the scope of the active mission
- Do not change unrelated files
- Do not bundle adjacent refactors into the same mission
- If new work is discovered outside scope, report it and stop

## Core Architecture Rules
- Use canonical internal IDs for product logic
- External identifiers are attributes, not primary keys
- Use Firestore, not SQL
- Use existing Express route and service patterns
- Prefer deterministic logic and pure helper functions
- Tenant-facing data must use whitelist projections, never field stripping
- Authority-sensitive access must resolve server-side, never from client assumptions

## Protected Areas
Do not edit these unless the mission explicitly requires it:
- billing flows
- auth core
- screening provider adapters
- CI/CD and deployment configuration
- `firestore.rules`
- Terraform infrastructure
- public marketing content unrelated to the mission

## Security Rules
- Do not widen public access to internal routes
- Do not store unrelated PII in new collections or logs
- Do not log raw sensitive payloads
- Fail closed on ambiguous authorization
- Preserve audit integrity for immutable logs

## Workflow Rule
Follow `PROCESS.md` exactly:
- Explore
- Plan
- Implement
- Verify

Do not skip directly to implementation.

## Validation Rule
Before declaring completion:
- run the required build/test commands for the touched area
- confirm acceptance criteria
- summarize changed files
- list known limitations honestly

## Stop Conditions
Stop and report instead of proceeding when:
- the requested work conflicts with mission scope
- a required dependency or file is missing
- the change would require risky refactors outside scope
- production/security uncertainty cannot be resolved safely inside the mission
