# Canonical Audit Events v1

## Purpose

Phase 2 canonical audit events provide append-safe evidence for supervised review workspace and recovery operations. They are metadata-only records written to the existing `canonicalEvents` collection with a typed event envelope, immutable document IDs, and safe references replacing raw actor, workflow, landlord, tenant, and data-store identifiers.

## Event Types

- `recovery_intent_captured`
- `recovery_gate_validated`
- `review_state_transitioned`
- `operator_review_opened`
- `operator_review_note_added`
- `operator_review_outcome_recorded`
- `operator_review_session_closed`

## Required Envelope

Each event includes:

- `eventId`
- `eventType`
- `timestamp`
- `actor`
- `authority`
- `sourceReferenceId`
- `metadata`
- `metadataOnly: true`
- `appendOnly: true`
- `immutable: true`
- `rawIdsIncluded: false`

## Append Semantics

The canonical audit append helper writes with document creation semantics when Firestore supports `create()`. Existing event documents are not overwritten. This preserves immutable operational history while keeping audit append failures non-blocking for recovery intent and gate validation flows.

## Projection Safety

Audit metadata must not include raw Firestore IDs, tenant IDs, landlord IDs, tokens, provider payloads, storage paths, or credentials. Actor, authority, and source references are deterministic safe references. Operator review notes and summaries reuse existing sanitization before audit emission.

## Current Limitations

This foundation does not add audit retrieval APIs, audit dashboards, export generation, compliance report generation, real-time subscriptions, replay, or enforcement policy evaluation. State transition audit events are emitted beside existing provenance capture when transition evidence capture is requested.
