# Tenant-Safe Projection Contract v1

## Executive Summary

This report defines the first tenant-safe projection contract for RentChain tenant-facing workspace data. The contract makes tenant projections explicit, whitelist-oriented, scoped to the authenticated tenant relationship, and aligned with the sensitivity and projection governance registries.

This mission does not change tenant access, route visibility, Firestore schema, Firestore rules, or tenant workspace behavior. It introduces a narrow projection contract and applies it to the current tenant lease projection surface.

## Contract Scope

Tenant-safe projection v1 applies first to the current lease projection used by tenant workspace and tenant portal lease surfaces.

Contract identity:

- Projection name: `tenant_safe_workspace_projection`
- Projection version: `tenant_safe_projection_v1`
- Audience: tenant workspace
- Scope type: tenant current lease
- Sensitivity class: sensitive
- Authority basis: authenticated tenant scope
- Relationship basis: authenticated tenant current lease relationship

## Contract Fields

The tenant-safe projection contract documents:

- `projectionName`
- `projectionVersion`
- `audience`
- `scopeType`
- `allowedSourceCollections`
- `allowedFieldGroups`
- `excludedFieldGroups`
- `sensitivityClass`
- `authorityBasis`
- `relationshipBasis`
- `internalReferencePolicy`
- `redactionPolicy`

Tenant lease projections also expose deterministic metadata:

- `projectionProfile`
- `projectionVersion`
- `sensitivityClass`
- `sourceCollections`
- `sourceRefs`
- `redactionSummary`

## Allowed Field Groups

The v1 contract allows only tenant-facing lease workspace groups:

- tenant visible lease summary
- tenant visible document status
- tenant signature status
- payment readiness summary
- scoped source references
- operational labels

## Excluded Field Groups

The v1 contract explicitly excludes:

- landlord-only notes
- other-tenant records
- raw provider payloads
- raw screening reports
- raw CSV values
- payment account details
- debug payloads
- route-source metadata
- stack traces
- private message bodies

## Source Lineage

The tenant lease projection includes source lineage metadata for traceability:

- `sourceCollections`
- `sourceRefs`

These fields are internal metadata references for diagnostics and lineage. They are not primary tenant-facing display labels and should not replace operational labels in UI copy.

## What This Guarantees

Tenant-safe projection contract v1 guarantees:

- tenant current lease projections are explicitly versioned
- projection metadata is deterministic
- source collection lineage is visible to the server/client contract
- restricted field groups are documented and tested
- tenant lease shaping remains whitelist-based
- raw/provider/payment/debug/private-message fields are excluded from the covered surface

## What This Does Not Guarantee Yet

This contract does not yet cover every tenant-facing route. Remaining tenant surfaces should be migrated incrementally.

Not yet covered by a contract:

- tenant message metadata projections
- tenant notification/readiness projections
- tenant maintenance workspace projections
- tenant trust export package profiles
- tenant document package projections beyond current lease metadata

## Relationship To Evidence And Exports

Tenant-safe projection contracts complement:

- evidence pack projection profiles
- institutional export allowlist profiles
- Firestore sensitivity and projection registry
- Firestore collection ownership registry

Tenant projections should remain narrower than landlord operational, evidence, and institutional export projections. Tenant-safe payloads must be scoped by authenticated tenant authority and relationship lineage.

## Future Follow-Ups

Recommended follow-up missions:

1. `fix/tenant-message-metadata-projection-contract-v1`
2. `fix/tenant-maintenance-projection-contract-v1`
3. `fix/tenant-trust-export-profile-v1`
4. `test/tenant-projection-route-contracts-v1`

## DO NOT IGNORE

- Tenant-facing projections must remain whitelist-based.
- Internal IDs may be retained as scoped metadata only, not primary labels.
- Raw provider, screening, payment credential, CSV, debug, stack, and private message-body fields must not be exposed through tenant workspace projections.
- Tenant projection expansion should be reviewed against authority context and relationship continuity tests before implementation.
