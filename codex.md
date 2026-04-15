# codex.md

## Tech Stack
- Frontend: React + Vite + SWC
- Backend: Node.js + Express
- Auth: Firebase Auth
- Database: Firestore
- Storage: Google Cloud Storage
- Email: Mailgun
- Infra: Terraform
- Build/Deploy: GitHub Actions, Google Cloud Build, Cloud Run, Vercel

## Directory Map
- `rentchain-frontend/` = frontend app
- `rentchain-api/` = backend API
- `docs/` = product and engineering docs
- `.codex/docs/` = technical deep-dives
- `terraform/` or repo-root infra files = infrastructure

## Required Read Order
1. `AGENTS.md`
2. `PROCESS.md`
3. current mission spec in `docs/specs/`
4. `.codex/docs/*` only when specifically prompted for that domain

## Critical Commands

### Git setup
```bash
git fetch origin
git checkout main
git reset --hard origin/main
git clean -fd
git checkout -b <feature-branch>
```

### Frontend

```bash
cd rentchain-frontend
npm ci
npm run build
npm run test
```

### Backend

```bash
cd rentchain-api
npm ci
npm run build
npm run test
```

### Terraform

```bash
terraform init
terraform validate
terraform plan
```

### Firebase / Google Cloud

```bash
firebase emulators:start
gcloud builds submit
gcloud run deploy
```

## Architectural Constraints

* Use canonical internal IDs for product logic
* Use Firestore, not SQL
* Use existing Express route patterns
* Keep changes scoped to mission files
* Do not edit billing/auth/screening adapters unless mission requires it
* Do not manually edit `firestore.rules` unless mission explicitly requires it
* No scraping or external API calls unless mission explicitly requires them
* Prefer deterministic logic and pure helpers

## Documentation Index

* `.codex/docs/database.md`
* `.codex/docs/auth.md`
* `.codex/docs/pipeline.md`

## Strict Rule

Only read sub-docs when specifically prompted for that domain.

## Mission Promotion Pipeline

- Only execute CURRENT_MISSION.md or explicit mission
- Do not infer future roadmap
- Do not expand scope
- Treat repo as execution-only

## Merge gate policy

When modifying or creating `.github/workflows/merge-gate.yml`, follow these rules:

- The merge-gate job must fail only when one or more required checks have actually failed, been cancelled, timed out, or require action.
- The merge-gate job must NOT fail while required checks are still pending, queued, or in progress.
- Pending checks should produce a neutral informational message only.
- Merge blocking during pending state is handled by GitHub branch protection, not by intentionally failing merge-gate.
- Required check names must remain unique across workflows.
- Do not add noisy failure behavior for pending checks.
