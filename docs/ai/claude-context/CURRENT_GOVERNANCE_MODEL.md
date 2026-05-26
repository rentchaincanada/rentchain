# Current Governance Model

## Audit-Safe Operational History

RentChain emphasizes audit-safe operational history through canonical events, metadata-only review records, route-source attribution, and append-compatible references.

Operational history should explain what happened without exposing raw private data or creating hidden workflow execution.

## Append-Safe Workflows

Recent support escalation and governed review workspace foundations are append-safe by design. Helper contracts and read routes avoid status mutation, approval execution, deletion, remediation, and tenant/landlord exposure unless separately authorized.

## Projection Safety

Projection safety is a core rule:

- tenant-facing views must not receive support/admin internals
- landlord-facing views must not receive tenant-private or admin-only data
- public/user-safe exports must strip support metadata, actor chains, debug payloads, tokens, secrets, raw provider payloads, and raw documents
- unknown audiences should fail safe

## Privacy-Aware Tenant Data Handling

Tenant data must be minimized and consent-aware. Trust exports and document vault surfaces should avoid overstating availability, leaking raw storage paths, or exposing internal lease/property/unit identifiers.

## Metadata-First Trust and Export Posture

Institutional export and trust export docs favor:

- manual-only previews
- policy-gated summaries
- consent-scoped packages
- redaction metadata
- provenance and audit references
- no external submission by default

## Support Escalation Governance

Support escalation foundations include categories, severity, manual states, approval expectations, safe refs, append-only history, and review notes. These are governance metadata, not support powers or automated remediation.

## Institutional Export Readiness

Institutional readiness is a controlled direction. Current docs support preview packages and trust-export frameworks, but Claude should not infer live institutional integrations or legal certification unless current implementation confirms them.

## Deny-by-Default Posture

Ambiguous permissions, unknown audiences, unsupported workflow states, and unsafe payloads should fail closed or normalize to safe review states.
