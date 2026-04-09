# Tenant Portal v1 Foundation

## Purpose
Tenant Portal v1 is a projection layer over canonical RentChain records. It does not create a separate tenant source-of-truth model for properties, applications, leases, or maintenance.

## What This Mission Adds
- server-side tenancy context resolution from applicant, active lease/tenancy, or redeemed/pending invite linkage
- hashed tenancy invite creation and one-time redemption
- whitelist tenant projections for property, application, lease, and maintenance records
- compact Firestore tenant event logging in `event_log`
- foundation tenant workspace routes for summary, application status, lease visibility, maintenance visibility, maintenance submission, and invite redemption

## Invite Token Assumptions
- invite tokens are random and only returned at creation time
- stored invite records keep only `token_hash` and `token_preview`
- redemption requires authenticated identity so `redeemed_by_uid` can be recorded
- v1 links invite redemption to workspace authority without introducing a duplicate tenant-only database

## Projection Rules
- property responses expose address and selected safe features only
- application responses expose status, missing steps, next actions, and timestamps only
- lease responses expose start/end dates, monthly rent, status, and safe document reference only
- maintenance responses expose summary fields only

## Event Log Shape
- `event_type`
- `entity_type`
- `entity_id`
- `context`
- `created_at`
- `created_by`
- `status`
- optional compact `payload`

## Limitations
- v1 still relies on existing Firestore collection conventions and mixed historical field names
- invite redemption is authenticated and foundation-focused; it does not perform full downstream onboarding automation
- tenant workspace authority fails closed when multiple property contexts are discovered for one identity
- maintenance submission is limited to active tenant context in this pass
