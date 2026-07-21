# Phase B B0 Decision Register

| Decision | State | Recommendation / closure evidence |
| --- | --- | --- |
| Project reuse versus replacement | Requires executive approval | new purpose-built project; organization/security/admin confirmation |
| Project naming | Recommended | display `RentChain Shared Preview`; ID `rentchain-preview-<approved-suffix>` |
| Organization placement | Requires administrator confirmation | existing non-production folder preferred; organization-root fallback exception |
| Billing ceiling | Requires billing approval | CAD 100/month planning ceiling |
| Daily threshold | Requires billing approval | CAD 15/day investigation |
| Alert recipients | Unresolved blocker | named billing/engineering/cloud/executive/incident owners and backups |
| Terraform organization/workspace | Unresolved blocker | isolated `rentchain-preview-foundation` convention; admin evidence |
| Plan/apply/destroy authority | Requires executive/security approval | separated roles, dual-approved destroy |
| Vercel trusted-PR policy | Requires security approval | reviewed internal non-draft exact-head PRs only |
| WIF granularity | Requires technical validation | exact Team/project/Preview plus available deployment/branch claims |
| Deployment identity | Requires security approval | separate keyless identity, no production scope |
| Runtime identity | Requires security approval | dedicated least-privilege Preview identity |
| Synthetic-data policy | Requires privacy/security approval | synthetic-only, namespaced, deterministic, audited |
| Fixture retention | Recommended | seven days; approved defect hold max 30 days |
| Provider suppression | Requires security approval | deny-by-default; separate exception authorization |
| Firebase timing | Deferred | B6 only after guards and suppression design; not B1 |
| Baseline APIs | Recommended | B2, not B1, to preserve B1 boundary |
| B1 authorization owner | Unresolved blocker | named executive sponsor with required reviewer concurrence |
| Production fallback | Approved architecture principle | prohibited; no exception inside Phase B |

“Approved architecture principle” records PR #1442 governance posture only and does not authorize implementation. All B1-enabling rows must have written evidence.
