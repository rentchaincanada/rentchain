# Current Codex Mission

This file defines the only mission Codex should execute at a given time.

## Mission Title

<Replace with active mission title>

## Branch

<Replace with active branch name>

## Status

- `pending`
- `in_progress`
- `blocked`
- `ready_for_review`
- `complete`

## Objective

<One-paragraph summary of the intended outcome>

## Non-Goals

- <out-of-scope item>
- <out-of-scope item>
- <out-of-scope item>

## Source-of-Truth Files

- <canonical backend file>
- <canonical frontend file>
- <route / API surface>
- <tests to protect behavior>

## Blockers

- <blocker or `none`>

## Latest Decisions

- <decision>
- <decision>

## QA Focus

- <highest-risk behavior to verify>
- <highest-risk behavior to verify>

## Next Operator Instructions

1. Read `codex.md`.
2. Read `PROCESS.md`.
3. Read this file and the active mission file before editing.
4. Inspect the listed source-of-truth files before implementation.
5. Extend existing systems; do not create a parallel stack unless the mission explicitly requires it.

## Rules

- Only one active mission at a time.
- Codex must not infer future roadmap.
- Codex must not expand scope.
- Future roadmap is private.
