# Phase B Executive Summary

## Decision

The planning package is implementation-ready as an architecture and authorization baseline, but Phase B itself is **not ready to authorize today**. Administrative ownership, Terraform Cloud authority/state isolation, permanent project choice, and separate runtime fixes for production coupling must be resolved first.

## What Phase B would create and why

Phase B would create one isolated non-production GCP/Firebase foundation, keyless identities, synthetic Auth/Firestore/Storage, immutable exact-head images, ephemeral PR Cloud Run services, authenticated Vercel Preview routing, deterministic fixtures, provider suppression, evidence capture, budgets, and cleanup. It is required because current Vercel rewrites target the production API and backend/configuration paths do not safely distinguish a cloud Preview from production.

## Proven versus unproven

PR #1441 proved the bounded Vercel Preview OIDC → Google STS → exact-subject WIF → restricted service account → audience-bound Google ID token → IAM-protected Cloud Run chain without static credentials. It proved negative authentication cases and complete teardown. It did not prove application routing, Firebase/Auth/Firestore, fixtures, providers, CI/CD, Terraform, cost, or role QA.

## Recommendation

Adopt a hybrid permanent shared control/data plane plus ephemeral exact-head PR compute. Keep data synthetic and run-namespaced; serialize mutation tests; allow concurrent read-only smoke; set min instances zero/max one; prohibit production fallback and external side effects.

Security boundaries: no production identity/data/configuration, static keys, public Cloud Run, wildcard trust, browser credentials, broad automation roles, real provider actions, or untrusted-PR backend deployment. The main residual risks are a compromised/malicious Preview, environment mismatch, and administrator misuse.

## Cost and stages

Expected cloud spend is CAD 0–20 idle and CAD 10–60 in a normal active month, approximately CAD 0.25–2.00 per active PR, with a CAD 100 monthly ceiling and CAD 15/day anomaly stop. Existing Vercel/Terraform plan impacts require owner confirmation.

Implement only via B0–B10: approvals; project/budget; Terraform state/APIs; deployment identity; Cloud Run; Vercel bridge; Auth/data; fixtures; provider suppression; role QA; then PR #1435 validation readiness. Every stage is separately authorized and reversible.

## Approvals still required

Name all operational owners; choose/review the permanent project; prove Terraform Cloud state authority; approve the budget; validate Vercel claim granularity; approve IAM and trusted-PR policy; approve synthetic fixture/privacy/retention rules; and authorize separate runtime work that removes production coupling.

## Next mission

Recommend a docs-only B0 administrative-prerequisites evidence package after owners agree to proceed. No implementation PR should begin before that package is approved. This work made no infrastructure, IAM, Vercel, Firebase, runtime, PR #1435, or Operational Credits change.
