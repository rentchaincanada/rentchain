# Current Architecture

## Backend Stack

- Node.js and Express.
- TypeScript.
- Firestore for persistence.
- Firebase Auth and server-side authorization.
- Google Cloud Storage where storage is required.
- Cloud Run for the main API.

Core API routes live in `rentchain-api`. Route ownership and route-source headers are important for preview QA and governance attribution.

## Frontend Stack

- React.
- TypeScript.
- Vite with SWC.
- Vercel for frontend deployment.
- Frontend API calls should use helpers that resolve to `VITE_API_BASE_URL` and Cloud Run for core API routes.

## Deployment Model

- Vercel deploys the frontend.
- Cloud Run serves `rentchain-api`.
- GitHub Actions run backend/frontend checks.
- Terraform status is part of repo-level deployment context.

Vercel preview freshness does not prove Cloud Run backend freshness. Backend changes require Cloud Run revision/image/traffic verification.

## Event, Ledger, and Review Principles

RentChain architecture favors:

- audit continuity
- append-safe records
- metadata-only review envelopes
- deterministic read models
- manual review before operational mutation
- projection-safe user-facing views

Avoid hidden automation, unreviewed workflow mutation, or raw debug explorers.

## Projection-Safe Read Models

Tenant-facing data should use whitelist projections. Landlord/admin/support views should use explicit safe summaries. Internal support/admin metadata must not leak to tenant, landlord, public export, analytics, dashboard, or timeline surfaces.

Raw Firestore IDs should not be user-facing labels.

## AI-Assisted Workflow Posture

AI can assist review, drafting, analysis, and triage, but workflows remain supervised. Current governance docs repeatedly prohibit autonomous remediation, hidden enforcement, and unsupervised status mutation unless an explicit mission defines safe controls.

## CI/CD Notes

Required check policy emphasizes actual frontend/backend delivery checks and Vercel contexts. `merge-gate` is supplemental, not a substitute for delivery checks.

Cloud Run deployment verification is required for backend payload QA when stale deployment drift is plausible.
