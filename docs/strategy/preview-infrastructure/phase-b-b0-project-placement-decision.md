# Phase B B0 Project Placement Decision

## Options

| Option | Ownership/auditability | Isolation/history | Lifecycle and Terraform | Firebase/enterprise clarity | Disposition |
| --- | --- | --- | --- | --- | --- |
| A: reuse `rentchain-boundedoidc` | Actual owner/billing must be proven; spike history is reviewable | Empty after teardown, but name and purpose reflect a bounded experiment | Requires inventory and import/adoption decisions; deletion could erase spike context | Technically possible but semantically poor | Not preferred; requires executive/security/admin approval. |
| B: new purpose-built project | Clean named ownership and billing record | Strongest purpose boundary and no residual-resource ambiguity | Clean state/import baseline and explicit retention/deletion plan | Best naming, Firebase association, cost attribution, and enterprise explanation | **Recommended.** |
| C: another non-production project | No supporting repository evidence | Unknown coupling and data history | Unknown state/import and recovery consequences | Weakest clarity | Unresolved blocker; reject without full evidence. |

## Recommendation

Create a new project only in a separately authorized B1. Proposed display name: `RentChain Shared Preview`. Proposed immutable project-ID convention: `rentchain-preview-<approved-suffix>`; the final globally available ID must be recorded before creation. Do not rename, reuse, or delete `rentchain-boundedoidc` in B0.

Preferred hierarchy: RentChain organization → existing approved non-production folder → project → approved billing account. If folder creation/placement authority is unavailable, place the dedicated project directly under the organization with inherited policies and a documented exception; do not weaken organization policy.

Proposed labels: `environment=preview`, `data_class=synthetic`, `production_access=denied`, `owner=engineering`, `cost_center=platform`, `lifecycle=managed`, `phase=phase-b`. Classification: shared isolated non-production Preview; never staging production data.

## Production-isolation statement

The project may not trust, impersonate, read, write, route to, copy from, or share credentials with production projects. Billing-account attachment does not confer production access. Production project IDs, URLs, buckets, identities, data, and provider destinations remain denylisted.

## Evidence required

- Organization administrator confirms placement and project-creation authority.
- Executive/security approve new-project choice and disposition of the retained spike project.
- Billing owner approves account attachment without exposing its identifier in repository evidence.
- Cloud administrator confirms no inherited role or policy creates production crossover.
- Terraform owner confirms clean state adoption and no production state reference.
- Recovery/deletion owner documents deletion hold, recovery expectations, and evidence retention.

Status: **recommended; unresolved blocker until approvals exist**.
