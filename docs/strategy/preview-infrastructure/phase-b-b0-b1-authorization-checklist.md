# Phase B B0-to-B1 Authorization Checklist

> Current package status: **B0 policy and ownership complete under solo-founder governance; B1 administratively ready for separate authorization; B1 not authorized**.

| Prerequisite | Current classification | Evidence required |
| --- | --- | --- |
| Project option and naming approved | Satisfied / founder-approved | written Founder direction |
| Organization/folder placement policy | Satisfied / founder-approved | organization-first with documented fallback; actual placement pending B1 |
| Billing attachment policy | Satisfied / founder-approved | actual attachment pending B1 |
| Budget/thresholds approved | Satisfied / founder-approved | CAD 100 and CAD 15/day policy |
| Alert recipient assigned | Satisfied | Founder — Paul; no backup currently |
| All accountable roles assigned | Satisfied | Founder — Paul accepted all roles; not independent |
| IAM principles approved | Satisfied / founder-approved | policy only; grants pending |
| Terraform state model approved | Satisfied / founder-approved | isolated-state policy; workspace pending |
| Trusted PR policy approved | Satisfied / founder-approved | manual solo-founder trust; implementation pending |
| Synthetic-data policy approved | Satisfied / founder-approved | policy only; fixtures pending |
| Provider suppression approved | Satisfied / founder-approved | policy only; gates pending |
| Cost model revalidated | Deferred / blocking | current prices, plans, tax, exchange evidence |
| Production fallback prohibition accepted | Satisfied / founder-approved | no exception inside Phase B |
| Rollback/deletion authority defined | Satisfied | Founder current authority; written evidence required per action |
| B1 sequence/scope approved | Satisfied as proposed boundary | exact mission/resource list still required |
| Separate B1 authorization issued | Deferred / blocking | explicit operator authorization |

The Founder direction supplies policy acceptance and role evidence; it does not supply implementation evidence. Cost revalidation and separate written B1 authorization remain blocking before execution. B1 must stop after project/billing/labels/budgets/ownership/placement evidence. Enabling APIs is assigned to B2 unless a future B1 authorization enumerates a minimal list. B1 may not create Terraform Cloud workspaces, Cloud Run, WIF, service accounts, Vercel changes, Firebase, Firestore, Storage, fixtures, providers, or QA.
