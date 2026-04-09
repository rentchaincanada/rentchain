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
