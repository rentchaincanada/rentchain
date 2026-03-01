# Bureau Event Mapping

Related docs:
- [Bureau Adapter Specification v1](./bureau-adapter-v1.md)
- [Bureau Capability Matrix](./bureau-capability-matrix.md)

## Purpose

Define how normalized screening lifecycle changes map into timeline events (`AutomationEvent`) in a provider-agnostic way.

## Mapping Table

| Normalized Screening State | Trigger | AutomationEvent.type | Title Example | Required Entity References |
| --- | --- | --- | --- | --- |
| `pending` | Screening request accepted | `SCREENING` | `Screening requested` | `applicationId`, `tenantId` |
| `in_progress` | Provider processing started | `SCREENING` | `Screening in progress` | `applicationId`, `tenantId` |
| `requires_action` | Consent or identity follow-up needed | `SCREENING` | `Screening requires action` | `applicationId`, `tenantId` |
| `completed` + outcome `pass` | Provider result finalized | `SCREENING` | `Screening completed` | `applicationId`, `tenantId` |
| `completed` + outcome `review` | Provider result finalized | `SCREENING` | `Screening completed (review)` | `applicationId`, `tenantId` |
| `completed` + outcome `fail` | Provider result finalized | `SCREENING` | `Screening completed (high risk)` | `applicationId`, `tenantId` |
| `failed` | Provider operation failed | `SYSTEM` | `Screening failed` | `applicationId` |
| `cancelled` | Request cancelled by user/system | `SYSTEM` | `Screening cancelled` | `applicationId` |

## Normalized Event Payload Guidance

- `id`: deterministic by source + screening id + status transition.
- `occurredAt`: ISO timestamp from event transition time.
- `metadata.source`: one of `transunion`, `equifax`, `manual`.
- `metadata` may include safe operational fields (for example: `status`, `outcome`, `correlationId`).

## De-Dupe Guidance

- Primary key: `event.id`.
- Secondary fingerprint (if `id` collisions happen): `type + occurredAt(2-minute bucket) + applicationId + tenantId + status`.
- Keep first write for identical fingerprints within a short ingestion window.
- Prefer provider lifecycle events over inferred UI events when duplicates exist.

## Retention and PII Handling Notes

- Do not place raw bureau payloads into timeline metadata.
- Do not place direct identifiers beyond required workflow references.
- Keep timeline metadata operational and minimal.
- Apply retention limits based on product tier and policy without bypassing legal obligations.
- Redact sensitive fields before export where policy requires.

