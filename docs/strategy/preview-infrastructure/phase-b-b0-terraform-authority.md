# Phase B B0 Terraform Authority

Repository evidence does not prove Terraform Cloud organization ownership, workspace configuration, state separation, variable authority, or recovery controls. No Terraform change is authorized.

## Proposed authority model

```mermaid
flowchart LR
  AU[Author] --> PL[Speculative plan]
  PL --> RV[Terraform approver plus security/cloud review]
  RV -->|approved| AP[Authorized apply operator]
  RV -->|defer/fail| X[No apply]
  AP --> VE[Verification and audit evidence]
  DE[Destroy request] --> DR[Two-person executive/resource-owner approval]
  DR --> AP
```

| Control | Recommendation |
| --- | --- |
| Organization owner | Named administrator required; not inferred from repository. |
| Workspace | `rentchain-preview-foundation` or approved convention, isolated from production. |
| State | Remote locked non-production state; no production remote-state dependency. |
| Variables | Non-sensitive configuration VCS-managed; sensitive values owned by restricted variable-set custodians. |
| Plan | Trusted VCS events and authorized humans; read access for reviewers. |
| Apply | Named operators after recorded approval; never untrusted PR auto-apply. |
| Destroy | Dual approval, protected-resource/evidence check, explicit target list. |
| Lock/unlock | Terraform owner; force unlock requires second approver and incident record. |
| Import | Terraform owner plus cloud administrator after inventory/no-op plan. |
| Recovery | State version/recovery procedure rehearsed and owner assigned. |
| Drift | Scheduled read-only review; alert only, no automatic remediation. |
| Audit logs | Retain per enterprise policy; minimum recommendation 365 days, subject to legal/security approval. |
| Break glass | Time-bound, dual-approved, monitored, retrospective required. |

Prohibited: shared Preview/production state, unmanaged local production state, committed secrets, broad workspace access, untrusted automatic applies, or one person silently authoring/approving/applying privileged changes where avoidable.

## Evidence before B1/B2

Before B1: organization/account owner attestation, proposed workspace/state owner, production-separation diagram, and import/no-reuse decision. Before B2: actual workspace ID (kept out of public docs if sensitive), permissions export, variable ownership, lock/recovery proof, plan/apply/destroy workflow, audit retention, and approved no-op baseline plan.

Status: **unresolved blocker; administrator confirmation required**.
