# Database Deep Dive

## Purpose
Reference for Firestore collections, document shapes, relationship rules, and security logic.

## Core Rules
- All product logic uses canonical internal IDs
- External identifiers are stored as attributes, never as primary keys
- No duplicated source-of-truth records across landlord and tenant surfaces
- Sensitive data must be minimized and scoped

## Key Collections

### properties
- `rc_prop_id`
- landlord linkage
- address
- province
- municipality
- unit references
- compliance module reference

### units
- `unit_id`
- `rc_prop_id`
- occupancy or availability status
- rent amount
- bedroom and bathroom metadata

### applications
- `application_id`
- `rc_prop_id`
- applicant linkage
- application status
- document references
- screening summary references

### leases
- `lease_id`
- `rc_prop_id`
- tenant linkage
- unit linkage
- start and end dates
- rent terms
- lease status

### tenants
- tenant user/account linkage
- tenancy/application references
- role-scoped access metadata

### identity_oracle_runs
- immutable audit record
- original identifier
- normalized identifier
- namespace key
- syntax/verification result
- timestamp

### property_identity_profiles
- latest normalized identity state per `rc_prop_id`
- namespaced identifiers
- last run reference
- province/municipality

### tenancy_invites
- hashed token
- `rc_prop_id`
- `application_id`
- invited email
- expiry
- redeemed status
- redeemed by uid

### event_log
- `event_type`
- `entity_type`
- `entity_id`
- `context`
- `payload_ref` or compact payload
- `created_at`
- `created_by`
- processing status

## Relationship Model
- landlord → property → unit → application → lease → tenant
- applicants and active tenants must resolve through authority-based context
- tenant access must derive from:
  - application relation
  - lease/tenancy relation
  - valid invite token

## Security Logic
- use whitelist projections for tenant-facing reads
- never rely on client filtering for sensitive fields
- queries must remain scoped to canonical IDs
- cross-tenant reads must fail closed
- immutable audit collections must not be overwritten

## Data Change Guidance
When changing schema:
1. define collection/document impact
2. define read/write paths
3. define migration/backfill need
4. define projection/security impact
5. add tests

## Open Questions Template
- collection:
- fields added:
- migration needed:
- index needed:
- tenant exposure impact:
- audit impact:
