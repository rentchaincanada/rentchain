# Phase B Authorization Checklist

> Default disposition: **defer**. Phase B is not authorized for implementation.

## Required named roles

Assign an executive owner, engineering owner, cloud administrator, security reviewer, billing owner, QA owner, incident responder, Terraform approver, and Vercel administrator. No individual may self-approve a privileged change they implement; small-team exceptions require documented second review.

## Evidence before B1

- [ ] Organization/folder/project placement and fallback approved.
- [ ] New-versus-reused project decision supported by inventory.
- [ ] Billing owner, CAD 100 budget, alerts, and stop authority approved.
- [ ] Terraform Cloud workspace/state owner, approvers, lock, variables, import, and destroy process evidenced.
- [ ] Vercel Team/project/environment owner and OIDC claim contract revalidated.
- [ ] Production project, URL, bucket, identity, data, and provider denylist recorded securely.
- [ ] GitHub trusted-PR/fork policy approved.
- [ ] IAM matrix and separation-of-duties exceptions approved.
- [ ] Incident, break-glass, retention, cleanup, and orphan-resource owners assigned.

## Evidence before runtime/data stages

- [ ] Hard-coded backend URL/project couplings have separately reviewed fixes.
- [ ] Preview startup asserts exact project/environment and fails closed.
- [ ] Provider suppression tests cover every listed integration.
- [ ] Exact-head manifest schema and mismatch behavior approved.
- [ ] Synthetic fixture schema, accounts, retention, reset, and privacy review approved.
- [ ] Cross-role QA and mutation serialization plan approved.
- [ ] Rollback and zero-residual verification rehearsed in non-production.

## Prohibited approvals

No static key, public Cloud Run, wildcard federation, automation Owner/Editor, project-wide Invoker, production access, real customer data, real provider action, browser cloud credential, uncontrolled local state, or production fallback may be waived inside Phase B.

## Owner responsibilities

Executive owns go/no-go and residual risk; engineering owns design/integration; cloud and Terraform owners own resource/state correctness; security owns trust/IAM/threat acceptance; billing owns freeze thresholds; QA owns fixtures/evidence; incident response owns containment/recovery; Vercel admin owns Preview settings and issuer evidence.

## Authorization record

Each B-stage request must record exact commit, scope, resources, principals, forecast cost, tests, rollback, retention, reviewers, decision, expiry, and cleanup evidence. Blank, conflicting, stale, or self-approved evidence means defer.
