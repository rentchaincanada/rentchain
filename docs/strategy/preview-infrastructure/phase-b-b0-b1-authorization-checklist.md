# Phase B B0-to-B1 Authorization Checklist

> Current package status: **B1 not authorized**. Default every incomplete item to blocking.

| Prerequisite | Current classification | Evidence required |
| --- | --- | --- |
| Project option and naming approved | Proposed / blocking | executive, security, cloud decision |
| Organization/folder placement approved | Unresolved / blocking | organization administrator confirmation |
| Billing account attachment approved | Unresolved / blocking | billing-owner attestation, no identifier in repo |
| Budget/thresholds approved | Proposed / blocking | executive/billing approval |
| Alert recipients assigned | Unresolved / blocking | named owners/backups acceptance |
| Engineering owner assigned | Unresolved / blocking | written acceptance |
| Cloud administrator assigned | Unresolved / blocking | written/admin authority evidence |
| Security reviewer assigned | Unresolved / blocking | written acceptance |
| QA owner assigned | Unresolved / blocking | written acceptance |
| Terraform owner and approver assigned | Unresolved / blocking | TFC authority evidence |
| Vercel administrator assigned | Unresolved / blocking | admin attestation |
| Incident responder/break glass assigned | Unresolved / blocking | acceptance and procedure |
| Privacy owner assigned | Unresolved / blocking | written acceptance |
| IAM principles approved | Proposed / blocking | security/cloud sign-off |
| Terraform state model approved | Unresolved / blocking | isolated state/workspace evidence |
| Trusted PR policy approved | Proposed / blocking | engineering/security/Vercel sign-off |
| Synthetic-data policy approved | Proposed / blocking | privacy/security/QA sign-off |
| Provider suppression approved | Proposed / blocking | security/product/privacy sign-off |
| Cost model revalidated | Deferred / blocking | current prices, plans, tax, exchange evidence |
| Production fallback prohibition accepted | Recommended / blocking | executive/engineering/security sign-off |
| Rollback/deletion authority defined | Unresolved / blocking | named authority and evidence procedure |
| B1 sequence/scope approved | Proposed / blocking | approved mission with exact resource list |
| Separate B1 authorization issued | Deferred / blocking | explicit operator authorization |

No checklist item is satisfied by this document alone. B1 must stop after project/billing/labels/budgets/ownership/placement evidence. Enabling APIs is assigned to B2. B1 may not create Terraform Cloud workspaces, Cloud Run, WIF, service accounts, Vercel changes, Firebase, Firestore, Storage, fixtures, providers, or QA.
