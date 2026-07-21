# Phase B B0 Executive Approval Brief

## Decision requested

B0 exists to establish accountable ownership and administrative evidence before any cloud work. PR #1441 proved a narrowly bounded keyless Vercel-to-IAM-protected Cloud Run identity bridge and teardown. PR #1442 selected the target architecture: a permanent isolated non-production foundation, ephemeral exact-head compute, and shared namespaced synthetic data with serialized mutations. Neither PR authorized Phase B implementation.

Current Preview configuration is unsuitable for authenticated QA because repository configuration still contains production routing/project/provider assumptions. B0 therefore requires decisions before B1 can even establish an empty project and billing controls.

## Recommended posture

- Create a new purpose-built `RentChain Shared Preview` project under an approved non-production folder, or organization-root fallback with documented exception.
- Approve a CAD 100/month planning ceiling, CAD 15/day anomaly review, and 25/50/75/90/100 percent alerts; revalidate pricing and tax first.
- Grant privileged Preview only to reviewed, non-draft, same-repository trusted PRs. Exclude forks, bots, unreviewed/draft, and docs-only changes from federated backend access.
- Require synthetic-only, namespaced, seven-day fixtures; never production data or real identities/financial/screening documents.
- Keep every provider blocked, stubbed, or local-sink by default; any real sandbox needs separate time-bound approval.

## Owners required

Name an executive sponsor, engineering owner, cloud administrator, security reviewer, billing owner, QA owner, Terraform owner and separate approver, Vercel administrator, incident responder, privacy owner, provider-suppression approver, break-glass custodian, and backups. Repository evidence assigns none of them.

## Approval table

| Decision | Recommendation | Required signature/confirmation | Current status |
| --- | --- | --- | --- |
| Project | new purpose-built project | executive, cloud, security, organization admin | Blocking |
| Billing/cost | CAD 100 ceiling; CAD 15/day anomaly | executive and billing owner | Blocking |
| Terraform | isolated workspace/state and separated authority | Terraform owner/approver, security, executive | Blocking |
| Vercel trust | trusted internal reviewed PRs only | Vercel admin, engineering, security | Blocking |
| IAM | keyless, separate identities, resource-scoped | security and cloud admin | Blocking |
| Data/privacy | synthetic-only, namespaced, time-bounded | privacy, QA, security | Blocking |
| Providers | deny-by-default; separate exceptions | security/product/privacy/legal as applicable | Blocking |
| Incident/break glass | named dual-controlled response | executive and security | Blocking |
| B1 scope | empty project/billing/labels/budgets/evidence only | executive plus required reviewers | Deferred |

## Executive conclusion

B1 is **not administratively ready**. The safe next step is manual completion and review of this B0 evidence package—no automatic follow-on PR. Only after every blocking row has non-sensitive evidence should an operator separately authorize a narrowly scoped B1 mission. Enabling APIs is recommended for B2, not B1.

No infrastructure, IAM, Vercel, Firebase, Terraform state, runtime, production, PR #1435, Operational Credits, or provider change is included.
