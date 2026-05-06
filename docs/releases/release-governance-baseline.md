# Release Governance Baseline

## Purpose

This baseline defines the repeatable release governance checks RentChain should use for release checkpoints. It is a process guide, not a product feature, public launch certification, legal certification, or institutional approval.

## Release Checklist

- [ ] Confirm branch scope.
- [ ] Confirm `ci/backend` passed.
- [ ] Confirm `ci/frontend` passed.
- [ ] Confirm `merge-gate` passed.
- [ ] Confirm `codex-pr-review` passed.
- [ ] Confirm Vercel passed.
- [ ] Confirm Terraform passed.
- [ ] Confirm dependency/lockfile diff is empty unless intended.
- [ ] Confirm docs updated.
- [ ] Confirm release notes updated.
- [ ] Confirm release tag created when applicable.
- [ ] Confirm product/runtime/infrastructure changes are in scope.
- [ ] Confirm PR summary includes guardrails, limitations, and verification.

## QA Checklist

- [ ] Confirm targeted tests for touched areas passed.
- [ ] Confirm broader tests were run when practical.
- [ ] Confirm builds passed.
- [ ] Confirm known warnings are documented and non-regressive.
- [ ] Confirm user-visible behavior matches the mission acceptance criteria.
- [ ] Confirm no hidden automation or side effects were introduced.

## Migration Checklist

- [ ] Confirm whether migrations are required.
- [ ] Confirm no schema-breaking change exists unless explicitly approved.
- [ ] Confirm Firestore collection/index impacts.
- [ ] Confirm migration rollback approach.
- [ ] Confirm data backfill plan if applicable.
- [ ] Confirm migration verification steps.

## Rollback Checklist

- [ ] Identify merge commit.
- [ ] Identify release tag.
- [ ] Identify affected files.
- [ ] Confirm rollback approach.
- [ ] Confirm database/infrastructure impact.
- [ ] Confirm communication plan.
- [ ] Confirm post-rollback verification.
- [ ] Confirm whether rollback requires follow-up remediation PR.

## Monitoring Checklist

- [ ] Confirm deployment health checks.
- [ ] Confirm application logs are monitored.
- [ ] Confirm error rates are monitored.
- [ ] Confirm frontend deployment status.
- [ ] Confirm backend deployment status.
- [ ] Confirm alerts are in place for known risk surfaces.

## Security Review Checklist

- [ ] Confirm authorization boundaries remain unchanged or intentionally reviewed.
- [ ] Confirm no landlord/admin permission widening.
- [ ] Confirm sensitive tenant/payment/screening/private document payloads are excluded from new surfaces.
- [ ] Confirm no raw sensitive payloads are logged.
- [ ] Confirm public routes were not widened.
- [ ] Confirm external API calls were not added unless explicitly approved.

## Documentation Checklist

- [ ] Confirm architecture docs updated.
- [ ] Confirm release notes updated.
- [ ] Confirm runbook or governance docs updated when needed.
- [ ] Confirm PR summary documents assumptions and limitations.
- [ ] Confirm release checkpoint language does not claim public launch readiness unless approved.
- [ ] Confirm release checkpoint language does not claim legal/compliance certification.

## Post-Release Review Checklist

- [ ] Confirm release tag exists.
- [ ] Confirm main is synced.
- [ ] Confirm merged branch is cleaned up.
- [ ] Confirm final working tree is clean.
- [ ] Confirm follow-up missions are documented.
- [ ] Confirm any deferred risks are tracked.
- [ ] Confirm release notes reflect the final merged scope.
