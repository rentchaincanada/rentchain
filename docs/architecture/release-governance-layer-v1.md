# Release Governance Layer v1

## Purpose

The Release Governance Layer provides deterministic, permissioned release-readiness visibility for RentChain. It formalizes release references, deployment readiness visibility, rollback readiness, QA verification, operational-risk dependencies, evidence lineage, review lineage, and audit lineage in one admin-scoped read model.

This layer is an institutional governance surface. It is not deployment orchestration.

## Scope

The v1 layer adds:

- deterministic release governance profile derivation
- admin-scoped read-only endpoints
- QA, rollback, deployment, operational-risk, evidence, review, and audit references
- release restriction visibility
- descriptor-only canonical release governance events
- admin UI for manual release governance review

## Guardrails

The layer preserves these controls:

- `manualApprovalRequired` is always `true`
- `autonomousDeploymentEnabled` is always `false`
- `autonomousRollbackEnabled` is always `false`
- `publicLaunchEnabled` is always `false`

The layer does not deploy infrastructure, trigger releases, perform rollback, mutate production infrastructure, expose secrets, replace CI/CD systems, or create release execution APIs.

## Read Model

Release governance profiles include:

- release governance ID
- release version
- readiness status
- release references
- deployment readiness references
- rollback references
- QA references
- operational-risk references
- evidence references
- review references
- audit references
- release restrictions
- redaction summary
- descriptor-only canonical events

Readiness status is deterministic:

- `ready_for_review`: release, QA, operational-risk, evidence, review, and audit lineage is available
- `partially_ready`: lineage exists but is incomplete
- `review_required`: critical lineage is unavailable
- `blocked`: operational-risk, QA, deployment, evidence, or review restrictions are blocked
- `unknown`: insufficient source context exists

## Endpoints

Admin-scoped endpoints:

- `GET /api/admin/release-governance`
- `GET /api/admin/release-governance/:releaseGovernanceId`

Query parameters:

- `releaseVersion`
- `status`

Both endpoints are read-only and require the existing `system.admin` permission.

## Redaction Boundary

Release governance explicitly excludes:

- deployment credentials
- tokens and secrets
- environment values
- unrestricted CI/CD logs
- sensitive admin-only infrastructure telemetry
- production mutation payloads
- deployment execution payloads
- rollback execution payloads
- launch execution payloads

## Canonical Events

Descriptor-only event types:

- `release_governance_profile_derived`
- `release_governance_review_required`
- `release_governance_blocked`
- `release_governance_restriction_detected`
- `release_governance_redaction_applied`

These are deterministic event descriptors only. They do not trigger deployment, rollback, launch, CI/CD mutation, or infrastructure mutation.

## UI Surface

The admin UI at `/admin/release-governance` displays:

- release readiness summaries
- deployment and rollback readiness visibility
- QA verification references
- operational-risk dependencies
- evidence and review lineage
- release restrictions
- redaction summaries

Required safety copy is visible in the UI:

- "Release governance is operationally scoped and review controlled."
- "No autonomous deployment, rollback, or public launch execution is enabled."
- "Manual approval remains required."

## Non-Goals

This layer does not add:

- deployment orchestration
- rollback execution
- CI/CD mutation
- production infrastructure control
- secret management systems
- autonomous release approval
- public-launch automation
- external release APIs
