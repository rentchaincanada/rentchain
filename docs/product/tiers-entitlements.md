# Tiers And Entitlements

## Purpose
This document defines the canonical tier model and entitlement keys for backend and frontend gating.

## Tier List
- `free`
- `pro`
- `elite`
- `elite_enterprise`

## Canonical Entitlement Keys
- `templates_free`
- `templates_editable_docx`
- `lifecycle_automation`
- `compliance_engine`
- `portfolio_score`
- `quarterly_report_export`
- `rbac_multi_user`
- `audit_exports_advanced`

## Canonical Mapping
| Tier | templates_free | templates_editable_docx | lifecycle_automation | compliance_engine | portfolio_score | quarterly_report_export | rbac_multi_user | audit_exports_advanced |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `free` | true | false | false | false | false | false | false | false |
| `pro` | true | true | true | true | false | false | false | false |
| `elite` | true | true | true | true | true | true | false | false |
| `elite_enterprise` | true | true | true | true | true | true | true | true |

## Implementation Notes
- Backend remains source-of-truth for enforcement.
- Frontend must only hide/show based on backend capability responses.
- New feature gates should map to one of the canonical entitlement keys above.
- Existing legacy plans can map to canonical tiers in a compatibility layer.

## Compatibility Notes
- Existing production plans may still include legacy names. Canonical resolution should convert legacy names to one of:
  - `free`
  - `pro`
  - `elite`
  - `elite_enterprise`

## QA Checklist
- Backend capability response includes canonical tier labels for new flows.
- Frontend gating checks capability response instead of hardcoded plan strings.
- API rejects restricted actions when entitlement is false.
- UI does not expose controls for unavailable entitlements.

## Rollback Note
- If a rollout issue is found, revert tier-to-entitlement resolver changes and keep legacy mapping until corrected.

