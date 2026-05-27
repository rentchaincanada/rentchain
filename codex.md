# codex.md

## Product Posture

RentChain is governed rental operations and property intelligence infrastructure. Codex work must preserve governance-first architecture, projection-safe workflows, audit continuity, append-safe review history, supervised AI workflows, and institutional-readiness boundaries.

Do not describe or implement RentChain as generic landlord SaaS. Do not infer autonomous AI, live institutional integrations, public trust profiles, tokenization execution, or external submissions unless the active mission and current code explicitly support them.

## Tech Stack

- Frontend: React, TypeScript, Vite, SWC, Vercel.
- Backend: Node.js, Express, TypeScript, Cloud Run.
- Auth: Firebase Auth with server-side authorization.
- Database: Firestore.
- Storage: Google Cloud Storage where required.
- Email: Mailgun and SendGrid-related integrations where present.
- Infra: Terraform.
- Build/Deploy: GitHub Actions, Google Cloud Build, Cloud Run, Vercel.
- QA: Vitest, Playwright readiness, manual preview QA, Cloud Run revision verification for backend changes.

## Directory Map

- `rentchain-frontend/` = frontend app.
- `rentchain-api/` = backend API.
- `docs/` = product, architecture, governance, strategy, execution, and Claude context docs.
- `docs/ai/claude-context/` = Claude.ai upload/reference snapshots, not runtime source of truth.
- `docs/ai/claude-context/GOVERNANCE_REFERENCE.md` = canonical governance vocabulary for Claude/Codex discussion.
- `.codex/docs/` = technical deep-dives.
- `.github/` = GitHub Actions and PR automation.
- `.devcontainer/` = local cowork/sandbox foundation.
- `terraform/` or repo-root infra files = infrastructure.

## Required Read Order

Follow the repo-wide read order defined in `AGENTS.md`:

1. `codex.md`
2. `PROCESS.md`
3. active operator mission prompt or current mission spec in `docs/specs/`
4. `.codex/docs/*` only when specifically prompted for that domain

## Core Commands

### Git setup

```bash
git fetch origin
git checkout main
git pull --ff-only origin main
git checkout -b <feature-branch>
```

Avoid destructive cleanup commands unless explicitly authorized.

### Frontend

```bash
cd rentchain-frontend
npm ci
npm run test
npm run build
```

### Backend

```bash
cd rentchain-api
npm ci
npm run test
npm run build
```

### Docs-only validation

```bash
git diff --check
```

Use docs lint only if a relevant docs lint exists.

### Terraform

```bash
terraform init
terraform validate
terraform plan
```

Run Terraform only when the active mission touches infrastructure or explicitly requires it.

### Cloud Run / Backend Deployment Verification

Use Cloud Run revision, image, timestamp, and traffic checks when backend preview freshness matters. Vercel preview freshness does not prove backend code is deployed.

## Architectural Constraints

- Use canonical internal IDs for product logic.
- External identifiers are attributes, not primary keys.
- Use Firestore, not SQL.
- Use existing Express route and service patterns.
- Keep changes scoped to mission files.
- Do not edit billing, auth, pricing, entitlement, screening adapters, Firestore rules, CI, deployment, or infrastructure unless the mission requires it.
- No scraping or external API calls unless the mission explicitly requires them.
- Prefer deterministic logic and pure helpers.
- Tenant-facing data must use explicit whitelist projections.
- Admin/support metadata must not leak into tenant, landlord, public export, analytics, dashboard, or timeline surfaces.
- Raw Firestore IDs and storage paths must not become user-facing labels.
- Preserve append-safe operational history and audit continuity.
- Keep AI workflows supervised and operator-approved.

## Metadata-First Trust and Export Posture

Institutional, trust, evidence, and export features should remain:

- metadata-first
- consent-aware
- redaction-aware
- projection-safe
- manual-review-oriented unless explicitly scoped otherwise
- explicit about unsupported external submission or legal certification

Do not expose raw provider payloads, screening reports, tenant documents, private messages, credentials, tokens, or unrestricted policy internals.

## Repository Discovery and Governance Resolution

Before planning or implementing any mission, Codex must:

1. Audit the repository structure.
2. Identify actual governance, workflow, architecture, and execution files present in the current branch.
3. Follow discovered repository conventions.
4. Avoid duplicate systems, duplicate execution layers, or conflicting abstractions.
5. Never assume files exist unless they are present.
6. Distinguish implemented source-of-truth behavior from strategic or Claude context summaries.

Expected inspection locations include:

- repository root
- `docs/`
- `.github/`
- `.codex/`
- `.devcontainer/`
- execution, mission, architecture, reports, and strategy folders

If expected governance files are missing:

- proceed using nearby implementation patterns and existing repository conventions
- document assumptions in the PR summary
- avoid fabricating missing framework files
- avoid adding mission-local bootstrap text unless the mission specifically requires specialized discovery behavior

## Mission Promotion Pipeline

- Execute only the active operator-approved mission.
- Do not infer future roadmap as implementation scope.
- Do not expand scope.
- Treat strategy docs as context, not authorization.
- Use PR-sized, reviewable increments.

## Merge Safety Note

- Do not treat `merge-gate` as a substitute for required delivery checks.
- Follow the required check policy in `CODEX_RULES.md`.
- Do not merge without explicit operator authorization.
- After merge, sync main, clean branches, and report final status when authorized.

## Documentation Index

- `AGENTS.md`
- `PROCESS.md`
- `CODEX_RULES.md`
- `ARCHITECTURE.md`
- `README.md`
- `docs/execution/AI_COWORK_PROTOCOL.md`
- `docs/execution/QA_PLAYWRIGHT_PROTOCOL.md`
- `docs/execution/CLOUD_RUN_DEPLOYMENT_CHECKLIST.md`
- `docs/ai/claude-context/`
- `.codex/docs/database.md`
- `.codex/docs/auth.md`
- `.codex/docs/pipeline.md`
