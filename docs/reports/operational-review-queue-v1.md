# Operational Review Queue v1

## Executive Summary

Operational Review Queue v1 adds the first manual, read-only queue layer for governed operational review coordination.

The queue is derived from already-visible operational command center signals. It does not create review workspaces, route work automatically, mutate source workflows, change financial records, broaden permissions, or expose tenant-visible review internals.

## Queue Philosophy

The queue helps an operator answer:

- what needs manual review
- why it is routed for review
- which review workspace type would apply during a future manual handoff
- which source workflow and related resource are in scope
- whether the item is assigned, critical, delinquency-related, upcoming, or informational

The queue is operational coordination only. It is not a workflow execution engine.

## V1 Surface

V1 surfaces a compact review intake queue inside `/operations`.

Each queue item presents:

- review title
- human-readable operational context
- workspace type
- review status
- review priority
- routing reason
- assignment state
- workflow status
- financial status when present
- sensitivity class
- scoped source workflow evidence link
- related resource label

Internal references remain implementation metadata and are not used as primary labels.

## Scope And Safety

Queue items are generated from the same landlord-scoped command center payloads already used by `/operations`.

V1 does not add:

- new routes
- new backend writes
- automatic review creation
- automatic routing
- automatic resolution
- financial mutations
- institutional sharing
- tenant-facing review internals
- cross-landlord visibility

Evidence and related-resource display remains reference-based. The queue does not duplicate evidence payloads, raw provider payloads, raw CSV data, payment credentials, unrestricted message bodies, debug payloads, tokens, secrets, or stack traces.

## Operational Command Center Compatibility

The queue derives from the filtered visible signal list. Existing `/operations` search, saved views, priority filters, and facet filters therefore continue to control queue visibility.

The queue preserves existing priority sorting by using the same deterministic operational prioritization helper.

## Future Follow-Ups

1. Add persisted review workspace list/detail routes after manual creation semantics are approved.
2. Add audited manual review workspace creation only after permission and event semantics are reviewed.
3. Add assignment/status controls after ownership governance is finalized.
4. Link persisted evidence pack references after workspace creation exists.
5. Add review workspace timeline integration using the canonical event taxonomy.
