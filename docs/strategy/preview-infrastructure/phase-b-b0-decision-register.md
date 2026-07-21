# Phase B B0 Decision Register

| Decision | State | Recommendation / closure evidence |
| --- | --- | --- |
| Project reuse versus replacement | Founder-approved | new purpose-built project; do not reuse bounded spike project |
| Project naming | Founder-approved | display `RentChain Shared Preview`; ID `rentchain-preview-<approved-suffix>` subject to availability |
| Organization placement | Founder-approved policy | existing non-production folder preferred; organization-root fallback; actual availability pending |
| Billing ceiling | Founder-approved | CAD 100/month planning ceiling; new approval above ceiling |
| Daily threshold | Founder-approved | CAD 15/day documented investigation/decision |
| Alert recipients | Founder-approved policy | Founder current recipient; actual configuration pending |
| Terraform organization/workspace | Founder-approved policy | isolated `rentchain-preview-foundation` convention; creation pending |
| Plan/apply/destroy authority | Accepted under solo-founder governance | Founder holds both roles; compensating evidence; external review triggers |
| Vercel trusted-PR policy | Founder-approved | reviewed internal non-draft exact-head authenticated-QA PRs only |
| WIF granularity | Requires technical validation | exact Team/project/Preview plus available deployment/branch claims |
| Deployment identity | Founder-approved policy | separate keyless identity, no production scope; implementation pending |
| Runtime identity | Founder-approved policy | dedicated least-privilege Preview identity; implementation pending |
| Synthetic-data policy | Founder-approved | synthetic-only, namespaced, deterministic, audited |
| Fixture retention | Founder-approved | seven days; approved defect hold max 30 days |
| Provider suppression | Founder-approved | deny-by-default; separate exception authorization; implementation pending |
| Firebase timing | Deferred | B6 only after guards and suppression design; not B1 |
| Baseline APIs | Recommended | B2, not B1, to preserve B1 boundary |
| B1 authorization owner | Assigned and accepted | Founder — Paul; separate written B1 authorization still required |
| Production fallback | Approved architecture principle | prohibited; no exception inside Phase B |

“Approved architecture principle” records PR #1442 governance posture only and does not authorize implementation. All B1-enabling rows must have written evidence.
