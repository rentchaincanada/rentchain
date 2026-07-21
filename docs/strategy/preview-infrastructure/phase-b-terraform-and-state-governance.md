# Phase B Terraform and State Governance

## Current assessment

Root Terraform enables services and defines buckets, Artifact Registry, legacy Cloud Run, and public Invoker. Repository evidence does not establish a remote backend, Terraform Cloud workspace ownership, run-task policy, variable authority, or import inventory. These unknowns are implementation blockers. Existing production-oriented resources must not be refactored as part of Phase B without a separate migration decision.

## Recommended structure

- Separate `preview-foundation` workspace/state from production and application runtime.
- One durable foundation module: APIs, labels, registry, budgets/alerts where supported, WIF, service accounts/IAM, Firebase/Firestore/Storage, logging retention.
- Ephemeral PR compute managed by a distinct workspace or deployment workflow with constrained outputs; never share production state.
- Workspace tags: `rentchain`, `preview`, `nonproduction`, `synthetic-only`.
- VCS-driven plans; applies require Terraform approver plus security/cloud approval for IAM and billing-sensitive changes.

## Variables and secrets

Non-sensitive names/regions live in version control. Sensitive values live only in approved Terraform Cloud variable sets with least-privilege ownership and audit history. Provider credentials are not Phase B Terraform inputs. Outputs expose safe resource names/URLs, never tokens or credential material.

## State controls

Enable remote locking, versioning, audit logging, plan expiry, drift detection, and separate apply permissions. No local state, manual state editing, cross-workspace remote-state reads, or speculative plan with production credentials. Destroy requires a second approver and protected-resource check.

## Import and drift

Inventory any candidate pre-existing non-production project resources before reuse. Produce import mappings and no-op plan evidence; do not adopt the bounded spike project by assumption. Nightly or scheduled read-only drift checks may be proposed later, with alerts and no auto-apply.

## Policy checks

Reject public Cloud Run IAM, static keys, wildcard WIF, production project references, minimum instances above zero, maximum instances above one for PR services, unlabelled resources, unbounded retention, broad roles, and missing budget metadata.

## Split PRs

Use separate authorized PRs for state/workspace bootstrap, project baseline, identity/IAM, data services, deployment workflow, and cleanup. Each must show plan output, ownership, cost delta, rollback, and state isolation. Phase B planning makes no Terraform or state change.
