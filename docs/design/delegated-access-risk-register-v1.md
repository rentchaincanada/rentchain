# Delegated Access Risk Register V1

## Scope

This document identifies implementation risks for Delegated Access V1.

This is design-only. It does not implement code, backend routes, UI, Firestore schema, security rules, audit storage, billing changes, or deployment changes.

## Risk Summary

Delegated access risk is mainly about authority and evidence:

- If permission evaluation is loose, delegates can over-access landlord, tenant, payment, or evidence data.
- If revocation is weak, stale access persists.
- If audit attribution is incomplete, actions become hard to defend.
- If contractor or property manager company access is improvised, turnover creates privacy and operational risk.
- If billing/settings are delegated too early, account ownership becomes unclear.

## Privilege Escalation Risks

| Risk | Impact | Likelihood | Mitigation | Recommendation |
| --- | --- | --- | --- | --- |
| Delegate route treats delegate as landlord owner | Critical data and account control exposure. | Medium | Resolve owner versus delegate server-side and deny owner-only actions. | Fix before implementation. |
| Client controls landlord or property scope | Cross-property or cross-landlord exposure. | Medium | Resolve landlord, property, unit, and resource ownership server-side. | Fix before implementation. |
| Workspace scope is checked but action flag is not | Delegates can mutate where only view was intended. | Medium | Require workspace, property/resource, and action checks. | Fix before implementation. |
| Contractor receives property-wide access | Tenant/payment/lease exposure beyond job need. | Medium | Contractor default must be resource/job scoped. | Fix before contractor support. |
| Read-only Auditor receives mutation rights through shared helper | Evidence or record mutation by auditor. | Low to medium | Explicit deny mutation and message actions for auditor role. | Fix before auditor support. |

## Stale Access Risks

| Risk | Impact | Likelihood | Mitigation | Recommendation |
| --- | --- | --- | --- | --- |
| Revoked delegate keeps access through active session | Privacy and payment exposure. | Medium | Evaluate current grant state on each sensitive request. | Fix in V1 foundation. |
| Role change does not refresh permissions | Old role remains effective. | Medium | Permission helper must load current grant and reject stale assumptions. | Fix in V1 foundation. |
| Expired invite still accepts | Unauthorized access grant. | Low to medium | Validate invitation status and expiration on acceptance. | Fix in invitation phase. |
| Cancelled invite still accepts | Unauthorized access grant. | Low | Store status and fail closed on acceptance. | Fix in invitation phase. |

## Contractor Turnover Risks

| Risk | Impact | Likelihood | Mitigation | Recommendation |
| --- | --- | --- | --- | --- |
| Contractor staff uses shared contractor account | Actor attribution lost. | Medium | Require individual accounts for contractor users in future org model. | Defer with model alignment. |
| Contractor retains job access after completion | Privacy and operational exposure. | Medium | Job/resource scope should expire or be revoked on completion. | Defer to contractor implementation. |
| Contractor sees tenant data unrelated to assigned job | Privacy exposure. | Medium | Job-scoped projection only. | Fix before contractor route access. |
| Contractor Admin manages landlord delegates | Authority confusion. | Low | Contractor Admin scope must be organization/job-only. | Fix before contractor org support. |

## Property Manager Turnover Risks

| Risk | Impact | Likelihood | Mitigation | Recommendation |
| --- | --- | --- | --- | --- |
| Individual PM leaves company but keeps landlord access | Privacy and operational exposure. | Medium | V1 supports individual revocation; future company model needs staff lifecycle controls. | Accept in V1 with clear limitation. |
| Company access is modeled as shared account | Attribution loss. | Medium | Future company model must preserve individual actor attribution. | Defer, but keep model-compatible. |
| Company admin cannot see staff access history | Weak accountability. | Medium | Future company layer should include staff activity visibility. | Defer. |
| Landlord cannot revoke company cleanly | Stale external access. | Medium | Future landlord-to-company grant should support immediate revoke. | Defer. |

## Accidental Over-Sharing Risks

| Risk | Impact | Likelihood | Mitigation | Recommendation |
| --- | --- | --- | --- | --- |
| Role descriptions are too broad | Owners grant more access than intended. | Medium | Use concise role impact summaries and review step. | Fix in UI phase. |
| `all_current_properties` becomes default | Excess property exposure. | Medium | Default to selected properties or resource-only where appropriate. | Fix in invitation phase. |
| Workspace selection implies data access beyond projection | Sensitive fields leak. | Medium | Projection remains role and workspace aware. | Fix route by route. |
| Frontend hides data but API returns broad records | Security failure. | Medium | Backend projection and authorization must be authoritative. | Fix route by route. |

## Payment Access Risks

| Risk | Impact | Likelihood | Mitigation | Recommendation |
| --- | --- | --- | --- | --- |
| Delegate edits payment records | Financial integrity risk. | Medium | Payment mutation owner-only in V1. | Fix before payments delegation. |
| Delegate exports payment data | Privacy and financial exposure. | Medium | Payment exports owner-only by default. | Fix before payments delegation. |
| Payment summaries expose too much tenant detail | Privacy exposure. | Medium | Use scoped summaries and safe labels. | Fix before payments delegation. |
| Denied payment mutation is not logged | Suspicious access invisible. | Medium | Audit denied high-risk attempts. | Fix in audit phase. |

## Evidence Access Risks

| Risk | Impact | Likelihood | Mitigation | Recommendation |
| --- | --- | --- | --- | --- |
| Delegate exports evidence without explicit scope | Evidence/privacy exposure. | Medium | Evidence exports require explicit scope and audit. | Fix before evidence delegation. |
| Audit copies raw evidence payloads | Sensitive data replicated. | Low to medium | Metadata-only audit. | Fix in audit architecture. |
| Contractor uploads evidence to wrong job | Record integrity issue. | Medium | Job-scoped upload validation. | Fix before contractor evidence support. |
| Auditor access becomes implicit full export access | Over-sharing. | Low to medium | Auditor export must be explicitly scoped. | Fix before auditor support. |

## Privacy Exposure Risks

| Risk | Impact | Likelihood | Mitigation | Recommendation |
| --- | --- | --- | --- | --- |
| Tenant PII broadly visible to maintenance roles | Privacy breach. | Medium | Maintenance projection should show only required contact/context. | Fix before maintenance delegation. |
| Message bodies exposed beyond scope | Privacy breach. | Medium | Inbox/message projection by role and workspace. | Fix before inbox delegation. |
| Lease data exposed to contractors | Privacy breach. | Low to medium | Contractors receive only job-required occupancy context. | Fix before contractor support. |
| Raw internal IDs become user-facing labels | Privacy and support risk. | Low | Use safe labels in UI/export projections. | Fix route by route. |

## Audit Gap Risks

| Risk | Impact | Likelihood | Mitigation | Recommendation |
| --- | --- | --- | --- | --- |
| Delegated actions audit as landlord owner | Attribution failure. | Medium | Always include `actorUserId` and `actingForLandlordId`. | Fix in foundation. |
| Revocation event omits previous scope | Weak history. | Medium | Store previous role/scope in grant history and audit. | Fix in revocation phase. |
| Denied high-risk actions are not logged | Abuse detection gap. | Medium | Audit denied payment/evidence/billing/revoked attempts. | Fix in audit phase. |
| Audit write failure silently allows high-risk mutation | Evidence defensibility risk. | Low to medium | Fail closed for high-risk required audit capture. | Fix before mutations. |

## Migration Risks

| Risk | Impact | Likelihood | Mitigation | Recommendation |
| --- | --- | --- | --- | --- |
| Existing owner routes accidentally become delegate-enabled | Unreviewed exposure. | Medium | Route-by-route opt-in for delegate authorization. | Fix in implementation plan. |
| Existing admin/support impersonation is conflated with delegation | Governance confusion. | Low to medium | Keep admin/support workflows separate. | Fix in design review. |
| Backfill attempts rewrite old actor history | Audit meaning changes. | Low | No V1 backfill. Future actions only. | Accept intentionally. |
| Firestore security rules change before backend model is stable | Access regression. | Low to medium | No rules changes until backend enforcement is reviewed. | Defer. |

## Release Risks

| Risk | Impact | Likelihood | Mitigation | Recommendation |
| --- | --- | --- | --- | --- |
| One large PR implements data, routes, UI, and audit | Hard review and high regression risk. | Medium | Split foundation, lifecycle API, UI, and route opt-in. | Fix in sequencing. |
| Manual QA starts too late | Invitation and revocation bugs reach users. | Medium | Require preview QA once UI/routes exist. | Fix in rollout. |
| Billing/settings accidentally appear in delegate nav | Owner authority confusion. | Low to medium | Owner-only nav gating and backend denial. | Fix before UI. |
| Delegate UX overpromises access before route support exists | Confusing product experience. | Medium | Show scoped workspace availability based on implemented route support. | Fix in UI phase. |

## Accepted V1 Limitations

- No custom permission builder.
- No delegated billing/settings access.
- No property manager company hierarchy.
- No contractor organization hierarchy.
- No mandatory MFA enforcement.
- No SSO/SCIM.
- No legal chain-of-custody implementation.
- No historical audit backfill.

## Not Accepted

- Shared landlord logins as an operational pattern.
- Delegate actions appearing as landlord owner actions.
- Frontend-only authorization.
- Broad data return followed by client filtering.
- Revoked access remaining effective.
- Payment mutation by delegates in V1.
- Billing/settings access by delegates in V1.
