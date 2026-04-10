# Tenant Profile And Communications

## What This Mission Adds

This mission extends the merged tenant portal foundation and frontend shell with the next bounded tenant-facing layer:

- a tenant-safe profile surface
- identity and document status visibility
- a landlord-to-tenant communications surface
- a tenant-safe notifications and feed view

The portal remains a projection over canonical backend records. No separate tenant source-of-truth model was introduced.

## Backend Surfaces

The tenant portal backend now exposes:

- `/api/tenant/profile`
- `/api/tenant/communications`
- `/api/tenant/communications/messages`
- `/api/tenant/communications/read`
- `/api/tenant/notifications`

The existing `/api/tenant/activity` path now uses the same tenant-safe notification feed logic for route compatibility.

## Profile And Identity Model

The tenant profile surface includes:

- display name
- email
- phone when already available safely
- authority context label
- linked property summary
- linked application summary
- linked lease summary

Identity and document visibility stays high-level:

- overall status
- identity verification status
- document checklist items
- tenant-safe next steps

It does not expose:

- raw screening payloads
- internal risk reasoning
- landlord-only notes
- admin-only notes

## Communications Model

The communications surface is intentionally bounded:

- one tenant-scoped conversation channel per tenancy or application context
- safe participant labels only
- message list
- tenant compose/send action when authority context allows it

This mission does not add:

- real-time chat infrastructure
- push delivery
- moderation or AI messaging features

## Notifications Feed

The feed is a tenant-safe projection across:

- application status
- identity and document next steps
- lease visibility
- maintenance updates
- landlord message notices
- invite linkage outcomes

It is curated rather than dumping raw backend events into the UI.

## Intentionally Deferred

This mission does not include:

- broader tenant automation
- CRM-style communications tooling
- landlord portal redesign
- external notification delivery changes
- document upload re-architecture
- risk-agent or compliance-agent integrations
