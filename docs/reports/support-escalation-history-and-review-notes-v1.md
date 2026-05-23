# Support Escalation History and Review Notes v1

## Summary

This mission adds a governed, append-only metadata foundation for support escalation history entries and manual review notes. It builds on `supportEscalationRunbooks` from PR #985 and keeps escalation history admin/support internal, projection-safe, and non-autonomous.

No routes, frontend UI, Firestore collections, persistence writes, status mutation, support powers, impersonation powers, autonomous remediation, automated enforcement, or tenant/landlord-facing escalation visibility are introduced.

## Audit Findings

Reviewed foundations:

- `supportEscalationRunbooks` provides deterministic categories, severity, manual states, approval requirements, and scoped safe refs.
- `supportSessionAudit` provides append-compatible support-session audit metadata but no persistence writer.
- `adminSecurityIncidents` provides admin-only incident review summaries and safe detail projections.
- `adminSupportProjectionSafety` strips support/admin internals from user-safe surfaces.
- `events/buildEvent` provides canonical event construction and Firestore writes, but this mission does not write events because support escalation persistence and retention are not yet approved.
- Existing note/history patterns exist for lease lifecycle reviews, resolution notes, and review timelines, but they are domain-specific and not a reviewed support escalation persistence model.

No existing support escalation history or support review note system was found.

## Implemented Helpers

Added helper:

- `normalizeSupportEscalationActionType()`
- `normalizeSupportEscalationNoteType()`
- `buildSupportEscalationHistoryEntry()`
- `buildSupportEscalationReviewNote()`

The helper reuses runbook governance from `supportEscalationRunbooks` for:

- category normalization
- severity normalization
- manual state normalization
- approval requirement derivation
- scoped safe evidence/resource refs

## Supported Action Types

Implemented action types:

- `escalation_created`
- `triage_started`
- `review_note_added`
- `approval_requested`
- `manual_action_approved`
- `manual_action_declined`
- `escalation_resolved`
- `escalation_dismissed`
- `evidence_ref_added`
- `runbook_template_applied`

Unsupported action types normalize to `review_note_added`, a safe non-mutating default.

## Supported Note Types

Implemented note types:

- `triage_note`
- `security_review_note`
- `support_lead_note`
- `admin_review_note`
- `evidence_note`
- `resolution_note`
- `dismissal_note`

Unsupported note types normalize to `triage_note`.

## History Entry Contract

History entries include:

- `historyEntryId`
- `escalationRefId`
- category, severity, state
- action type
- actor summary
- occurrence timestamp
- note summary
- approval expectation
- safe evidence refs
- safe resource refs
- metadata-only visibility and append-only flags

History entries are intended as append-only metadata records. They are not status mutations, approval execution, remediation, or permission grants.

## Manual Review Note Contract

Manual review notes include:

- `noteId`
- `escalationRefId`
- note type
- normalized note summary
- author summary
- creation timestamp
- safe evidence refs
- safe resource refs
- redaction summary
- metadata-only visibility and append-only flags

Freeform note text is normalized into a bounded metadata-only summary. It is not treated as a raw payload store.

## Redaction and Projection Safety

The helper avoids or redacts:

- tokens
- credentials
- secrets
- authorization headers
- cookies
- raw provider payloads
- raw screening reports
- raw documents
- raw storage paths
- raw request bodies
- raw response bodies
- stack traces
- debug payloads
- unrestricted policy internals

Actor summaries intentionally exclude raw actor IDs. Safe refs reuse the runbook helper, which filters unrelated landlord/tenant scope and avoids raw storage/token-like labels.

Every history entry and note includes:

- `metadataOnly: true`
- `visibilityClass: admin_support_internal`
- `tenantVisible: false`
- `landlordVisible: false`
- `appendOnly: true`
- `supportPowersGranted: false`
- `impersonationEnabled: false`
- `autonomousRemediationEnabled: false`
- `autonomousEscalationEnabled: false`
- `financialMutationEnabled: false`
- `routeVisibilityChanged: false`

## Persistence Decision

Persistence is intentionally deferred.

No existing reviewed support escalation collection or append-only support/admin note writer exists. Introducing storage would require separate review of:

- collection ownership
- retention policy
- admin/support route authorization
- route-source attribution
- append-only write semantics
- read projection rules
- incident/runbook linkage
- tenant/landlord exclusion guarantees

This mission therefore adds helper/model foundations only.

## Tests Added

Tests confirm:

- action type normalization
- note type normalization
- history entry creation
- manual review note creation
- category/severity/state reuse from runbook helper
- approval expectation derivation
- scoped safe refs
- restricted field exclusion
- tenant and landlord visibility remain false
- append-only flag remains true
- no support powers, impersonation, autonomous remediation, autonomous escalation, financial mutation, or route visibility change is implied
- unsupported inputs fail safe

## Known Limitations

This phase does not add:

- Firestore persistence
- API routes
- admin UI
- note editing
- status mutation
- incident status linkage
- escalation assignment
- notification/alerting
- external SIEM integration
- automated remediation

The helper is a deterministic contract foundation only.

## Future Roadmap

Recommended follow-ups:

1. Add an append-only admin/support escalation history writer after collection ownership and retention are approved.
2. Add admin-only read routes for escalation history after route authorization and route-source ownership are reviewed.
3. Link admin security incident records to suggested runbook templates and history entries without enabling automated actions.
4. Add admin UI for manual escalation notes and history once projection safety tests exist for the route.
5. Define immutable retention/export rules for admin/support escalation audit records.

## Guardrail Confirmation

This mission does not widen permissions, change auth, change Firestore rules, add routes, add UI, add persistence, expose support internals to landlords or tenants, enable impersonation, mutate financial records, alter screening/payment/pricing/lease/export workflows, add dependencies, or introduce autonomous remediation.
