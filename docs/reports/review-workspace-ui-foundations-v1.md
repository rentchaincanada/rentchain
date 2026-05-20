# Review Workspace UI Foundations v1

## Executive Summary

Review Workspace UI Foundations v1 introduces the first read-only operator-facing presentation layer for governed review workspaces.

This phase is deliberately narrow. It surfaces deterministic review workspace readiness metadata inside the operational command center without creating workspaces, mutating workflows, broadening visibility, or introducing autonomous review behavior.

## UI Philosophy

Review workspace UI should help an operator understand:

- what review context would be used
- why the item is reviewable
- which source workflow and related resource are in scope
- whether evidence can be linked during manual review
- which status, priority, sensitivity, and visibility classes apply

The UI must not imply that financial truth, ledger records, tenant visibility, or source workflow state changes when review metadata is displayed.

## V1 Surface

V1 adds a read-only review workspace readiness panel to operational command center items.

The panel presents:

- workspace type
- review status
- review priority
- routing reason
- assignment label
- sensitivity class
- visibility class
- scoped evidence/source workflow link
- related operational resource label
- internal workspace reference label

The panel is a manual handoff preview only. It does not call review APIs, create review sessions, create review workspaces, route work automatically, or perform source workflow actions.

## Manual-Only Expectations

The UI explicitly communicates:

- manual-only review context
- no workspace creation from the panel
- no automatic routing
- no source record mutation

This preserves the existing operational vs financial separation and keeps review workspace foundations compatible with the manual handoff model.

## Evidence Linkage Direction

V1 links to the scoped source workflow as evidence context. It does not duplicate evidence payloads, raw provider data, message bodies, raw CSV values, payment credentials, or restricted exports into the UI model.

Future work can attach persisted evidence pack references after review workspace creation becomes a manual, reviewed action.

## Routing Compatibility

The UI model aligns with the operational review routing foundation:

- payment and delinquency signals map to payment ledger review
- screening signals map to screening review
- lease lifecycle and document signals map to document review
- occupancy signals map to operational anomaly review
- non-specialized operational signals map to evidence or operational review context

This is presentation compatibility only. V1 does not trigger routing execution.

## Non-Goals

This phase does not introduce:

- autonomous review actions
- automatic workspace creation
- tenant-visible review internals
- institutional collaboration
- cross-landlord review visibility
- financial mutations
- Firestore rule changes
- auth changes
- route changes

## Future Follow-Ups

Recommended next steps after review:

1. Add a manual, audited review workspace creation action when governance approves write behavior.
2. Add persisted review workspace list/detail routes with landlord/admin scoping.
3. Link persisted evidence pack references after workspace creation.
4. Add review workspace timeline integration using canonical event taxonomy.
5. Add assignment controls only after ownership and escalation semantics are reviewed.
