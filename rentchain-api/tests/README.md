# API Test Layout

This directory contains API test support outside the source tree.

## Structure

- `smoke/` contains isolated Vitest smoke checks for authenticated API behavior.
- `fixtures/` contains ephemeral in-memory test state builders.
- `utils/` contains shared smoke assertion and request helpers.
- `playwright/` is reserved for browser-driven API workflow checks used by later QA missions.

## Naming

- Vitest files use `*.test.ts`.
- Browser workflow files use `*.spec.ts`.
- Fixture data must use test-prefixed values and must not depend on production state.

## Boundaries

Tests in this directory must preserve server-side authorization, role separation, projection-safe response shapes, and append-only audit expectations.
