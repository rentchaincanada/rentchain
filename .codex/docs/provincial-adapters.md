# Provincial Adapters

## Purpose
Execution guide for agents implementing Identity Oracle provincial adapters after the core syntax/audit layer.

Primary spec:
- `docs/specs/provincial-adapter-standard-v1.md`

## Adapter Checklist
- use the standard adapter interface
- declare source key and source type explicitly
- use canonical namespace keys
- map only to approved verification statuses
- fail closed on source ambiguity
- write immutable audit runs
- update latest profile state by reference to the run id
- add health checks
- add schema drift guards
- add adapter tests before completion

## Current Core Assumptions
- Identity Oracle syntax normalization happens before external verification
- current internal execution route is `/api/internal/identity-oracle/run`
- Ontario core syntax uses `pin`
- Nova Scotia core syntax uses `pid`

## Status Taxonomy
- `SYNTAX_ONLY`
- `VERIFIED_MATCH`
- `PARTIAL_MATCH`
- `UNREGISTERED_RISK`
- `UNVERIFIED`
- `MANUAL_REVIEW_REQUIRED`
- `SOURCE_UNAVAILABLE`

## Source Taxonomy
- `OPEN_DATASET`
- `FEATURE_SERVICE`
- `PAID_GATEWAY`
- `MANUAL_DOCUMENT`
- `INTERNAL_OVERRIDE`

## Guardrails
- no public route widening
- no tenant portal coupling
- no application/lease/tenant status mutation
- no provider-specific semantics leaking into internal taxonomy
- no silent schema drift tolerance
