# Recovery Workflow Incident Response v1

## Scope

This document defines manual incident procedures for recovery workflows. It does not change recovery services, routes, audit writers, Firestore rules, rate limits, or admin/support permissions.

Recovery incidents must preserve append-safe recovery history and must not delete or rewrite recovery records.

## Current Recovery Surface

Current recovery endpoints are documented in `docs/security/recovery-workflow-security-audit-v1.md` and implemented in `rentchain-api/src/routes/adminRecoveryRoutes.ts`.

Primary records:

- `operatorRecoveryIntents`
- `operatorRecoveryLogs`
- `canonicalRecoveryTimelineEntries`
- `decisionContinuitySnapshots`
- `canonicalEvents`

## Recovery Incident Categories

| Type | Signal | Severity driver |
| --- | --- | --- |
| Access denial anomaly | Admin/support recovery request returns unexpected auth error. | Privileged access or support-scope risk. |
| Gate validation anomaly | Intent missing, stale, or authorization mismatch during approved work. | Wrong actor or stale authorization. |
| Reconciliation failure | Duplicate, invalid, or unexpected recovery decision result. | Operational state and audit impact. |
| Audit linkage gap | Recovery intent or gate validation missing canonical event. | Audit integrity impact. |
| Projection concern | Recovery response includes raw workflow ID or sensitive marker. | Data exposure impact. |
| Rate-limit gap abuse | Repeated inspection or mutation attempts. | Abuse and privileged endpoint risk. |
| Environment-recovery overlap | Preview/staging issue affects recovery workflow. | Production data or environment separation impact. |

## Detection Procedure

1. Identify endpoint label, method, and workflow type.
2. Confirm server-verified actor role and permission context.
3. Record recovery safe ref, not raw workflow ID.
4. Check recovery intent status and gate status.
5. Check recovery log and timeline entry for `metadataOnly`, `appendOnly`, and `rawIdsIncluded: false`.
6. Check `canonicalEvents` for recovery intent and gate validation events.
7. Classify category and severity.

## Immediate Containment

Use a recovery freeze when:

- actor authority is ambiguous;
- gate validation result is inconsistent;
- recovery audit linkage is missing;
- environment separation may have affected recovery;
- raw ID or sensitive payload exposure is suspected;
- a recovery action may mutate or influence production state incorrectly.

Freeze procedure:

1. Stop new manual recovery actions for affected workflow family.
2. Place in-flight reconciliation decisions on hold.
3. Preserve `operatorRecovery*`, `canonicalRecoveryTimelineEntries`, and `canonicalEvents`.
4. Notify ops lead and security lead.
5. Document safe refs and current response state.
6. Resume only after audit linkage and authority are verified.

## Gate Validation Holds

Apply a manual gate hold when:

- `intent_missing` appears unexpectedly;
- `authorization_invalid` appears for an operator expected to own the recovery intent;
- `intent_stale` appears during an active incident;
- actor role changed between intent capture and gate validation;
- support access lacks landlord scope where scoped diagnostic review is required.

Hold steps:

1. Do not capture replacement intent until root cause is reviewed.
2. Preserve failed gate validation event.
3. Verify actor role and support scope.
4. Confirm whether the original intent is stale by design.
5. Require ops lead approval before recapturing intent.

## Reconciliation Incident Procedure

1. Confirm workflow type and safe recovery ref.
2. Compare decision continuity snapshot, recovery timeline, and state-machine provenance.
3. Confirm whether divergence is `MISSING_TRANSITION`, `ORPHANED_DECISION`, `EVIDENCE_MISMATCH`, or `METADATA_DIVERGENCE`.
4. Check whether a duplicate recovery log already exists.
5. Do not edit or delete recovery logs.
6. If accepted reconciliation appears wrong, open rollback authorization review. Do not execute rollback through this procedure.

## Recovery History Preservation

Never:

- delete `operatorRecoveryLogs`;
- delete `operatorRecoveryIntents`;
- rewrite `canonicalRecoveryTimelineEntries`;
- overwrite `canonicalEvents`;
- remove failed gate validation records;
- copy raw recovery payloads into incident notes.

Preserve:

- actor safe ref;
- authority role;
- recovery safe ref;
- workflow type;
- decision type;
- reason code only when safe;
- timestamp;
- canonical audit event safe ref.

## Recovery Rollback Authorization

Rollback is not implemented by this mission. If a recovery decision may need reversal:

1. Classify the incident as `recovery_workflow`.
2. Escalate to ops lead, security lead, and founder if production state or tenant data is affected.
3. Reconstruct timeline from append-safe records.
4. Define the exact correction and risk.
5. Require explicit data-operation authorization before any state change.
6. Record follow-up as a future mission or approved data operation.

## Escalation

| Condition | Escalation |
| --- | --- |
| Missing audit event only, no active impact | Security lead. |
| Gate mismatch during active recovery | Ops lead and security lead. |
| Support scope ambiguity | Support lead and security lead. |
| Production state may be wrong | Founder, ops lead, security lead. |
| Raw ID or sensitive data exposure | Security lead, founder if tenant data involved. |
| Environment separation overlap | Ops lead and security lead. |

## Communication

Use `docs/operations/incident-response-communication-templates-v1.md`.

Recovery communication must not include:

- raw workflow IDs;
- raw lease, tenant, landlord, unit, payment, or user IDs;
- private reason text;
- provider payloads;
- screening reports;
- financial details;
- storage paths;
- bearer or credential values.

## Cross-Links

- Environment overlap: `docs/runbooks/environment-separation-incident-response-v1.md`
- Auth/session overlap: `docs/security/auth-incident-response-runbook-v1.md`
- Audit integrity: `docs/security/audit-immutability-contract-v1.md`
- Recovery security posture: `docs/security/recovery-workflow-security-audit-v1.md`
- Multi-system coordination: `docs/operations/multi-system-incident-coordination-v1.md`
