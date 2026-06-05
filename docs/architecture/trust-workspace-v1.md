# Trust Workspace v1

## Purpose

Trust Workspace v1 is a backend service-layer read model for evidence trust chain management. It aggregates evidence record metadata, attestation lifecycle state, institutional export readiness, and cross-organization trust context into one deterministic projection.

The workspace is read-only. It does not add dashboard UI, HTTP routes, signing execution, delivery, institution callbacks, public trust profiles, background workers, or production data mutations.

## Components

- `trustWorkspaceTypes.ts` defines metadata-only workspace context, evidence chain summaries, attestation context, export readiness summaries, cross-organization context, and service result types.
- `deriveTrustWorkspace.ts` composes existing evidence records, attestation hash verification, institutional trust export policy evaluation, and cross-organization trust derivation.
- `trustWorkspaceProjections.ts` applies role-specific allowlist projections for landlord, tenant, admin, and support access.
- `trustWorkspaceEventEmission.ts` emits descriptor-only `TrustWorkspaceDerived` audit events through the existing export audit trail helper.
- `trust-workspace-service.ts` provides `getTrustWorkspaceForUser()` for future route or dashboard consumers.

## Data Model

The workspace summary contains:

- evidence summaries with safe evidence references, evidence class/type, resource type, status, metadata hash, provenance chain safe references, authority metadata, and attestation state
- attestation contexts with attestation safe references, signature/certificate references, hash verification status, and linked evidence references
- export readiness summaries with audience, purpose, policy gate status, blocked reason counts, and exportable/blocked attestation counts
- cross-organization context with trust relationship safe references, status, evidence/review/settlement trust state, restriction counts, and manual review flags

All workspace types are marked metadata-only, immutable, non-public, non-shareable, and payload-free.

## Access Control

Workspace access is projected by authenticated role:

- landlord: own landlord-scoped evidence, attestation metadata, export readiness, and visible cross-organization trust context
- tenant: own safe evidence references only; attestation, export readiness, and cross-organization context are excluded
- admin: metadata-only inspection across provided workspace inputs
- support: landlord-scoped metadata inspection with explicit support purpose tracking

Scope validation fails closed for invalid roles, missing landlord scope, missing tenant evidence scope, ambiguous context, or unauthorized evidence visibility.

## Safe References

Workspace outputs use deterministic safe references for evidence, landlord scope, tenant scope, export packages, trust relationships, requesters, and workspace IDs. Raw source identifiers, document identifiers, storage paths, support notes, provider source material, and private source data are excluded from projections.

## Audit Traceability

`TrustWorkspaceDerived` is a descriptor-only audit event. It records role, count summaries, derivation state, and metadata safety flags. The event is non-blocking: append failure does not fail workspace derivation.

## Deferred Work

Deferred follow-on work includes HTTP route handlers, dashboard UI, trust signoff flows, signing execution, recipient delivery, institution integrations, operational observability, and Cloud Run preview verification for user-facing consumers.

## Boundaries

Trust Workspace v1 does not perform signing, delivery, autonomous approval, external submission, public exposure, Firestore rule changes, deployment changes, billing changes, screening changes, or auth core changes.
