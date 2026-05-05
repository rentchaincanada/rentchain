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

## Repository Discovery & Governance Resolution

Before planning or implementing any mission, Codex must:

1. Audit the repository structure.
2. Identify the actual governance, workflow, architecture, and execution files present in the current branch.
3. Follow discovered repository conventions.
4. Avoid introducing duplicate systems, duplicate execution layers, or conflicting abstractions.
5. Never assume files exist unless they are present.

Expected inspection locations include:

- repository root
- `docs/`
- `.github/`
- `.codex/`
- execution or mission folders
- architecture or planning folders

Possible governance files may include, when present:

- `AGENTS.md`
- `PROCESS.md`
- `codex.md`
- `specifications.md`
- `ARCHITECTURE.md`
- `CONTRIBUTING.md`
- `docs/missions/_template.md`
- `docs/execution/CURRENT_MISSION.md`

If expected governance files are missing, Codex must:

- proceed using nearby implementation patterns and existing repository conventions
- document assumptions in the PR summary
- avoid fabricating missing framework files
- avoid adding mission-local bootstrap text unless the mission specifically requires specialized discovery behavior

## Strict Rule

Only read sub-docs when specifically prompted for that domain.

## Mission Promotion Pipeline

- Only execute CURRENT_MISSION.md or explicit mission
- Do not infer future roadmap
- Do not expand scope
- Treat repo as execution-only

## Merge gate policy

- Only execute CURRENT_MISSION.md or explicit mission
- Do not infer future roadmap
- Do not expand scope
- Treat repo as execution-only

## Merge safety note

- Do not treat `merge-gate` as a substitute for required delivery checks.
- Follow the required check policy in `CODEX_RULES.md`.
