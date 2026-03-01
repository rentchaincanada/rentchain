# Bureau Capability Matrix

Related docs:
- [Bureau Adapter Specification v1](./bureau-adapter-v1.md)
- [Bureau Event Mapping](./bureau-event-mapping.md)

## Notes

- This matrix defines capability shape, not commercial terms.
- "Manual" means internal/operator-managed screening workflow without bureau API dependency.

## Provider Comparison

| Capability | TransUnion | Equifax (Future) | Manual |
| --- | --- | --- | --- |
| API-based screening submission | Yes | Planned | No |
| API-based status polling | Yes | Planned | No |
| Normalized status mapping | Yes | Yes (target) | Yes |
| Consent pre-check required | Yes | Yes | Yes |
| Correlation-id error tracing | Yes | Yes (target) | Yes |
| Timeline event mapping | Yes | Yes (target) | Yes |
| Provider outage fallback path | Manual fallback | Manual fallback | N/A |
| Structured retry guidance | Yes | Yes (target) | Operational only |
| PII minimization enforcement | Yes | Yes (target) | Yes |

## Normalized Capability Grid

| Area | v1 Requirement |
| --- | --- |
| Adapter contract | Provider-agnostic interface (`BureauAdapter`) |
| Status model | `pending`, `in_progress`, `completed`, `failed`, `requires_action`, `cancelled` |
| Error model | `provider_unavailable`, `consent_required`, `invalid_request`, etc. |
| Event integration | Map normalized screening lifecycle into timeline events |
| Compliance controls | Consent required, scope-limited access, retention policy alignment |

## Compliance Boundary Summary

- Partner-specific payload details must not leak into workflow-level UI contracts.
- Screening data retention must align with documented policy and legal obligations.
- Provider integration must remain auditable with event and error correlation identifiers.

