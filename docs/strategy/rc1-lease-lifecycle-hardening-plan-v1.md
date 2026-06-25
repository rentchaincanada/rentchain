# RC1 Lease Lifecycle Hardening Plan v1

Branch: `docs/rc1-enterprise-demo-readiness-plan-v1`
Scope: planning only; no lease, storage, provider, backend, or frontend implementation.

## Purpose

Lease signing and signed-document retrieval must be credible before an enterprise demo. A signed lease shown as clickable while the signed document returns unavailable or redirects to a generic fallback is not acceptable for pilot validation.

## Current Hardening Driver

Related issue: #1233

Observed post-merge hardening case:

- a lease appeared signed in landlord `/leases`
- "View lease" was clickable
- signed document retrieval returned not found
- the UI fell back to a generic `/leases` route
- a signing request had later been cancelled
- resending and signing resolved the immediate user-facing issue

The original mismatch remains important because signed/cancelled lifecycle state must be explicit.

## RC1 Hardening Goals

RC1 should ensure:

- signed lease document retrieval is resilient
- cancelled-after-signing states are explicit
- missing signed documents show clear unavailable/admin-review states
- "View lease" never silently falls back to a broken generic route
- tenant and landlord document visibility remains projection-safe
- provider lifecycle events are represented in audit/history

## View Lease Resilience

The "View lease" action should handle:

- signed document available
- signed document not yet available
- signed document unavailable
- signing request cancelled
- signing provider state mismatch
- storage path missing
- access denied
- provider retrieval failed

Each state should produce clear UI copy and avoid false success.

## Signing Provider Lifecycle Edge Cases

RC1 should review lifecycle handling for:

- request created
- viewed
- reminder sent
- signed
- downloaded or document fetched
- cancelled
- cancelled after prior signing activity
- resend or replacement signing request

The lifecycle should avoid repeated reminders after a terminal signed/cancelled state.

## Signed / Cancelled State Clarity

Lease status should avoid collapsing different states into one ambiguous "signed" label when document retrieval is not possible.

Recommended display states:

- awaiting signature
- signature completed, document processing
- signed document available
- signing cancelled
- signed document unavailable
- admin review needed

## Missing Document UI States

When signed document retrieval fails, the UI should show:

- a clear unavailable state
- whether cancellation is known
- whether retry/resend/admin review is recommended
- no raw storage paths or provider payloads

## Audit Trail Expectations

Audit and timeline should preserve:

- signing request created
- reminder sent
- signed event received
- provider document fetch attempt
- document stored or unavailable
- cancellation event
- resend/replacement event
- user who initiated cancellation or resend where available

Audit should remain metadata-first and avoid raw provider payload exposure.

## Tenant And Landlord Document Visibility

Tenant and landlord document views should:

- use safe projections
- enforce server-side authorization
- avoid raw storage paths
- show the same terminal state consistently
- make missing document state clear without exposing private diagnostics

## Suggested Mission

```text
fix/lease-signed-document-retrieval-and-cancelled-state-v1
```

## Acceptance Criteria For RC1

- signed document link opens the correct document when available
- missing document states are explicit
- cancelled signing states are explicit
- generic route fallback is removed or prevented
- reminders stop after terminal lifecycle state
- audit/timeline preserves lifecycle evidence
