# AI Usage Statement

## Purpose

This statement defines how machine-assisted components are used in the platform in a compliance-safe manner.

## Current Position

- Core compliance and screening controls are deterministic and policy-driven.
- Machine-assisted outputs do not override authorization, consent, or legal workflow gates.
- Users remain responsible for final review and explicit send/approve actions.

## Boundaries

- No automated legal notice sending without explicit user action.
- No autonomous decisioning for protected workflows.
- No storage of provider secrets in client-side code.

## Review Commitments

- Maintain auditability for user-triggered actions.
- Keep explainability for workflow outcomes.
- Keep safe fallback behavior when machine-assisted features are unavailable.
