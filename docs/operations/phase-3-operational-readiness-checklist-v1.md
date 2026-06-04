# Phase 3 Operational Readiness Checklist v1

## Scope

This checklist verifies that Phase 3 has documentation coverage for incident readiness. It does not certify runtime automation, production deployment, external integrations, or tenant-facing incident disclosure.

## Governance And Taxonomy

- [ ] Incident categories from `security-audit-and-incident-response-foundations-v1.md` are mapped.
- [ ] Severity levels from `informational` through `critical` are defined.
- [ ] Manual response states are documented.
- [ ] `recovery_workflow` and `audit_integrity` are included as Phase 3 operational categories.
- [ ] Known future-only capabilities are labeled as Phase 4 or future work.

## Detection Procedures

- [ ] Recovery workflow detection procedures exist.
- [ ] Environment separation detection procedures exist.
- [ ] Auth/session detection procedures exist.
- [ ] Support escalation detection procedures exist.
- [ ] Audit integrity detection procedures exist.
- [ ] Projection/evidence/export detection procedures exist.
- [ ] Credential and secret detection procedures exist.
- [ ] Safe reference procedure is documented.

## Escalation Procedures

- [ ] Category-to-authority matrix exists.
- [ ] Founder notification criteria are documented.
- [ ] Security lead, ops lead, support lead, and product/engineering responsibilities are separated.
- [ ] Authority verification is server-side and role/permission based.
- [ ] Escalation request template excludes raw identifiers and secrets.
- [ ] Escalation timelines are severity-based.

## Containment Procedures

- [ ] Recovery freeze and gate hold procedures are documented.
- [ ] Environment rollback and deployment containment procedures are documented.
- [ ] Auth/session manual mitigation limits are documented.
- [ ] Support access containment is documented.
- [ ] Credential containment excludes secret values from notes.
- [ ] Data exposure containment freezes affected projection/export/evidence surfaces.
- [ ] Audit integrity containment preserves records and stops dependent decisions.

## Recovery Workflow Readiness

- [ ] Recovery endpoints are documented in `recovery-workflow-security-audit-v1.md`.
- [ ] Recovery incident response preserves `operatorRecovery*` and `canonicalEvents`.
- [ ] Recovery rollback is explicitly authorization-only and not implemented by runbook.
- [ ] Recovery communication excludes raw workflow IDs and private reason text.
- [ ] Recovery incidents link to environment and auth procedures.

## Environment Separation Readiness

- [ ] Preview/staging/production incident types are documented.
- [ ] Wrong backend host, wrong Firestore target, wrong auth project, and credential exposure scenarios are covered.
- [ ] Deployment SHA, backend revision, and Firestore target verification are required.
- [ ] Production data write concerns require evidence preservation before correction.

## Auth Incident Readiness

- [ ] Auth session incidents account for the current lack of server-side JWT revocation.
- [ ] Trusted-device and multi-session scenarios are documented as future design inputs.
- [ ] Manual mitigations include password reset, account disablement, or permission removal where authorized.
- [ ] Privileged account incidents escalate to security lead.

## Support Access Governance

- [ ] Support escalation categories and approval expectations are documented.
- [ ] Support access incidents preserve metadata-only support telemetry.
- [ ] Support diagnostic scope requires authority review.
- [ ] Tenant and landlord communications exclude admin/support internals.

## Audit Integrity

- [ ] `canonicalEvents` helper semantics are documented.
- [ ] Older event collection limitations are documented.
- [ ] Incident procedures preserve append-safe audit trails.
- [ ] Audit gaps stop dependent recovery, export, evidence, or review decisions.

## Projection Safety

- [ ] Incident procedures use safe refs only.
- [ ] Templates exclude tokens, secrets, provider payloads, storage paths, raw documents, and stack traces.
- [ ] Tenant, landlord, admin/support, export, dashboard, and timeline audience boundaries are preserved.
- [ ] Communication guidance distinguishes operators, support, founder, and product/engineering audiences.

## Post-Incident Analysis

- [ ] Timeline reconstruction procedure exists.
- [ ] Root cause template exists.
- [ ] Remediation tracking template exists.
- [ ] Closure criteria exist.
- [ ] Runbook update and lessons-learned capture are required.

## Manual Verification

For this documentation mission, verify:

- [ ] No runtime files changed.
- [ ] No auth, Firestore rules, deployment, CI/CD, or billing files changed.
- [ ] New documents cross-reference existing implemented systems.
- [ ] No raw secrets, tokens, provider payloads, or raw IDs appear in templates.
- [ ] `git diff --check` passes.

## Readiness Status

Phase 3 operational incident readiness is complete when all items are checked or explicitly marked as future work with owner and follow-up mission.
