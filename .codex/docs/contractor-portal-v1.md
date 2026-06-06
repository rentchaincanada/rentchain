# Contractor Portal v1

## Scope

Contractor Portal v1 is a permission-gated operational workspace for contractors assigned by landlords to maintenance work orders. It is not a public marketplace, autonomous assignment system, contractor reputation surface, or tenant-facing contractor directory.

## Role Boundary

Contractor access uses the existing Firebase/JWT session model and the `contractor` role. The backend `requireContractor` middleware accepts only `contractor` and `admin` roles, resolves `contractorId` from the authenticated session, and fails closed when contractor context is missing.

Contractors can access only routes where the URL contractor id matches their authenticated contractor context. Admin may inspect contractor-scoped views for support purposes.

## API Routes

- `GET /api/contractors/:contractorId/work-orders`
- `GET /api/contractors/:contractorId/work-orders/:workOrderId`
- `PATCH /api/contractors/:contractorId/work-orders/:workOrderId/status`
- `GET /api/contractors/:contractorId/messages`
- `POST /api/contractors/:contractorId/messages`
- `GET /api/contractors/:contractorId/profile`
- `PATCH /api/contractors/:contractorId/profile`

All routes require contractor authentication. Cross-contractor URL manipulation returns `403`.

## Projection Safety

Contractor work-order projections are explicit allowlists. Contractor responses include:

- work order id
- task title and description
- category, priority, status, due date, schedule
- property display label or slug
- unit display label
- landlord contact name and email
- contractor-visible status history
- contractor-landlord messages for the assigned work order

Contractor responses do not include tenant id, tenant name, tenant household details, property id, unit id, rent amounts, payment data, screening data, landlord billing data, or provider payloads.

## Status Updates

Contractor status updates are scoped to assigned work orders. Allowed contractor states are:

- `assigned`
- `accepted`
- `scheduled`
- `in_progress`
- `needs_clarification`
- `on_hold`
- `completed`

The current status on `workOrders` is updated as the present operational state. Each contractor status change also appends a `workOrderUpdates` event with `actorRole: contractor`, timestamp metadata, and no raw payload exposure.

## Messaging Scope

Contractor messages use `contractorMessages`. A contractor may send a message only when:

- the work order is assigned to that contractor
- the requested landlord id matches the assigned work order landlord
- the message is tied to the assigned work order

Messages are work-order scoped and are not contractor-to-contractor or tenant-facing. Message events append a companion `workOrderUpdates` note so landlord audit surfaces can discover contractor communication activity.

## Collections

- `workOrders`: current operational state for landlord-owned work orders and assignment relationship.
- `workOrderUpdates`: append-safe contractor status/message activity events.
- `contractorMessages`: work-order-scoped contractor-landlord messages.
- `contractorProfiles`: contractor self-profile fields such as name, business name, phone, specialties, service areas, availability, and bio.

## Feature Flag

Frontend contractor portal routes are gated by `VITE_CONTRACTOR_PORTAL_ENABLED`. Backend route availability is documented through `CONTRACTOR_PORTAL_ENABLED`; route-level authorization remains mandatory even when the frontend flag is disabled.

## Manual QA

Manual QA is required because this mission touches backend routes, auth boundary behavior, frontend routing, and user-visible contractor workflows.
