# Phase B B0 IAM Policy

## Principles

No static keys, production service-account reuse, wildcard federation, project-wide Cloud Run Invoker, public Cloud Run, browser-held Google credentials, automation Owner/Editor, or routine break-glass use. Separate deployment, runtime, invocation, seeding, and cleanup identities. Prefer service/resource scope, least privilege, explicit ownership, expiry, and quarterly binding review.

This policy is founder-approved, not an independent security certification. Founder — Paul is the current cloud administrator, security reviewer, and break-glass custodian. Broad principal-set trust also requires separate justification and approval; production fallback is prohibited.

| Principal category | Proposed resource/role capability | Scope/justification | Owner/approval | Prohibited expansion |
| --- | --- | --- | --- | --- |
| GitHub deploy WIF | repository writer and minimal deploy capability | one Preview registry/project; immutable exact-head deploy | engineering owner; security/cloud approval | production, Owner/Editor |
| Deploy identity | Service Account User | one Preview runtime identity | cloud owner; security | Token Creator by default |
| Cloud Build identity | source-prefix read, repository write | exact source bucket prefix/repository | cloud owner; security | project Storage/AR admin |
| Vercel WIF principal | Workload Identity User | exact Team/project/Preview claims | Vercel owner; security | wildcard principal set |
| Invocation identity | Cloud Run Invoker | individual PR services | Vercel/cloud owners; security | project-wide Invoker |
| Runtime identity | minimum Firestore/Storage data access | Preview resources only | engineering/privacy/security | admin or production roles |
| Seeder/cleanup identities | namespace lifecycle capability | manifest/label-constrained Preview data/resources | QA/cloud; privacy/security | global delete or runtime deploy |
| Human cloud admin | time-bound administrative capability | Preview project only | executive/security | routine Owner use |
| Break-glass group | emergency time-bound access | exact incident/resource | executive plus security | automation or standing access |

Security approval is required for every WIF claim/condition, service-account impersonation, role selection, inherited binding, exception, and break-glass procedure. Technical validation must prove each exact API permission before role grant; the matrix is not an IAM grant instruction.

Review bindings quarterly and after incidents, owner departure, trust changes, or project lifecycle events. Evidence records principal category, resource, role, condition, approvers, expiry, test, and revocation result without credentials.

Break-glass is never routine. Each use records purpose, time, scope, actions, outcome, temporary privilege removal, and post-event review; credentials remain keyless where possible. A qualified secondary custodian is prioritized when available.

Status: **founder-approved and internally accepted under solo-founder governance; not independently reviewed**. No IAM grant exists or is authorized by B0.
