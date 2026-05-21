# Dependency and Supply-Chain Governance v1

## Executive summary

This report documents RentChain's current dependency, package-manager, CI, and software supply-chain posture. The implementation for this mission is deliberately conservative:

- no dependency upgrades,
- no package-manager replacement,
- no runtime product behavior changes,
- no auth, route, Firestore, payment, screening, export, or review workflow changes,
- one low-noise package-manager governance check,
- one CI hygiene fix replacing the backend `npm install` fallback with strict `npm ci`.

RentChain currently uses npm lockfiles for all tracked JavaScript package roots. GitHub Actions and Cloud Build mostly use deterministic `npm ci` installs. Workflow actions are version-tagged, not SHA-pinned, which is acceptable short-term but should be reviewed before higher assurance institutional workflows.

## Package manager and lockfile posture

Tracked package roots:

| Package root | Package manager | Lockfile | Lockfile version | Node posture |
| --- | --- | --- | --- | --- |
| `rentchain-api` | npm | `package-lock.json` | v3 | `engines.node >=20 <21`; preflight check |
| `rentchain-frontend` | npm | `package-lock.json` | v3 | `engines.node >=20 <21`; preflight check |
| `status-frontend` | npm | `package-lock.json` | v3 | no package-level `engines` field |
| `rentchain-ai-agent` | npm | `package-lock.json` | v3 | `engines.node >=20 <21`; preflight check |

No tracked `yarn.lock`, `pnpm-lock.yaml`, Bun lockfile, or `npm-shrinkwrap.json` is present in package roots.

Current limitations:

- No package root declares a `packageManager` field. This avoids behavior changes today, but future hardening should pin npm explicitly after reviewing local, CI, Vercel, Cloud Build, and Codex runner behavior.
- `status-frontend` does not declare an `engines.node` constraint.
- Root `.nvmrc` and `.node-version` currently specify `20.11.1`, while CI uses Node `20.20.0` and package `engines` allow any Node 20 release. This should be aligned in a later low-risk runtime-version governance mission.

## Backend dependency summary

High-sensitivity dependency categories in `rentchain-api` include:

- Firebase/Admin and Firestore access: `firebase-admin`, `@google-cloud/firestore`.
- Cloud messaging/storage-adjacent infrastructure: `@google-cloud/pubsub`.
- Auth/session/token processing: `jsonwebtoken`, `bcryptjs`, `cookie-parser`, `cors`.
- Payments/provider integrations: `stripe`.
- Upload/import/document generation: `multer`, `papaparse`, `pdfkit`.
- Email/provider communication: `@sendgrid/mail`, `nodemailer`.
- AI/provider integration: `openai`.
- Validation/API runtime: `express`, `zod`, `ajv`.

No dependency versions were changed in this mission.

Notable audit finding:

- `npminstall` is present as a backend dev dependency. It is not used by the audited CI or Cloud Build install paths. It should be reviewed in a future cleanup mission before removal because this mission intentionally avoids dependency churn.

## Frontend dependency summary

High-sensitivity dependency categories in `rentchain-frontend` include:

- Firebase client auth/runtime: `firebase`.
- Routing and app shell: `react-router-dom`, `react`, `react-dom`.
- API/client calls: `axios`.
- UI/charting: `lucide-react`, `recharts`, `qrcode.react`.
- Build/test toolchain: `vite`, `vitest`, `typescript`, `eslint`, `@vitejs/plugin-react-swc`, `@playwright/test`.

React and React DOM are pinned to `18.3.1` and reinforced through `overrides` plus the existing `check-react-pin` build step.

No dependency versions were changed in this mission.

## Status frontend and AI agent posture

`status-frontend` is a minimal React/Vite status app with npm lockfile discipline. It should add a Node engines field in a future cleanup mission to match the main app posture.

`rentchain-ai-agent` has npm lockfile discipline and Node 20 engine constraints. It currently has a placeholder failing `npm test` script. This is not part of the main CI delivery path and should be reviewed before agent runtime expansion.

## GitHub Actions and workflow dependency posture

Tracked workflows:

- `.github/workflows/ci.yml`
- `.github/workflows/codex-autofix-ci.yml`
- `.github/workflows/codex-mission-runner.yml`
- `.github/workflows/codex-pr-review.yml`
- `.github/workflows/merge-gate.yml`

Current posture:

- Workflows use `actions/checkout@v4`, `actions/setup-node@v4`, `actions/github-script@v7`, and `openai/codex-action@v1`.
- Actions are major-version pinned, not full-SHA pinned.
- `ci` now uses `npm ci` for both backend and frontend installs.
- Codex autofix and mission-runner workflows already use `npm ci`.
- Workflow permissions are scoped by workflow purpose, but automation workflows have write permissions where they intentionally commit or comment.

Risks to track:

- Major-version action pinning can accept upstream changes. Full-SHA pinning provides stronger supply-chain control but creates more maintenance overhead.
- Codex workflows depend on `OPENAI_API_KEY` and must continue treating it as a GitHub secret only.
- Autofix workflow can commit to eligible PR branches after CI failure; attempt limits and same-repo branch checks are present.

## Cloud Build and Docker posture

Audited build surfaces:

- `cloudbuild.yaml`
- `rentchain-api/cloudbuild.yaml`
- `rentchain-api/Dockerfile`
- root `Dockerfile`
- `api/Dockerfile`
- `api/requirements.txt`

Findings:

- `rentchain-api/cloudbuild.yaml` and `rentchain-api/Dockerfile` use `npm ci`.
- Root `cloudbuild.yaml` checks required Cloud Run environment variable names, not values.
- `rentchain-api/cloudbuild.yaml` includes diagnostic environment/file listing. This may be useful for deployment debugging but should be reviewed before stricter production supply-chain hardening.
- Root `Dockerfile` appears to expect root-level `package*.json`, but no root `package.json` is present. Treat it as a stale or secondary artifact until ownership is confirmed.
- `api/Dockerfile` and `api/requirements.txt` define a small Python/FastAPI surface with unpinned Python package requirements. This appears outside the main RentChain API delivery path but should be inventoried or retired in a future mission.

## Install and build script review

Reviewed package scripts do not define npm lifecycle hooks such as `preinstall`, `postinstall`, or `prepare`.

Existing scripts are build/test/dev/preflight oriented. Frontend and backend builds include Node preflight checks. The frontend build also enforces the React pin.

New low-noise check:

- `scripts/check-package-manager-governance.mjs`

The check verifies:

- each tracked npm package root has a `package.json`,
- each tracked package root has a `package-lock.json`,
- lockfiles use npm lockfile version 3,
- package roots do not declare a non-npm package manager,
- mixed package-manager lockfiles are not present,
- selected CI/Codex workflows do not use `npm install`.

## Vulnerability response expectations

Recommended operating model:

1. Triage vulnerability reports by affected package root and reachable runtime surface.
2. Classify as runtime dependency, dev/build dependency, workflow action, container base image, or transitive package.
3. Confirm whether the vulnerable path is reachable in RentChain's deployed runtime.
4. Prefer minimal targeted updates over broad upgrade sweeps.
5. Update lockfiles only through the intended package root.
6. Run affected package tests/builds plus `scripts/check-package-manager-governance.mjs`.
7. Document any deferred CVE with reason, affected surface, and review date.
8. Treat auth, payments, screening, exports, evidence, upload/document, and logging dependencies as higher review priority.

## Known limitations

- No automated vulnerability scanning gate is introduced in this mission.
- No dependency review workflow is introduced yet.
- GitHub Actions are not SHA-pinned.
- Container base images are tag-pinned, not digest-pinned.
- Python `api/requirements.txt` dependencies are not version-pinned.
- Node version declarations are not fully aligned across root files, CI, and package engines.
- No SBOM generation exists yet.
- No dependency owner matrix exists yet.

## Recommended future hardening roadmap

1. Add a non-blocking dependency review/audit reporting workflow for PR visibility.
2. Align Node version declarations across `.nvmrc`, `.node-version`, CI, package engines, Vercel, and Cloud Build.
3. Review and either retire or govern the root `Dockerfile` and `api/` Python surface.
4. Decide whether to pin GitHub Actions by SHA for higher assurance workflows.
5. Decide whether to pin container base images by digest for production builds.
6. Add package ownership metadata for auth, payments, screening, exports, documents, and logging dependencies.
7. Add SBOM generation for release artifacts after dependency ownership is stabilized.
8. Review unused or secondary dependencies such as backend `npminstall`.

## Runtime behavior confirmation

This mission does not change product behavior, auth behavior, route visibility, Firestore rules, payment logic, screening logic, export behavior, review workflows, or runtime dependency versions. The only CI behavior change is stricter backend dependency installation through `npm ci`, matching the repository's existing lockfile discipline.
