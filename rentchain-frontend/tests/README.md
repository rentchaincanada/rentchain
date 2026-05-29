# Frontend Test Layout

This directory contains frontend tests outside `src/`.

## Structure

- `smoke/` contains isolated Vitest checks for storage-state contracts and navigation route mapping.
- `playwright/` contains browser-driven page and role smoke specifications.

## Naming

- Vitest files use `*.test.ts`.
- Playwright browser files use `*.spec.ts`.
- Shared browser helpers stay beside the specs that consume them.

## Boundaries

Frontend tests must use environment-provided URLs and storage state. Do not hardcode credentials, tokens, or production-only state in test files.
