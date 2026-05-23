# Admin Support Escalation Review Surface v1

## Summary

This mission adds a governed admin-only, metadata-only support escalation review surface. It exposes safe read-only summaries for support escalation history and manual review notes using the helper contracts introduced in PR #985 and PR #986.

It does not add escalation creation, approval, resolution, dismissal, note writing, persistence writes, automation, remediation, impersonation, tenant/landlord visibility, or enforcement controls.

## Audit Findings

Reviewed foundations:

- `supportEscalationRunbooks` provides categories, severities, manual states, approval expectations, safe refs, and prohibited action language.
- `supportEscalationHistory` provides append-only history and manual review note helper contracts.
- `adminSecurityIncidents` provides the closest backend route/service/frontend pattern for a metadata-only admin review page.
- `adminSupportProjectionSafety` provides user-safe projection boundaries for support/admin metadata.
- Existing admin route convention uses `requireAuth` plus `requirePermission("system.admin")` and route-source headers.
- No approved escalation persistence writer exists.

## Routes Added

Added admin-only routes:

- `GET /api/admin/support/escalations`
- `GET /api/admin/support/escalations/:escalationId`

Both routes require `system.admin` authority and set:

- `x-route-source: adminSupportEscalationRoutes.ts`

No mutation routes are added.

## Frontend Page Added

Added admin-only page:

- `/admin/support/escalations`

The page includes:

- summary counts
- category, severity, state, approval expectation, and search filters
- escalation list
- safe detail panel
- safe empty state
- explicit metadata-only messaging

No buttons or controls exist for approve, resolve, dismiss, impersonate, remediate, contact tenant/landlord, or mutate records.

## Read Model Behavior

The backend read model projects escalation data into safe records with:

- escalation ID
- category
- severity
- state
- approval expectation
- title
- summary
- created and last-updated timestamps
- safe actor summary
- safe evidence refs
- history count
- note count
- metadata-only/internal visibility flags

Detail responses include:

- safe escalation summary
- sanitized history entries
- sanitized manual review notes
- redaction summary
- approval expectation
- prohibited actions
- safe evidence references

Raw event JSON and raw note payloads are not returned.

## Persistence Decision

Persistence remains read-only-if-present.

The service reads from future append-only collection names if they exist:

- `supportEscalationHistory`
- `supportEscalationReviewNotes`

It does not create, update, delete, or seed those collections. If no records exist, the list endpoint returns an honest empty state and schema/readiness metadata.

This preserves the PR #986 decision that persistence writes require a separate scoped mission for collection ownership, retention, append-only write semantics, and route authorization.

## Redaction and Projection Safety

The review surface relies on helper outputs from `supportEscalationHistory` and `supportEscalationRunbooks`, which:

- normalize unsupported action/note types to safe defaults
- filter unrelated landlord/tenant refs
- avoid raw actor IDs in summaries
- sanitize note summaries
- redact token, secret, credential, authorization, cookie, storage-path, stack/debug, and request/response-like content
- carry provider, document, evidence, export, and policy data as reference/summary-only

The API and UI must not expose:

- tokens
- secrets
- credentials
- raw actor IDs as labels
- raw tenant or landlord IDs as labels
- raw note payloads
- raw provider payloads
- screening reports
- raw documents
- storage paths
- stack traces
- debug payloads
- unrestricted policy internals
- impersonation session IDs as visible labels

## Tests Added

Backend tests confirm:

- non-admin users are denied
- admin users can access list and detail
- route-source attribution is correct
- empty state is safe
- sensitive fields are stripped
- responses are metadata-only
- no mutation route exists

Frontend tests confirm:

- admin page renders
- filters render and call the API
- empty state renders
- sensitive fields are not rendered
- mutation controls are absent

## Known Limitations

This mission does not add:

- escalation persistence writes
- note creation
- approval/resolution/dismissal mutation
- escalation assignment
- alerting or notifications
- tenant/landlord visibility
- raw event or note exploration
- automation or remediation

The review surface will show an empty state until an approved append-only writer exists or safe records are otherwise present.

## Future Roadmap

Recommended follow-ups:

1. Add an append-only support escalation writer after collection ownership and retention are approved.
2. Add audited manual note creation with strict server-side sanitization.
3. Link security incident records to suggested escalation runbooks without automated remediation.
4. Add escalation status transitions only as append-only history, not mutable source-of-truth replacement.
5. Add exportable admin-only escalation audit summaries with projection safety tests.

## Guardrail Confirmation

This mission does not widen permissions, change auth, change Firestore rules, add tenant/landlord routes, expose support internals publicly, enable impersonation, mutate financial records, alter screening/payment/pricing/lease/export workflows, add dependencies, or introduce autonomous escalation/remediation.
